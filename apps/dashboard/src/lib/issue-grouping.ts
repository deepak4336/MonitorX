import { prisma } from './prisma';

interface StackFrame {
  filename: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  resolved_filename?: string;
  resolved_function?: string;
}

interface TelemetryEvent {
  event_id: string;
  timestamp: string;
  platform: string;
  message: string;
  stacktrace?: { frames: StackFrame[] };
  user_agent?: string;
  url?: string;
  environment: string;
  level: string;
  project_id: string;
  extra?: Record<string, unknown>;
  user?: { id?: string; email?: string; username?: string };
  release?: string;
}

export function computeFingerprint(event: TelemetryEvent): string {
  const parts: string[] = [];

  let normalizedMessage = event.message
    .toLowerCase()
    .replace(/0x[0-9a-f]+/gi, '0xADDR')
    .replace(/\b\d{4,}\b/g, 'N')
    .replace(/'[^']*'/g, "'VAL'")
    .replace(/"[^"]*"/g, '"VAL"')
    .trim();

  parts.push(normalizedMessage);

  if (event.stacktrace?.frames?.length) {
    const frames = event.stacktrace.frames;
    const inAppFrames = frames.filter((f) => f.in_app !== false);
    const topFrame = inAppFrames[inAppFrames.length - 1] ?? frames[frames.length - 1];

    if (topFrame) {
      const filename = (topFrame.resolved_filename ?? topFrame.filename)
        .replace(/https?:\/\/[^/]+/, '')
        .replace(/\?.*$/, '')
        .replace(/\.[0-9a-f]{8,}\.(js|css)/, '.$1')
        .trim();

      parts.push(filename);

      if (topFrame.function && topFrame.function !== '<anonymous>') {
        parts.push(topFrame.function);
      } else if (topFrame.lineno !== undefined) {
        parts.push(String(Math.floor(topFrame.lineno / 10) * 10));
      }
    }
  }

  return parts.join('||');
}

export function extractIssueTitle(event: TelemetryEvent): string {
  const msg = event.message.trim();
  return msg.length <= 120 ? msg : msg.slice(0, 117) + '…';
}

export function extractCulprit(event: TelemetryEvent): string | undefined {
  if (!event.stacktrace?.frames?.length) return undefined;
  const frames = event.stacktrace.frames;
  const inAppFrames = frames.filter((f) => f.in_app !== false);
  const topFrame = inAppFrames[inAppFrames.length - 1] ?? frames[frames.length - 1];
  if (!topFrame) return undefined;
  const filename = (topFrame.resolved_filename ?? topFrame.filename)
    .replace(/https?:\/\/[^/]+/, '')
    .replace(/\?.*$/, '');
  const fn = topFrame.resolved_function ?? topFrame.function;
  return fn ? `${filename} in ${fn}` : filename;
}

const LEVEL_SEVERITY: Record<string, number> = {
  debug: 0, info: 1, warning: 2, error: 3, fatal: 4,
};

export async function upsertIssue(
  event: TelemetryEvent,
  projectId: string,
  releaseId?: string
): Promise<string> {
  const fingerprint = computeFingerprint(event);
  const title = extractIssueTitle(event);
  const culprit = extractCulprit(event);
  const eventTime = new Date(event.timestamp);
  const version = event.release;

  const existing = await prisma.issue.findUnique({
    where: { project_id_fingerprint: { project_id: projectId, fingerprint } },
  });

  if (existing) {
    const isRegression = existing.status === 'resolved';

    const updated = await prisma.issue.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        last_seen_at: eventTime > existing.last_seen_at ? eventTime : existing.last_seen_at,
        last_seen_release: version ?? existing.last_seen_release,
        status: isRegression ? 'regressed' : existing.status === 'ignored' ? 'ignored' : 'unresolved',
        level: getSeverityLevel(event.level, existing.level as string) as any,
        affected_users: event.user?.id
          ? { increment: 1 }
          : existing.affected_users,
        ...(releaseId && !existing.release_id ? { release_id: releaseId } : {}),
      },
    });
    return updated.id;
  }

  const created = await prisma.issue.create({
    data: {
      project_id: projectId,
      release_id: releaseId,
      title,
      culprit,
      fingerprint,
      level: event.level as any,
      status: 'unresolved',
      occurrences: 1,
      affected_users: event.user?.id ? 1 : 0,
      environment: event.environment,
      first_seen: version,
      last_seen_release: version,
      first_seen_at: eventTime,
      last_seen_at: eventTime,
    },
  });

  return created.id;
}

function getSeverityLevel(newLevel: string, existingLevel: string): string {
  const newSev = LEVEL_SEVERITY[newLevel] ?? 3;
  const existingSev = LEVEL_SEVERITY[existingLevel] ?? 3;
  return newSev > existingSev ? newLevel : existingLevel;
}