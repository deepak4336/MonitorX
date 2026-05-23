import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/layout/PageHeader';
import CreateOrgButton from '@/components/orgs/CreateOrgButton';
import { Building2, Users, Layers, Crown } from 'lucide-react';
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
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Manage your teams and workspaces"
        action={<CreateOrgButton />}
      />
      <div className="p-6">
        {memberships.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-base font-medium mb-1">No organizations yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create an organization to group your projects
            </p>
            <CreateOrgButton variant="outline" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberships.map(({ organization: org, role }: { organization: any; role: any }) => (
              <div key={org.id} className="rounded-lg border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-foreground/10 flex items-center justify-center text-sm font-bold">
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{org.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                    </div>
                  </div>
                  {role === 'owner' && (
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
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
                <p className="text-xs text-muted-foreground">
                  Created {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
