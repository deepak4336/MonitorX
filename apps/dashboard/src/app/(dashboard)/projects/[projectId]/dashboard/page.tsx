import { redirect, notFound } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/layout/PageHeader';
import AnalyticsCharts from '@/components/dashboard/AnalyticsCharts';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle, Activity, Users, Zap, TrendingUp,
  CheckCircle2, BarChart2, Terminal, Wifi, ServerCrash,
} from 'lucide-react';

interface Props {
  params: { projectId: string };
  searchParams: { tab?: string };
}

export default async function DashboardPage({ params, searchParams }: Props) {
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

  const tab = searchParams.tab ?? 'overview';
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    totalIssues,
    unresolvedIssues,
    totalAffectedUsers,
    eventLast24h,
    eventLast7Days,
    issuesByLevel,
    issuesByStatus,
    recentEvents,
    topIssues,
    consoleLogs,
    networkEvents,
    apiErrors,
  ] = await Promise.all([
    prisma.event.count({ where: { project_id: params.projectId } }),
    prisma.issue.count({ where: { project_id: params.projectId } }),
    prisma.issue.count({ where: { project_id: params.projectId, status: 'unresolved' } }),
    prisma.issue.aggregate({
      where: { project_id: params.projectId },
      _sum: { affected_users: true },
    }),
    prisma.event.count({
      where: { project_id: params.projectId, timestamp: { gte: last24h } },
    }),
    prisma.event.count({
      where: { project_id: params.projectId, timestamp: { gte: last7Days } },
    }),
    prisma.issue.groupBy({
      by: ['level'],
      where: { project_id: params.projectId },
      _count: true,
    }),
    prisma.issue.groupBy({
      by: ['status'],
      where: { project_id: params.projectId },
      _count: true,
    }),
    prisma.event.findMany({
      where: { project_id: params.projectId, timestamp: { gte: last30Days } },
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.issue.findMany({
      where: { project_id: params.projectId },
      orderBy: { occurrences: 'desc' },
      take: 5,
      select: { id: true, title: true, occurrences: true, level: true, status: true },
    }),
    // Console logs
    prisma.event.findMany({
      where: { project_id: params.projectId, event_type: 'console' },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: { id: true, message: true, level: true, url: true, timestamp: true, created_at: true },
    }),
    // Network events
    prisma.event.findMany({
      where: { project_id: params.projectId, event_type: 'network' },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: { id: true, message: true, level: true, url: true, timestamp: true, extra: true, created_at: true },
    }),
    // API errors
    prisma.event.findMany({
      where: { project_id: params.projectId, event_type: 'api_error' },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: { id: true, message: true, level: true, url: true, timestamp: true, extra: true, created_at: true },
    }),
  ]);

  // Build chart data
  const eventsByDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split('T')[0];
    eventsByDay[key] = 0;
  }
  recentEvents.forEach((event) => {
    const key = event.timestamp.toISOString().split('T')[0];
    if (eventsByDay[key] !== undefined) eventsByDay[key]++;
  });

  const eventsChartData = Object.entries(eventsByDay).map(([date, count]) => ({
    date: date.slice(5),
    events: count,
  }));

  const levelChartData = issuesByLevel.map((i: any) => ({ level: i.level, count: i._count }));
  const statusChartData = issuesByStatus.map((i: any) => ({ status: i.status, count: i._count }));
  const serializedTopIssues = JSON.parse(JSON.stringify(topIssues));
  const serializedConsole = JSON.parse(JSON.stringify(consoleLogs));
  const serializedNetwork = JSON.parse(JSON.stringify(networkEvents));
  const serializedApiErrors = JSON.parse(JSON.stringify(apiErrors));

  const STAT_CARDS = [
    { label: 'Total Events', value: totalEvents.toLocaleString(), icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Unresolved Issues', value: unresolvedIssues.toLocaleString(), icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Total Issues', value: totalIssues.toLocaleString(), icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Affected Users', value: (totalAffectedUsers._sum.affected_users ?? 0).toLocaleString(), icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Events (24h)', value: eventLast24h.toLocaleString(), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Events (7 days)', value: eventLast7Days.toLocaleString(), icon: CheckCircle2, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  const TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart2 },
    { key: 'console', label: 'Console Logs', icon: Terminal, count: consoleLogs.length },
    { key: 'network', label: 'Network', icon: Wifi, count: networkEvents.length },
    { key: 'api_errors', label: 'API Failures', icon: ServerCrash, count: apiErrors.length },
  ];

  const LEVEL_COLORS: Record<string, string> = {
    fatal: 'text-red-400 bg-red-500/10 border-red-500/20',
    error: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    debug: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    log: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  };

  return (
    <div>
      <PageHeader
        title={`${project.name} — Dashboard`}
        description={`${project.organization.name} · ${project.environment}`}
        action={
          <Link
            href={`/projects/${params.projectId}/issues`}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm border border-border hover:bg-accent transition-colors"
          >
            ← Issues
          </Link>
        }
      />

      <div className="p-6 space-y-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-lg border bg-card p-4 space-y-2">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-border flex items-center gap-1">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <Link
              key={key}
              href={`/projects/${params.projectId}/dashboard?tab=${key}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                tab === key
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
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <AnalyticsCharts
            eventsChartData={eventsChartData}
            levelChartData={levelChartData}
            statusChartData={statusChartData}
            topIssues={serializedTopIssues}
            projectId={params.projectId}
          />
        )}

        {tab === 'console' && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">Console Logs</h3>
              <span className="text-xs text-muted-foreground">{serializedConsole.length} entries</span>
            </div>
            {serializedConsole.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                No console logs captured yet
              </div>
            ) : (
              <div className="divide-y divide-border font-mono text-xs">
                {serializedConsole.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/30">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded border text-xs capitalize ${LEVEL_COLORS[log.level] ?? LEVEL_COLORS.log}`}>
                      {log.level}
                    </span>
                    <span className="flex-1 truncate text-foreground">{log.message}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'network' && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">Network Errors</h3>
              <span className="text-xs text-muted-foreground">{serializedNetwork.length} entries</span>
            </div>
            {serializedNetwork.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                No network errors captured yet
              </div>
            ) : (
              <div className="divide-y divide-border text-xs">
                {serializedNetwork.map((event: any) => {
                  const extra = event.extra as any ?? {};
                  return (
                    <div key={event.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30">
                      <span className="shrink-0 font-mono font-bold text-red-400">
                        {extra.method ?? 'GET'}
                      </span>
                      <span className="flex-1 font-mono truncate text-foreground">
                        {extra.url ?? event.url ?? '—'}
                      </span>
                      {extra.duration && (
                        <span className="shrink-0 text-muted-foreground">
                          {extra.duration}ms
                        </span>
                      )}
                      <span className="shrink-0 text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'api_errors' && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">API Failures</h3>
              <span className="text-xs text-muted-foreground">{serializedApiErrors.length} entries</span>
            </div>
            {serializedApiErrors.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                No API failures captured yet
              </div>
            ) : (
              <div className="divide-y divide-border text-xs">
                {serializedApiErrors.map((event: any) => {
                  const extra = event.extra as any ?? {};
                  return (
                    <div key={event.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30">
                      <span className={`shrink-0 font-mono font-bold px-1.5 py-0.5 rounded ${
                        extra.status >= 500
                          ? 'text-red-400 bg-red-500/10'
                          : 'text-orange-400 bg-orange-500/10'
                      }`}>
                        {extra.status ?? '5xx'}
                      </span>
                      <span className="shrink-0 font-mono text-muted-foreground">
                        {extra.method ?? 'GET'}
                      </span>
                      <span className="flex-1 font-mono truncate text-foreground">
                        {extra.url ?? event.url ?? '—'}
                      </span>
                      {extra.duration && (
                        <span className="shrink-0 text-muted-foreground">
                          {extra.duration}ms
                        </span>
                      )}
                      <span className="shrink-0 text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}