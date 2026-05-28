import { redirect, notFound } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/layout/PageHeader';
import AnalyticsCharts from '@/components/dashboard/AnalyticsCharts';
import Link from 'next/link';
import { AlertTriangle, Activity, Users, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

interface Props {
  params: { projectId: string };
}

export default async function DashboardPage({ params }: Props) {
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
      select: {
        id: true,
        title: true,
        occurrences: true,
        level: true,
        status: true,
      },
    }),
  ]);

  // Group events by day for last 30 days
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
    date: date.slice(5), // Show MM-DD only
    events: count,
  }));

  const levelChartData = issuesByLevel.map((i: any) => ({
    level: i.level,
    count: i._count,
  }));

  const statusChartData = issuesByStatus.map((i: any) => ({
    status: i.status,
    count: i._count,
  }));

  const serializedTopIssues = JSON.parse(JSON.stringify(topIssues));

  const STAT_CARDS = [
    {
      label: 'Total Events',
      value: totalEvents.toLocaleString(),
      icon: Zap,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Unresolved Issues',
      value: unresolvedIssues.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Total Issues',
      value: totalIssues.toLocaleString(),
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Affected Users',
      value: (totalAffectedUsers._sum.affected_users ?? 0).toLocaleString(),
      icon: Users,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Events (24h)',
      value: eventLast24h.toLocaleString(),
      icon: TrendingUp,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Events (7 days)',
      value: eventLast7Days.toLocaleString(),
      icon: CheckCircle2,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
  ];

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

        {/* Charts */}
        <AnalyticsCharts
          eventsChartData={eventsChartData}
          levelChartData={levelChartData}
          statusChartData={statusChartData}
          topIssues={serializedTopIssues}
          projectId={params.projectId}
        />
      </div>
    </div>
  );
}