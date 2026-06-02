import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

function generateSiteKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'mx_live_';
  for (let i = 0; i < 16; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, label } = await request.json();
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      organization: {
        include: { members: { where: { user_id: user.id } } },
      },
    },
  });

  if (!project || project.organization.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const siteKey = await prisma.siteKey.create({
    data: {
      project_id: projectId,
      key: generateSiteKey(),
      label: label || 'Default Key',
    },
  });

  return NextResponse.json({ success: true, data: siteKey });
}