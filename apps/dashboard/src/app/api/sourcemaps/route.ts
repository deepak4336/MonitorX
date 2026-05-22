import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { project_id, release, filename, content } = body;

    if (!project_id || !filename || !content) {
      return NextResponse.json(
        { success: false, error: 'project_id, filename, content are required' },
        { status: 400 }
      );
    }

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

    let releaseId: string | undefined;
    if (release) {
      const rel = await prisma.release.upsert({
        where: { project_id_version: { project_id, version: release } },
        create: { project_id, version: release, environment: project.environment },
        update: {},
      });
      releaseId = rel.id;
    }

    const existing = await prisma.sourceMap.findFirst({
      where: {
        project_id,
        filename,
        ...(releaseId ? { release_id: releaseId } : {}),
      },
    });

    let sourceMap;
    if (existing) {
      sourceMap = await prisma.sourceMap.update({
        where: { id: existing.id },
        data: { content },
      });
    } else {
      sourceMap = await prisma.sourceMap.create({
        data: { project_id, release_id: releaseId, filename, content },
      });
    }

    return NextResponse.json(
      { success: true, data: { id: sourceMap.id, filename, release } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[/api/sourcemaps]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });

  const maps = await prisma.sourceMap.findMany({
    where: { project_id: projectId },
    include: { release: { select: { version: true } } },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({ success: true, data: maps });
}