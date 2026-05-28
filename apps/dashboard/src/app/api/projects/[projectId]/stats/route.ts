import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

interface Params {
  params: { projectId: string };
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      organization: {
        include: { members: { where: { user_id: user.id } } },
      },
    },
  });

  if (!project || project.organization.members.length === 0) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
    // Total events
    prisma.event.count({ where: { project_id: params.projectId } }),

    // Total issues
    prisma.issue.count({ where: { project_id: params.projectId } }),

    // Unresolved issues
    prisma.issue.count({
      where: { project_id: params.projectId, status: 'unresolved' },
    }),

    // Total affected users
    prisma.issue.aggregate({
      where: { project_id: params.projectId },
      _sum: { affected_users: true },
    }),

    // Events last 24h
    prisma.event.count({
      where: {
        project_id: params.projectId,
        timestamp: { gte: last24h },
      },
    }),

    // Events last 7 days
    prisma.event.count({
      where: {
        project_id: params.projectId,
        timestamp: { gte: last7Days },
      },
    }),

    // Issues by level
    prisma.issue.groupBy({
      by: ['level'],
      where: { project_id: params.projectId },
      _count: true,
    }),

    // Issues by status
    prisma.issue.groupBy({
      by: ['status'],
      where: { project_id: params.projectId },
      _count: true,
    }),

    // Events per day for last 30 days
    prisma.event.findMany({
      where: {
        project_id: params.projectId,
        timestamp: { gte: last30Days },
      },
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    }),

    // Top 5 issues by occurrences
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

  // Group events by day
  const eventsByDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split('T')[0];
    eventsByDay[key] = 0;
  }

  recentEvents.forEach((event) => {
    const key = event.timestamp.toISOString().split('T')[0];
    if (eventsByDay[key] !== undefined) {
      eventsByDay[key]++;
    }
  });

  const eventsChartData = Object.entries(eventsByDay).map(([date, count]) => ({
    date,
    events: count,
  }));

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalEvents,
        totalIssues,
        unresolvedIssues,
        totalAffectedUsers: totalAffectedUsers._sum.affected_users ?? 0,
        eventLast24h,
        eventLast7Days,
      },
      issuesByLevel: issuesByLevel.map((i: any) => ({
        level: i.level,
        count: i._count,
      })),
      issuesByStatus: issuesByStatus.map((i: any) => ({
        status: i.status,
        count: i._count,
      })),
      eventsChartData,
      topIssues,
    },
  });
}