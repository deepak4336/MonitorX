import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

interface Params { params: { token: string } }

// GET — look up invite by token
export async function GET(request: NextRequest, { params }: Params) {
  const invite = await prisma.organizationInvite.findUnique({
    where: { token: params.token },
    include: { organization: { select: { name: true, slug: true } } },
  });

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite already used or expired' }, { status: 400 });
  if (new Date() > invite.expires_at) {
    await prisma.organizationInvite.update({ where: { id: invite.id }, data: { status: 'expired' } });
    return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(invite)) });
}

// POST — accept invite
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invite = await prisma.organizationInvite.findUnique({
    where: { token: params.token },
  });

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
  if (new Date() > invite.expires_at) {
    await prisma.organizationInvite.update({ where: { id: invite.id }, data: { status: 'expired' } });
    return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
  }

  // Add user to org
  await prisma.organizationMember.create({
    data: {
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role,
    },
  });

  // Mark invite as accepted
  await prisma.organizationInvite.update({
    where: { id: invite.id },
    data: { status: 'accepted' },
  });

  return NextResponse.json({ success: true, organizationId: invite.organization_id });
}