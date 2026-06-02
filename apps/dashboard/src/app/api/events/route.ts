import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { IngestEventSchema } from '@/lib/validations';
import { upsertIssue } from '@/lib/issue-grouping';
import { fireAlerts } from '@/lib/services/alert.service';
import { resolveStackTrace } from '@/lib/services/sourcemap.service';
import { ZodError } from 'zod';

function generateEventId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-MonitorX-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Key
    const publicKey =
      request.headers.get('X-MonitorX-Key') ??
      request.headers.get('x-monitorx-key');

    if (!publicKey) {
      return NextResponse.json(
        { success: false, error: 'Missing X-MonitorX-Key header' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Support both new Site Keys and old API Keys
    let projectId: string;
    let projectEnv: string;

    const siteKey = await prisma.siteKey.findUnique({
      where: { key: publicKey },
      include: { project: true },
    }).catch(() => null);

    if (siteKey && siteKey.is_active) {
      projectId = siteKey.project_id;
      projectEnv = siteKey.project.environment;
    } else {
  return NextResponse.json(
    { success: false, error: 'Invalid or inactive key' },
    { status: 401, headers: CORS_HEADERS }
  );
}

    // 2. Parse Payload
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const parsed = IngestEventSchema.parse({
      ...(body as Record<string, unknown>),
      project_id: projectId,
    });

    // 3. Resolve Release
    let releaseId: string | undefined;
    if (parsed.release) {
      const release = await prisma.release.upsert({
        where: {
          project_id_version: {
            project_id: projectId,
            version: parsed.release,
          },
        },
        create: {
          project_id: projectId,
          version: parsed.release,
          environment: parsed.environment ?? projectEnv,
        },
        update: {},
      });
      releaseId = release.id;
    }

    // 4. Resolve Stack Trace via Source Maps
    let stacktrace = parsed.stacktrace;
    if (stacktrace?.frames?.length && parsed.release) {
      const resolved = await resolveStackTrace(
        stacktrace.frames as any,
        projectId,
        parsed.release
      );
      stacktrace = { frames: resolved as any };
    }

    // 5. Build event object
    const bodyAsRecord = body as Record<string, unknown>;
    const eventType = (bodyAsRecord.event_type as string) ?? 'error';

    const eventForGrouping = {
      event_id: parsed.event_id ?? generateEventId(),
      timestamp: parsed.timestamp ?? new Date().toISOString(),
      platform: parsed.platform ?? 'javascript',
      message: parsed.message,
      stacktrace,
      user_agent: parsed.user_agent,
      url: parsed.url,
      environment: parsed.environment ?? projectEnv,
      level: parsed.level ?? 'error',
      event_type: eventType,
      project_id: projectId,
      extra: parsed.extra,
      breadcrumbs: parsed.breadcrumbs,
      user: parsed.user,
      tags: parsed.tags,
      contexts: parsed.contexts,
      release: parsed.release,
    };

    // 6. Upsert Issue (only for error/api_error types)
    let issueId: string | null = null;
    if (eventType === 'error' || eventType === 'api_error') {
      issueId = await upsertIssue(
        eventForGrouping as any,
        projectId,
        releaseId
      );
    }

    // 7. Store Event
    const eventRecord = await prisma.event.create({
      data: {
        event_id: eventForGrouping.event_id,
        project_id: projectId,
        issue_id: issueId,
        release_id: releaseId,
        timestamp: new Date(eventForGrouping.timestamp),
        platform: eventForGrouping.platform,
        message: eventForGrouping.message,
        event_type: eventForGrouping.event_type,
        stacktrace: eventForGrouping.stacktrace
          ? JSON.parse(JSON.stringify(eventForGrouping.stacktrace))
          : null,
        user_agent: eventForGrouping.user_agent,
        url: eventForGrouping.url,
        environment: eventForGrouping.environment,
        level: eventForGrouping.level as any,
        extra: eventForGrouping.extra
          ? JSON.parse(JSON.stringify(eventForGrouping.extra))
          : null,
        breadcrumbs: eventForGrouping.breadcrumbs
          ? JSON.parse(JSON.stringify(eventForGrouping.breadcrumbs))
          : null,
        user_context: eventForGrouping.user
          ? JSON.parse(JSON.stringify(eventForGrouping.user))
          : null,
        tags: eventForGrouping.tags
          ? JSON.parse(JSON.stringify(eventForGrouping.tags))
          : null,
        contexts: eventForGrouping.contexts
          ? JSON.parse(JSON.stringify(eventForGrouping.contexts))
          : null,
        release: eventForGrouping.release,
        raw_payload: JSON.parse(JSON.stringify(body)),
      },
    });

    // 8. Store Issue Tags
    if (issueId && eventForGrouping.tags) {
      const tagEntries = Object.entries(eventForGrouping.tags);
      if (tagEntries.length > 0) {
        await prisma.issueTag.createMany({
          data: tagEntries.map(([key, value]) => ({
            issue_id: issueId!,
            key,
            value,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 9. Fire Alerts — only for error events
    if (issueId) {
      const issue = await prisma.issue.findUnique({ where: { id: issueId } });
      if (issue) {
        const isNew = issue.occurrences === 1;
        const isRegression = issue.status === 'regressed';
        if (isNew || isRegression) {
          try {
            await fireAlerts({
              projectId,
              issueId,
              issueTitle: issue.title,
              trigger: isRegression ? 'regression' : 'new_issue',
              environment: eventForGrouping.environment,
            });
          } catch (err) {
            console.error('[Events] fireAlerts error:', err);
          }
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          event_id: eventRecord.event_id,
          issue_id: issueId,
        },
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 422, headers: CORS_HEADERS }
      );
    }
    console.error('[/api/events] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}