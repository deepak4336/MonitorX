import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

interface Params { params: { projectId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const rules = await prisma.alertRule.findMany({
    where: { project_id: params.projectId },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({ success: true, data: rules });
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, trigger, channel, destination, cooldown_min } = body;

  if (!name || !trigger || !channel || !destination) {
    return NextResponse.json(
      { success: false, error: 'name, trigger, channel, destination required' },
      { status: 400 }
    );
  }

  const rule = await prisma.alertRule.create({
    data: {
      project_id: params.projectId,
      name,
      trigger,
      channel,
      destination,
      cooldown_min: cooldown_min ?? 60,
    },
  });

  return NextResponse.json({ success: true, data: rule }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('id');
  if (!ruleId) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  await prisma.alertRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ success: true });
}