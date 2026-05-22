import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

interface Params {
  params: { projectId: string };
}

// GET /api/projects/[projectId]/issues
export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'unresolved';
  const level = searchParams.get('level');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100);
  const skip = (page - 1) * limit;

  // Verify user has access to this project's organization
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { organization: { include: { members: { where: { user_id: user.id } } } } },
  });

  if (!project || project.organization.members.length === 0) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const where = {
    project_id: params.projectId,
    ...(status !== 'all' ? { status: status as 'unresolved' | 'resolved' | 'ignored' } : {}),
    ...(level ? { level: level as 'fatal' | 'error' | 'warning' | 'info' | 'debug' } : {}),
  };

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { last_seen: 'desc' },
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
