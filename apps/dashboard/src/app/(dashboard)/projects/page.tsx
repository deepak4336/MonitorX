import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/layout/PageHeader';
import CreateProjectButton from '@/components/projects/CreateProjectButton';
import { Layers, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default async function ProjectsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const memberships = await prisma.organizationMember.findMany({
    where: { user_id: user.id },
    include: {
      organization: {
        include: {
          projects: {
            include: {
              site_keys: { where: { is_active: true }, take: 1 },
              _count: {
                select: {
                  issues: { where: { status: 'unresolved' } },
                  events: true,
                },
              },
            },
            orderBy: { created_at: 'desc' },
          },
        },
      },
    },
  });

  const orgs = memberships.map((m) => ({
    ...m.organization,
    role: m.role,
    projects: m.organization.projects.map((p) => ({
      ...p,
      site_key: p.site_keys[0]?.key ?? null,
      unresolved_count: p._count.issues,
      event_count: p._count.events,
    })),
  }));

  const allProjects = orgs.flatMap((o) =>
    o.projects.map((p) => ({ ...p, org_name: o.name, org_slug: o.slug }))
  );

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Monitor errors across all your applications"
        action={<CreateProjectButton organizations={orgs} />}
      />

      <div className="p-6">
        {allProjects.length === 0 ? (
          <div className="text-center py-20">
            <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-base font-medium mb-1">No projects yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first project to start capturing errors
            </p>
            <CreateProjectButton organizations={orgs} variant="outline" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/issues`}
                className="group block rounded-lg border bg-card hover:border-foreground/20 transition-all p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-sm group-hover:text-foreground transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {project.org_name} · {project.environment}
                    </p>
                  </div>
                  {project.unresolved_count > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {project.unresolved_count}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {project.unresolved_count} unresolved
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                  </span>
                </div>

                {project.site_key && (
                  <code className="block text-xs text-muted-foreground bg-muted px-2 py-1.5 rounded font-mono truncate">
                    {project.site_key}
                  </code>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}