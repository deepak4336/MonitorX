import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';
import { Resend } from 'resend';
import { buildInviteEmailHtml } from '@/lib/emails/invite-email';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://monitorex.netlify.app';

interface Params { params: { orgId: string } }

// GET — list invites for an org
export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await prisma.organizationMember.findFirst({
    where: { organization_id: params.orgId, user_id: user.id },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const invites = await prisma.organizationInvite.findMany({
    where: { organization_id: params.orgId, status: 'pending' },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(invites)) });
}

// POST — send a new invite
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await prisma.organizationMember.findFirst({
    where: { organization_id: params.orgId, user_id: user.id, role: { in: ['owner', 'developer'] } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, role } = await request.json();
  if (!email || !role) return NextResponse.json({ error: 'Email and role required' }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id: params.orgId } });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.organizationMember.findFirst({
      where: { organization_id: params.orgId, user_id: existingUser.id },
    });
    if (alreadyMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.organizationInvite.findFirst({
    where: { organization_id: params.orgId, email, status: 'pending' },
  });
  if (existingInvite) {
    return NextResponse.json({ error: 'Invite already sent to this email' }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await prisma.organizationInvite.create({
    data: {
      organization_id: params.orgId,
      email,
      role,
      invited_by: user.email ?? user.id,
      expires_at: expiresAt,
    },
  });

  // Send invite email
  const inviteUrl = `${APP_URL}/invite/${invite.token}`;
  const html = buildInviteEmailHtml({
    organizationName: org.name,
    invitedByEmail: user.email ?? 'A team member',
    role,
    inviteUrl,
    expiresAt,
  });

  await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL ?? 'onboarding@resend.dev',
    to: email,
    subject: `You've been invited to join ${org.name} on MonitorX`,
    html,
  });

  return NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(invite)) });
}

// DELETE — revoke an invite
export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await prisma.organizationMember.findFirst({
    where: { organization_id: params.orgId, user_id: user.id, role: { in: ['owner', 'developer'] } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { inviteId } = await request.json();
  await prisma.organizationInvite.deleteMany({
    where: { id: inviteId, organization_id: params.orgId },
  });

  return NextResponse.json({ success: true });
}