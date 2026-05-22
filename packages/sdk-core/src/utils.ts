/**
 * Generate a UUID v4-like event ID.
 */
export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback for older environments
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/**
 * Safe JSON stringify that handles circular refs.
 */
export function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  });
}

/**
 * Parse a MonitorX DSN string.
 * Format: https://<public_key>@<host>/project/<project_id>
 */
export interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
  ingestUrl: string;
}

export function parseDsn(dsn: string): ParsedDsn {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[pathParts.length - 1];
    const ingestUrl = `${url.protocol}//${host}/api/events`;

    if (!publicKey || !projectId) {
      throw new Error('Invalid DSN format');
    }

    return { publicKey, host, projectId, ingestUrl };
  } catch {
    throw new Error(`[MonitorX] Invalid DSN: ${dsn}`);
  }
}
