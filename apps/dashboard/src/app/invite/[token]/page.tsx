import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { CheckCircle2, XCircle, Users } from 'lucide-react';
import AcceptInviteButton from '@/components/invites/AcceptInviteButton';

interface Props { params: { token: string } }

export default async function InvitePage({ params }: Props) {
  const invite = await prisma.organizationInvite.findUnique({
    where: { token: params.token },
    include: { organization: true },
  });

  // Invalid token
  if (!invite) {
    return <InviteError message="This invite link is invalid or doesn't exist." />;
  }

  // Already used
  if (invite.status === 'accepted') {
    return <InviteError message="This invite has already been accepted." />;
  }

  // Expired
  if (invite.status === 'expired' || new Date() > invite.expires_at) {
    return <InviteError message="This invite link has expired. Ask the org owner to send a new one." />;
  }

  const user = await getUser();

  // Not logged in — redirect to register with token
  if (!user) {
    redirect(`/register?invite=${params.token}`);
  }

  // Already a member
  const alreadyMember = await prisma.organizationMember.findFirst({
    where: { organization_id: invite.organization_id, user_id: user.id },
  });
  if (alreadyMember) {
    redirect('/projects');
  }

  const roleColors: Record<string, string> = {
    owner: 'text-red-400 bg-red-500/10 border-red-500/20',
    developer: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    viewer: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card overflow-hidden">

          {/* Header */}
          <div className="bg-muted/30 px-6 py-5 border-b border-border text-center">
            <div className="w-12 h-12 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-background" />
            </div>
            <h1 className="text-lg font-semibold">You're invited!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {invite.invited_by} invited you to join
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Organization</p>
                <p className="font-semibold">{invite.organization.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-0.5">Your role</p>
                <span className={`text-xs px-2 py-1 rounded border font-medium capitalize ${roleColors[invite.role] ?? roleColors.developer}`}>
                  {invite.role}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Accepting as <strong className="text-foreground">{user.email}</strong>
            </p>

            <AcceptInviteButton token={params.token} />

            <div className="text-center">
              <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Decline and go to projects
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-4">
        <XCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h1 className="text-lg font-semibold">Invalid Invite</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link href="/projects" className="inline-block text-sm border border-border px-4 py-2 rounded-lg hover:bg-accent transition-colors">
          Go to Projects
        </Link>
      </div>
    </div>
  );
}