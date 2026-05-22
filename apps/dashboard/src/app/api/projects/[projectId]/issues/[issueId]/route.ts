import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

interface Params {
  params: { projectId: string; issueId: string };
}

// GET /api/projects/[projectId]/issues/[issueId]
export async function GET(_request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { organization: { include: { members: { where: { user_id: user.id } } } } },
  });

  if (!project || project.organization.members.length === 0) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: params.issueId },
    include: {
      events: {
        orderBy: { timestamp: 'desc' },
        take: 10,
      },
    },
  });

  if (!issue || issue.project_id !== params.projectId) {
    return NextResponse.json({ success: false, error: 'Issue not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: issue });
}

// PATCH /api/projects/[projectId]/issues/[issueId] — update status
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { organization: { include: { members: { where: { user_id: user.id } } } } },
  });

  if (!project || project.organization.members.length === 0) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const membership = project.organization.members[0];
  if (membership.role === 'viewer') {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { status } = body;

  if (!['unresolved', 'resolved', 'ignored'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
  }

  const updated = await prisma.issue.update({
    where: { id: params.issueId },
    data: { status },
  });

  return NextResponse.json({ success: true, data: updated });
}
