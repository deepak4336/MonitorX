import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
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
      site_keys: { where: { is_active: true }, take: 1 },
      organization: { include: { members: { where: { user_id: user.id } } } },
      alert_rules: { orderBy: { created_at: 'desc' } },
      source_maps: {
        include: { release: { select: { version: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!project || project.organization.members.length === 0) redirect('/projects');

  const siteKey = project.site_keys[0]?.key ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://monitorex.netlify.app';

  const nodeSnippet = `// ─── MonitorX Node.js Integration ───────────────────
// Paste this at the top of your main server file (index.js / server.js / app.js)
// No npm install needed — uses built-in fetch (Node.js 18+)

const MONITORX_KEY = '${siteKey ?? 'YOUR_SITE_KEY_HERE'}';
const MONITORX_URL = '${appUrl}/api/events';

async function monitorx(error, context = {}) {
  try {
    const frames = (error?.stack || '').split('\\n').slice(1).map(line => ({
      filename: line.trim(),
      in_app: !line.includes('node_modules'),
    }));
    await fetch(MONITORX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MonitorX-Key': MONITORX_KEY,
      },
      body: JSON.stringify({
        message: error?.message || String(error),
        level: 'error',
        event_type: 'error',
        platform: 'node',
        environment: process.env.NODE_ENV || 'production',
        stacktrace: { frames },
        extra: context,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (_) {}
}

// Auto-capture all unhandled errors
process.on('uncaughtException', (err) => {
  monitorx(err, { type: 'uncaughtException' });
});
process.on('unhandledRejection', (reason) => {
  monitorx(reason instanceof Error ? reason : new Error(String(reason)), {
    type: 'unhandledRejection',
  });
});`;

  const expressSnippet = `// ─── MonitorX Express.js Error Middleware ────────────
// Add this AFTER all your routes in your Express app

app.use(async (err, req, res, next) => {
  const frames = (err?.stack || '').split('\\n').slice(1).map(line => ({
    filename: line.trim(),
    in_app: !line.includes('node_modules'),
  }));
  await fetch('${appUrl}/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MonitorX-Key': '${siteKey ?? 'YOUR_SITE_KEY_HERE'}',
    },
    body: JSON.stringify({
      message: err.message,
      level: 'error',
      event_type: 'error',
      platform: 'node',
      environment: process.env.NODE_ENV || 'production',
      url: req.url,
      timestamp: new Date().toISOString(),
      stacktrace: { frames },
      extra: {
        method: req.method,
        statusCode: err.status || 500,
        userId: req.user?.id,
        body: req.body,
      },
    }),
  }).catch(() => {});

  res.status(err.status || 500).json({ error: err.message });
});`;

  const manualSnippet = `// ─── MonitorX Manual Capture ─────────────────────────
// Use this anywhere in your Node.js code to capture errors manually

// Capture in try/catch blocks:
try {
  await stripe.charges.create({ amount, currency });
} catch (error) {
  await monitorx(error, {
    service: 'stripe',
    userId: req.user.id,
    amount,
    currency,
  });
}

// Capture in cron jobs:
cron.schedule('0 0 * * *', async () => {
  try {
    await sendDailyReports();
  } catch (error) {
    await monitorx(error, {
      job: 'daily-reports',
      scheduledAt: new Date().toISOString(),
    });
  }
});

// Capture database errors:
mongoose.connection.on('error', (error) => {
  monitorx(error, {
    type: 'database_connection',
    host: process.env.DB_HOST,
  });
});`;

  const pythonSnippet = `# ─── MonitorX Python Integration ──────────────────────
# Works with Django, Flask, FastAPI, or any Python app
# No pip install needed — uses built-in urllib

import urllib.request
import json
import traceback
import os
from datetime import datetime

MONITORX_KEY = '${siteKey ?? 'YOUR_SITE_KEY_HERE'}'
MONITORX_URL = '${appUrl}/api/events'

def monitorx(error, context={}):
    try:
        frames = [{'filename': line.strip(), 'in_app': 'site-packages' not in line}
                  for line in traceback.format_tb(error.__traceback__)]
        payload = json.dumps({
            'message': str(error),
            'level': 'error',
            'event_type': 'error',
            'platform': 'python',
            'environment': os.getenv('ENVIRONMENT', 'production'),
            'timestamp': datetime.utcnow().isoformat(),
            'stacktrace': {'frames': frames},
            'extra': context,
        }).encode('utf-8')
        req = urllib.request.Request(
            MONITORX_URL,
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'X-MonitorX-Key': MONITORX_KEY,
            },
            method='POST'
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass

# Usage:
try:
    result = stripe.charge.create(amount=amount, currency='usd')
except Exception as e:
    monitorx(e, {'service': 'stripe', 'user_id': user_id})`;

  const nextjsSnippet = `// ─── MonitorX Next.js Integration ───────────────────
// Add to your Next.js API routes for server-side error capture

// 1. Create lib/monitorx.ts in your Next.js project:
const MONITORX_KEY = '${siteKey ?? 'YOUR_SITE_KEY_HERE'}';
const MONITORX_URL = '${appUrl}/api/events';

export async function monitorx(error: Error, context = {}) {
  try {
    const frames = (error?.stack || '').split('\\n').slice(1).map(line => ({
      filename: line.trim(),
      in_app: !line.includes('node_modules'),
    }));
    await fetch(MONITORX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MonitorX-Key': MONITORX_KEY,
      },
      body: JSON.stringify({
        message: error.message,
        level: 'error',
        event_type: 'error',
        platform: 'node',
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
        stacktrace: { frames },
        extra: context,
      }),
    });
  } catch (_) {}
}

// 2. Use in your API routes:
// app/api/payment/route.ts
import { monitorx } from '@/lib/monitorx';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await processPayment(body);
    return Response.json({ success: true, data: result });
  } catch (error) {
    await monitorx(error as Error, {
      endpoint: '/api/payment',
      userId: 'user_123',
    });
    return Response.json({ error: 'Payment failed' }, { status: 500 });
  }
}`;

  const INTEGRATIONS = [
    {
      id: 'nodejs',
      label: 'Node.js',
      badge: 'Server',
      badgeColor: 'text-green-400 bg-green-500/10 border-green-500/20',
      description: 'Capture unhandled exceptions and promise rejections in any Node.js app.',
      snippet: nodeSnippet,
    },
    {
      id: 'express',
      label: 'Express.js',
      badge: 'Server',
      badgeColor: 'text-green-400 bg-green-500/10 border-green-500/20',
      description: 'Add error middleware to automatically capture all Express route errors.',
      snippet: expressSnippet,
    },
    {
      id: 'manual',
      label: 'Manual Capture',
      badge: 'Node.js',
      badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      description: 'Manually capture errors in try/catch blocks, cron jobs, or database connections.',
      snippet: manualSnippet,
    },
    {
      id: 'python',
      label: 'Python',
      badge: 'Server',
      badgeColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      description: 'Works with Django, Flask, FastAPI, or any Python backend. No pip install needed.',
      snippet: pythonSnippet,
    },
    {
      id: 'nextjs',
      label: 'Next.js API Routes',
      badge: 'Server',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      description: 'Capture server-side errors in Next.js API routes and server actions.',
      snippet: nextjsSnippet,
    },
  ];

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

        {/* Site Key */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Site Key</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use this key to authenticate MonitorX on your website.
            </p>
          </div>
          {siteKey ? (
            <code className="block font-mono text-xs bg-muted px-3 py-2.5 rounded-md border truncate">
              {siteKey}
            </code>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground mb-3">No site key generated yet.</p>
              <GenerateSiteKeyButton projectId={project.id} />
            </div>
          )}
        </section>

        {/* Script Installation */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Browser Script Installation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add this snippet to the <code className="bg-muted px-1 rounded">&lt;head&gt;</code> of your website. No npm install needed.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 overflow-auto">
            <pre className="font-mono text-xs p-4 leading-relaxed">{`<script
  src="${appUrl}/monitorx.js"
  data-monitorx-key="${siteKey ?? 'YOUR_SITE_KEY_HERE'}">
</script>`}</pre>
          </div>
        </section>

        {/* Backend Integrations */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Backend Integrations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capture server-side errors from your backend. No SDK or npm install needed — just paste the snippet.
            </p>
          </div>

          <div className="space-y-3">
            {INTEGRATIONS.map((integration) => (
              <details key={integration.id} className="rounded-lg border border-border bg-card group">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-accent/30 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{integration.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${integration.badgeColor}`}>
                      {integration.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{integration.description.slice(0, 40)}...</span>
                    <svg className="w-3.5 h-3.5 text-muted-foreground group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                  <div className="rounded-lg border bg-muted/30 overflow-auto max-h-80">
                    <pre className="font-mono text-xs p-4 leading-relaxed whitespace-pre">{integration.snippet}</pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* SDK Test */}
        {siteKey && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Test Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send test events to verify your Site Key and /api/events endpoint are working correctly. Remove this section before going to production.
              </p>
            </div>
            <SDKTestClient dsn={siteKey} projectId={project.id} />
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

function GenerateSiteKeyButton({ projectId }: { projectId: string }) {
  return (
    <form action={async () => {
      'use server';
      const { prisma } = await import('@/lib/prisma');
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let key = 'mx_live_';
      for (let i = 0; i < 16; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
      }
      await prisma.siteKey.create({
        data: { project_id: projectId, key, label: 'Default Key' },
      });
      const { revalidatePath } = await import('next/cache');
      revalidatePath(`/projects/${projectId}/settings`);
    }}>
      <button
        type="submit"
        className="h-8 px-4 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
      >
        Generate Site Key
      </button>
    </form>
  );
}