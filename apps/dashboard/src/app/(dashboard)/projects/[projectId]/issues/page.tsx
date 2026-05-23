import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/layout/PageHeader';
import LevelBadge from '@/components/ui/LevelBadge';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle2, EyeOff, Activity, Settings } from 'lucide-react';
import { buildDsn } from '@/lib/utils';

interface Props {
  params: { projectId: string };
  searchParams: { status?: string; level?: string };
}

export default async function IssuesPage({ params, searchParams }: Props) {
  const user = await getUser();
  if (!user) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      organization: {
        include: { members: { where: { user_id: user.id } } },
      },
      api_keys: { where: { is_active: true }, take: 1 },
    },
  });

  if (!project || project.organization.members.length === 0) notFound();

  const status = (searchParams.status ?? 'unresolved') as
    | 'unresolved'
    | 'resolved'
    | 'ignored'
    | 'regressed'
    | 'all';

  const level = searchParams.level as
    | 'fatal'
    | 'error'
    | 'warning'
    | 'info'
    | 'debug'
    | undefined;

  const where = {
    project_id: params.projectId,
    ...(status !== 'all' ? { status } : {}),
    ...(level ? { level } : {}),
  };

  const [issues, counts] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { last_seen_at: 'desc' },
      take: 50,
    }),
    prisma.issue.groupBy({
      by: ['status'],
      where: { project_id: params.projectId },
      _count: true,
    }),
  ]);

  const countByStatus = counts.reduce((acc: Record<string, number>, c) => {
  acc[c.status] = c._count;
  return acc;
}, {} as Record<string, number>);

  const dsn = project.api_keys[0]
    ? buildDsn(project.api_keys[0].public_key, project.id)
    : null;

  const STATUS_TABS = [
    { key: 'unresolved', label: 'Unresolved', icon: AlertTriangle },
    { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
    { key: 'ignored', label: 'Ignored', icon: EyeOff },
    { key: 'all', label: 'All', icon: Activity },
  ];

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.organization.name} · ${project.environment}`}
        action={
          <Link
            href={`/projects/${params.projectId}/settings`}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm border border-border hover:bg-accent transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>
        }
      />

      {/* DSN info bar */}
      {dsn && (
        <div className="flex items-center gap-2 px-6 py-2.5 border-b bg-muted/30 text-xs">
          <span className="text-muted-foreground font-medium">DSN:</span>
          <code className="font-mono text-muted-foreground truncate">{dsn}</code>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b">
        {STATUS_TABS.map(({ key, label, icon: Icon }) => {
          const active = status === key;
          const count = countByStatus[key];
          return (
            <Link
              key={key}
              href={`/projects/${params.projectId}/issues?status=${key}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-foreground text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Issues list */}
      <div className="divide-y divide-border">
        {issues.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {status === 'unresolved'
                ? 'No unresolved issues — great job!'
                : `No ${status} issues`}
            </p>
          </div>
        ) : (
          issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/projects/${params.projectId}/issues/${issue.id}`}
              className="group flex items-start gap-4 px-6 py-4 hover:bg-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <LevelBadge level={issue.level as any} />
                  {issue.status === 'regressed' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      Regressed
                    </span>
                  )}
                  {issue.last_seen_release && (
                    <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {issue.last_seen_release}
                    </span>
                  )}
                  <span className="font-mono text-sm font-medium truncate group-hover:text-foreground">
                    {issue.title}
                  </span>
                </div>
                {issue.culprit && (
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {issue.culprit}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    First seen {formatDistanceToNow(new Date(issue.first_seen_at), { addSuffix: true })}
                  </span>
                  <span>·</span>
                  <span>
                    Last seen {formatDistanceToNow(new Date(issue.last_seen_at), { addSuffix: true })}
                  </span>
                  <span>·</span>
                  <span>{issue.environment}</span>
                </div>
              </div>

              <div className="text-right shrink-0 space-y-0.5">
                <div className="text-sm font-semibold tabular-nums">
                  {issue.occurrences.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">events</div>
                {issue.affected_users > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {issue.affected_users} users
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}