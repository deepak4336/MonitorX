import type { TelemetryEvent, IngestEventPayload, EventLevel, Stacktrace, StackFrame } from '@monitorx/shared-types';
import { generateEventId } from './utils';

/**
 * Parse an Error object into a normalized Stacktrace.
 */
export function parseErrorStacktrace(error: Error): Stacktrace {
  const frames: StackFrame[] = [];

  if (!error.stack) return { frames };

  const lines = error.stack.split('\n');
  // Skip the first line (error message)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Handle "at FunctionName (file:line:col)" format
    const atMatch = line.match(/^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (atMatch) {
      const [, fnName, filename, lineno, colno] = atMatch;
      frames.push({
        filename: filename || '<unknown>',
        function: fnName || '<anonymous>',
        lineno: lineno ? parseInt(lineno, 10) : undefined,
        colno: colno ? parseInt(colno, 10) : undefined,
        in_app: !filename?.includes('node_modules'),
      });
    }
  }

  return { frames: frames.reverse() }; // Most recent first → bottom
}

/**
 * Build a full TelemetryEvent from a raw Error + context.
 */
export function buildEventFromError(
  error: Error,
  projectId: string,
  environment: string,
  level: EventLevel = 'error',
  extra?: Record<string, unknown>
): TelemetryEvent {
  return {
    event_id: generateEventId(),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    message: error.message || String(error),
    stacktrace: parseErrorStacktrace(error),
    environment,
    level,
    project_id: projectId,
    extra,
  };
}

/**
 * Merge an IngestEventPayload with defaults to produce a TelemetryEvent.
 */
export function normalizeEvent(
  payload: IngestEventPayload,
  projectId: string,
  environment: string
): TelemetryEvent {
  return {
    event_id: payload.event_id ?? generateEventId(),
    timestamp: payload.timestamp ?? new Date().toISOString(),
    platform: payload.platform ?? 'javascript',
    message: payload.message,
    stacktrace: payload.stacktrace,
    user_agent: payload.user_agent,
    url: payload.url,
    environment: payload.environment ?? environment,
    level: payload.level ?? 'error',
    project_id: projectId,
    extra: payload.extra,
  };
}

/**
 * Compute a grouping fingerprint for an event (for issue deduplication).
 */
export function computeFingerprint(event: TelemetryEvent): string {
  const parts: string[] = [event.message];

  if (event.stacktrace?.frames?.length) {
    const topFrame = event.stacktrace.frames[event.stacktrace.frames.length - 1];
    if (topFrame) {
      parts.push(topFrame.filename);
      if (topFrame.lineno !== undefined) parts.push(String(topFrame.lineno));
    }
  }

  // Simple deterministic hash
  return parts.join('|').toLowerCase().replace(/\s+/g, ' ').trim();
}

export type { TelemetryEvent, IngestEventPayload, EventLevel };
