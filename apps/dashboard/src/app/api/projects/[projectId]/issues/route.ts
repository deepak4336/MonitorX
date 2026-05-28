import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

interface Params {
  params: { projectId: string };
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'unresolved';
  const level = searchParams.get('level');
  const environment = searchParams.get('environment');
  const release = searchParams.get('release');
  const search = searchParams.get('search');
  const dateRange = searchParams.get('dateRange');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100);
  const skip = (page - 1) * limit;

  // Verify user has access
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

  // Date range filter
  let dateFilter: Date | undefined;
  if (dateRange === '24h') {
    dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else if (dateRange === '7d') {
    dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (dateRange === '30d') {
    dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  const where: any = {
    project_id: params.projectId,
    ...(status !== 'all' ? { status } : {}),
    ...(level ? { level } : {}),
    ...(environment ? { environment } : {}),
    ...(release ? { last_seen_release: release } : {}),
    ...(search ? {
      title: { contains: search, mode: 'insensitive' },
    } : {}),
    ...(dateFilter ? { last_seen_at: { gte: dateFilter } } : {}),
  };

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { last_seen_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.issue.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: issues,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}