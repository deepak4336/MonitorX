import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { buildDsn } from '@/lib/utils';
import PageHeader from '@/components/layout/PageHeader';
import SDKTestClient from '@/components/dashboard/SDKTestClient';
import AlertRulesPanel from '@/components/dashboard/AlertRulesPanel';
import SourceMapUploader from '@/components/dashboard/SourceMapUploader';
import Link from 'next/link';
import { Package } from 'lucide-react';

interface Props { params: { projectId: string } }

export default async function ProjectSettingsPage({ params }: Props) {
  const user = await getUser();
  if (!user) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      api_keys: { where: { is_active: true }, take: 1 },
      organization: { include: { members: { where: { user_id: user.id } } } },
      alert_rules: { orderBy: { created_at: 'desc' } },
      source_maps: {
        include: { release: { select: { version: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!project || project.organization.members.length === 0) redirect('/projects');

  const dsn = project.api_keys[0]
    ? buildDsn(project.api_keys[0].public_key, project.id)
    : null;

  return (
    <div>
      <PageHeader
        title="Project Settings"
        description={`${project.name} · ${project.environment}`}
        action={
          <Link
            href={`/projects/${params.projectId}/releases`}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm border border-border hover:bg-accent transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            Releases
          </Link>
        }
      />
      <div className="p-6 space-y-10 max-w-3xl">

        {/* DSN */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">DSN (Data Source Name)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Use this to initialize the SDK.</p>
          </div>
          {dsn && (
            <code className="block font-mono text-xs bg-muted px-3 py-2.5 rounded-md border truncate">
              {dsn}
            </code>
          )}
        </section>

        {/* Integration snippet */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">SDK Integration (Phase 2)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Full Phase 2 initialization with all features.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 overflow-auto">
            <pre className="font-mono text-xs p-4 leading-relaxed">{`import * as MonitorX from "@monitorx/browser";

MonitorX.init({
  dsn: "${dsn ?? 'YOUR_DSN_HERE'}",
  environment: "${project.environment}",
  release: "v1.0.0",
  debug: false,
  sampleRate: 1.0,
  maxBreadcrumbs: 50,
});

// Set user context after login
MonitorX.setUser({ id: "123", email: "user@example.com" });

// Add tags for filtering
MonitorX.setTag("plan", "premium");
MonitorX.setTag("region", "india");

// Manual captures
MonitorX.captureException(new Error("Something broke"));
MonitorX.captureMessage("Checkout completed", "info");`}</pre>
          </div>
        </section>

        {/* SDK Test */}
        {dsn && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Test SDK Integration</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send test events to verify the pipeline.
              </p>
            </div>
            <SDKTestClient dsn={dsn} projectId={project.id} />
          </section>
        )}

        {/* Source Maps */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Source Maps</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload source maps to resolve minified stack traces.
            </p>
          </div>
          <SourceMapUploader
            projectId={project.id}
            existingMaps={project.source_maps.map((sm) => ({
              id: sm.id,
              filename: sm.filename,
              release: (sm.release as any)?.version ?? null,
              created_at: sm.created_at.toISOString(),
            }))}
          />
        </section>

        {/* Alert Rules */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Alert Rules</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified via email or Slack when issues occur.
            </p>
          </div>
          <AlertRulesPanel
            projectId={project.id}
            initialRules={project.alert_rules.map((r) => ({
              ...r,
              last_fired: r.last_fired?.toISOString() ?? null,
              created_at: r.created_at.toISOString(),
            }))}
          />
        </section>

        {/* Project Details */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Project Details</h2>
          <div className="rounded-lg border divide-y divide-border">
            {[
              { label: 'Project ID', value: project.id },
              { label: 'Slug', value: project.slug },
              { label: 'Environment', value: project.environment },
              { label: 'Organization', value: project.organization.name },
              { label: 'Created', value: new Date(project.created_at).toLocaleDateString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}