import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/layout/PageHeader';
import CreateOrgButton from '@/components/orgs/CreateOrgButton';
import InviteMemberButton from '@/components/invites/InviteMemberButton';
import { Building2, Users, Layers, Crown, Mail, Clock, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default async function OrganizationsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const memberships = await prisma.organizationMember.findMany({
    where: { user_id: user.id },
    include: {
      organization: {
        include: {
          _count: { select: { projects: true, members: true } },
          invites: {
            where: { status: 'pending' },
            orderBy: { created_at: 'desc' },
          },
          members: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify(memberships));

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Manage your teams and workspaces"
        action={<CreateOrgButton />}
      />
      <div className="p-6">
        {serialized.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-base font-medium mb-1">No organizations yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create an organization to group your projects
            </p>
            <CreateOrgButton variant="outline" />
          </div>
        ) : (
          <div className="space-y-6">
            {serialized.map(({ organization: org, role }: { organization: any; role: any }) => (
              <div key={org.id} className="rounded-lg border bg-card overflow-hidden">

                {/* Org header */}
                <div className="flex items-start justify-between p-5 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-foreground/10 flex items-center justify-center text-sm font-bold">
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{org.name}</h3>
                        {role === 'owner' && (
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        {org._count.projects} projects
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {org._count.members} members
                      </span>
                    </div>
                    {(role === 'owner' || role === 'developer') && (
                      <InviteMemberButton orgId={org.id} onInviteSent={() => {}} />
                    )}
                  </div>
                </div>

                {/* Members list */}
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Members
                  </p>
                  <div className="space-y-2">
                    {org.members.map((member: any) => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-medium">
                            {(member.user.name ?? member.user.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            {member.user.name && (
                              <p className="text-xs font-medium">{member.user.name}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{member.user.email}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded border capitalize ${
                          member.role === 'owner'
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                            : member.role === 'developer'
                            ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                            : 'text-gray-400 bg-gray-500/10 border-gray-500/20'
                        }`}>
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pending invites */}
                {org.invites.length > 0 && (
                  <div className="px-5 py-4 border-t border-border bg-muted/20">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      Pending Invites ({org.invites.length})
                    </p>
                    <div className="space-y-2">
                      {org.invites.map((invite: any) => (
                        <div key={invite.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs">{invite.email}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${
                              invite.role === 'developer'
                                ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                : 'text-gray-400 bg-gray-500/10 border-gray-500/20'
                            }`}>
                              {invite.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>
                              Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-5 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                  </p>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}