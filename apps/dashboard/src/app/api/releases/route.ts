import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });

  const releases = await prisma.release.findMany({
    where: { project_id: projectId },
    include: {
      _count: { select: { events: true, issues: true } },
    },
    orderBy: { deployed_at: 'desc' },
    take: 20,
  });

  return NextResponse.json({
    success: true,
    data: releases.map((r) => ({
      ...r,
      event_count: r._count.events,
      issue_count: r._count.issues,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { project_id, version, environment } = body;

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    include: {
      organization: {
        include: { members: { where: { user_id: user.id } } },
      },
    },
  });

  if (!project || project.organization.members.length === 0) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const release = await prisma.release.upsert({
    where: { project_id_version: { project_id, version } },
    create: {
      project_id,
      version,
      environment: environment ?? project.environment,
    },
    update: { deployed_at: new Date() },
  });

  return NextResponse.json({ success: true, data: release }, { status: 201 });
}