import { parseDsn, buildEventFromError, generateEventId } from '@monitorx/sdk-core';
import type { ParsedDsn } from '@monitorx/sdk-core';
import type { TelemetryEvent, EventLevel, IngestEventPayload } from '@monitorx/shared-types';

export interface MonitorXConfig {
  dsn: string;
  environment?: string;
  debug?: boolean;
  /**
   * Maximum number of events queued before flushing (default: 10)
   */
  maxQueueSize?: number;
  /**
   * Enable automatic browser error capturing (default: true)
   */
  autoCapture?: boolean;
}

interface QueuedEvent {
  event: TelemetryEvent;
  retries: number;
}

class MonitorXClient {
  private config: Required<MonitorXConfig> | null = null;
  private parsedDsn: ParsedDsn | null = null;
  private queue: QueuedEvent[] = [];
  private initialized = false;

  init(config: MonitorXConfig): void {
    if (this.initialized) {
      this.log('warn', 'MonitorX already initialized. Skipping.');
      return;
    }

    try {
      this.parsedDsn = parseDsn(config.dsn);
    } catch (err) {
      console.error('[MonitorX] Failed to parse DSN:', err);
      return;
    }

    this.config = {
      dsn: config.dsn,
      environment: config.environment ?? 'production',
      debug: config.debug ?? false,
      maxQueueSize: config.maxQueueSize ?? 10,
      autoCapture: config.autoCapture ?? true,
    };

    this.initialized = true;

    if (this.config.autoCapture) {
      this.installGlobalHandlers();
    }

    this.log('info', `Initialized for project ${this.parsedDsn.projectId} (${this.config.environment})`);
  }

  /**
   * Capture an Error object and send it as a telemetry event.
   */
  captureException(error: Error, extra?: Record<string, unknown>): string | null {
    if (!this.isReady()) return null;

    const event = buildEventFromError(
      error,
      this.parsedDsn!.projectId,
      this.config!.environment,
      'error',
      {
        ...extra,
        user_agent: navigator.userAgent,
        url: window.location.href,
      }
    );

    // Attach browser context
    event.user_agent = navigator.userAgent;
    event.url = window.location.href;

    this.enqueue(event);
    return event.event_id;
  }

  /**
   * Capture a message string as a telemetry event.
   */
  captureMessage(message: string, level: EventLevel = 'info', extra?: Record<string, unknown>): string | null {
    if (!this.isReady()) return null;

    const event: TelemetryEvent = {
      event_id: generateEventId(),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      message,
      level,
      environment: this.config!.environment,
      project_id: this.parsedDsn!.projectId,
      user_agent: navigator.userAgent,
      url: window.location.href,
      extra,
    };

    this.enqueue(event);
    return event.event_id;
  }

  /**
   * Send a raw payload directly to the ingest API.
   */
  async sendEvent(payload: IngestEventPayload): Promise<void> {
    if (!this.isReady()) return;

    const event: TelemetryEvent = {
      event_id: payload.event_id ?? generateEventId(),
      timestamp: payload.timestamp ?? new Date().toISOString(),
      platform: payload.platform ?? 'javascript',
      message: payload.message,
      stacktrace: payload.stacktrace,
      user_agent: payload.user_agent ?? navigator.userAgent,
      url: payload.url ?? window.location.href,
      environment: payload.environment ?? this.config!.environment,
      level: payload.level ?? 'error',
      project_id: this.parsedDsn!.projectId,
      extra: payload.extra,
    };

    await this.transmit(event);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private installGlobalHandlers(): void {
    // window.onerror
    const prevOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      const err = error ?? new Error(String(message));
      if (!error && source) {
        // Synthetic stack from globals
        (err as Error).stack = `Error: ${message}\n    at <anonymous> (${source}:${lineno}:${colno})`;
      }
      this.captureException(err as Error);
      if (typeof prevOnError === 'function') {
        return prevOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    // Unhandled promise rejections
    const prevUnhandledRejection = window.onunhandledrejection;
    window.addEventListener('unhandledrejection', (event) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      this.captureException(error);
    });

    if (typeof prevUnhandledRejection === 'function') {
      window.onunhandledrejection = prevUnhandledRejection;
    }

    this.log('info', 'Global error handlers installed.');
  }

  private enqueue(event: TelemetryEvent): void {
    this.queue.push({ event, retries: 0 });
    // Flush immediately — in Phase 1 we send right away
    this.flush();
  }

  private flush(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.transmit(item.event).catch((err) => {
        this.log('error', 'Failed to send event:', err);
        // Re-queue with retry limit
        if (item.retries < 2) {
          this.queue.push({ event: item.event, retries: item.retries + 1 });
        }
      });
    }
  }

  private async transmit(event: TelemetryEvent): Promise<void> {
    if (!this.parsedDsn || !this.config) return;

    this.log('debug', 'Sending event:', event);

    const response = await fetch(this.parsedDsn.ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MonitorX-Key': this.parsedDsn.publicKey,
      },
      body: JSON.stringify(event),
      // Non-blocking: use keepalive so events send even during page unload
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error(`Ingest API returned ${response.status}`);
    }

    this.log('info', `Event sent: ${event.event_id}`);
  }

  private isReady(): boolean {
    if (!this.initialized || !this.config || !this.parsedDsn) {
      console.warn('[MonitorX] SDK not initialized. Call MonitorX.init() first.');
      return false;
    }
    return true;
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', ...args: unknown[]): void {
    if (!this.config?.debug && level === 'debug') return;
    const prefix = `[MonitorX]`;
    if (level === 'error') console.error(prefix, ...args);
    else if (level === 'warn') console.warn(prefix, ...args);
    else console.log(prefix, ...args);
  }
}

// Singleton instance
const client = new MonitorXClient();

export const init = (config: MonitorXConfig) => client.init(config);
export const captureException = (error: Error, extra?: Record<string, unknown>) =>
  client.captureException(error, extra);
export const captureMessage = (message: string, level?: EventLevel, extra?: Record<string, unknown>) =>
  client.captureMessage(message, level, extra);
export const sendEvent = (payload: IngestEventPayload) => client.sendEvent(payload);

export default client;
