import { redirect, notFound } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import LevelBadge from '@/components/ui/LevelBadge';
import StackTraceViewer from '@/components/issues/StackTraceViewer';
import IssueStatusToggle from '@/components/issues/IssueStatusToggle';
import BreadcrumbTimeline from '@/components/issues/BreadcrumbTimeline';
import EventContextPanel from '@/components/issues/EventContextPanel';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowLeft, Clock, RefreshCw, Users, Package } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: { projectId: string; issueId: string };
}

export default async function IssueDetailPage({ params }: Props) {
  const user = await getUser();
  if (!user) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      organization: {
        include: { members: { where: { user_id: user.id } } },
      },
    },
  });

  if (!project || project.organization.members.length === 0) notFound();

  const issue = await prisma.issue.findUnique({
    where: { id: params.issueId },
    include: {
      events: { orderBy: { timestamp: 'desc' }, take: 20 },
      tags: true,
    },
  });

  if (!issue || issue.project_id !== params.projectId) notFound();

  // Safe date helpers
  const firstSeenDate = issue.first_seen_at ?? issue.created_at;
  const lastSeenDate = issue.last_seen_at ?? issue.updated_at;

  // Fully serialize everything to plain JSON — fixes "Unsupported Server Component type"
  const serializedIssue = JSON.parse(JSON.stringify({
    id: issue.id,
    title: issue.title,
    culprit: issue.culprit,
    level: issue.level,
    status: issue.status,
    occurrences: issue.occurrences,
    affected_users: issue.affected_users,
    environment: issue.environment,
    last_seen_release: issue.last_seen_release,
    project_id: issue.project_id,
    tags: issue.tags,
    first_seen_at: firstSeenDate,
    last_seen_at: lastSeenDate,
  }));

  const serializedEvents = JSON.parse(JSON.stringify(
    issue.events.map((e) => ({
      id: e.id,
      event_id: e.event_id,
      timestamp: e.timestamp,
      url: e.url ?? null,
      user_agent: e.user_agent ?? null,
      user_context: e.user_context ?? null,
      tags: e.tags ?? null,
      contexts: e.contexts ?? null,
      release: e.release ?? null,
      environment: e.environment,
      breadcrumbs: e.breadcrumbs ?? null,
      raw_payload: e.raw_payload,
      stacktrace: e.stacktrace ?? null,
    }))
  ));

  const latestEvent = serializedEvents[0] ?? null;
  const stacktrace = latestEvent?.stacktrace ?? null;
  const breadcrumbs = latestEvent?.breadcrumbs ?? [];

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-4 border-b space-y-3">
        <Link
          href={`/projects/${params.projectId}/issues`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Issues
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <LevelBadge level={serializedIssue.level as any} />
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                {serializedIssue.environment}
              </span>
              {serializedIssue.last_seen_release && (
                <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {serializedIssue.last_seen_release}
                </span>
              )}
              {serializedIssue.status === 'regressed' && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  Regressed
                </span>
              )}
            </div>
            <h1 className="text-base font-mono font-semibold leading-tight">
              {serializedIssue.title}
            </h1>
            {serializedIssue.culprit && (
              <p className="text-sm text-muted-foreground font-mono">
                {serializedIssue.culprit}
              </p>
            )}
          </div>

          <IssueStatusToggle
            issueId={serializedIssue.id}
            projectId={params.projectId}
            currentStatus={serializedIssue.status}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <strong className="text-foreground">
              {serializedIssue.occurrences.toLocaleString()}
            </strong> occurrences
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <strong className="text-foreground">
              {serializedIssue.affected_users}
            </strong> users affected
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            First seen {formatDistanceToNow(new Date(serializedIssue.first_seen_at), { addSuffix: true })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Last seen {formatDistanceToNow(new Date(serializedIssue.last_seen_at), { addSuffix: true })}
          </span>
        </div>

        {/* Tags */}
        {serializedIssue.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {serializedIssue.tags.map((tag: any) => (
              <span key={tag.id} className="text-xs font-mono bg-muted/50 border rounded px-2 py-0.5">
                <span className="text-muted-foreground">{tag.key}</span>
                <span className="text-muted-foreground/60">=</span>
                <span>{tag.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stack trace + Breadcrumbs */}
        <div className="lg:col-span-2 space-y-6">
          {stacktrace && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Stack Trace</h2>
              <StackTraceViewer stacktrace={stacktrace} message={serializedIssue.title} />
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Breadcrumbs</h2>
            <BreadcrumbTimeline breadcrumbs={breadcrumbs} />
          </div>

          {latestEvent && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Raw Payload</h2>
              <div className="rounded-lg border bg-muted/30 overflow-auto max-h-64">
                <pre className="text-xs font-mono p-4 leading-relaxed">
                  {JSON.stringify(latestEvent.raw_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right: Context + Timeline */}
        <div className="space-y-6">
          {latestEvent && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Event Context</h2>
              <EventContextPanel event={latestEvent} />
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Recent Occurrences</h2>
            <div className="rounded-lg border divide-y divide-border">
              {serializedEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between px-3 py-2.5 text-xs">
                  <span className="font-mono text-muted-foreground truncate w-32">
                    {event.event_id.slice(0, 8)}…
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(event.timestamp), 'MMM d, HH:mm:ss')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}