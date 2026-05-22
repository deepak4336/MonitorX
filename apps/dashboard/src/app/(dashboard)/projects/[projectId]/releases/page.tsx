import { redirect, notFound } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/layout/PageHeader';
import { formatDistanceToNow, format } from 'date-fns';
import { Package, AlertTriangle, Zap } from 'lucide-react';
import Link from 'next/link';

interface Props { params: { projectId: string } }

export default async function ReleasesPage({ params }: Props) {
  const user = await getUser();
  if (!user) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      organization: {
        include: { members: { where: { user_id: user.id } } },
      },
    },
  });

  if (!project || project.organization.members.length === 0) notFound();

  const releases = await prisma.release.findMany({
    where: { project_id: params.projectId },
    include: {
      _count: { select: { events: true, issues: true } },
    },
    orderBy: { deployed_at: 'desc' },
    take: 30,
  });

  return (
    <div>
      <PageHeader
        title="Releases"
        description={`${project.name} · version history`}
        action={
          <Link
            href={`/projects/${params.projectId}/issues`}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm border border-border hover:bg-accent transition-colors"
          >
            ← Issues
          </Link>
        }
      />

      <div className="p-6">
        {releases.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-base font-medium mb-1">No releases yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Initialize your SDK with a <code className="font-mono bg-muted px-1 rounded">release</code> to track versions.
            </p>
            <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-left max-w-md mx-auto">
              <pre className="text-xs font-mono">{`MonitorX.init({
  dsn: "your-dsn",
  release: "v1.0.0",
  environment: "production"
});`}</pre>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border divide-y divide-border">
            {releases.map((release, i) => (
              <div
                key={release.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{release.version}</span>
                      {i === 0 && (
                        <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">
                          Latest
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Deployed {formatDistanceToNow(new Date(release.deployed_at), { addSuffix: true })} · {release.environment}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-semibold">{release._count.issues}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">issues</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-semibold">{release._count.events.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">events</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {format(new Date(release.deployed_at), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}