import PageHeader from '@/components/layout/PageHeader';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

const FEATURES = [
  {
    category: 'Core Platform',
    items: [
      { name: 'User Authentication (Login/Register)', status: 'done' },
      { name: 'Organizations & Projects', status: 'done' },
      { name: 'DSN / API Key Generation', status: 'done' },
      { name: 'Dark Mode UI', status: 'done' },
      { name: 'Team Member Invitations', status: 'planned' },
      { name: 'User Roles & Permissions', status: 'planned' },
      { name: 'SSO / OAuth Login', status: 'future' },
    ],
  },
  {
    category: 'Error Monitoring',
    items: [
      { name: 'Error Capture & Storage', status: 'done' },
      { name: 'Stack Trace Viewer', status: 'done' },
      { name: 'Issue Grouping & Fingerprinting', status: 'done' },
      { name: 'Issue Status (Resolved / Ignored)', status: 'done' },
      { name: 'Regressed Status Detection', status: 'done' },
      { name: 'Occurrence Count Tracking', status: 'done' },
      { name: 'First / Last Seen Timestamps', status: 'done' },
      { name: 'Environment Separation', status: 'done' },
      { name: 'Event Level (fatal/error/warning/info)', status: 'done' },
      { name: 'Search & Filter Issues', status: 'planned' },
      { name: 'Issue Assignment to Team Members', status: 'planned' },
      { name: 'Issue Comments & Activity Log', status: 'planned' },
    ],
  },
  {
    category: 'Browser SDK',
    items: [
      { name: 'Auto Error Capture (window.onerror)', status: 'done' },
      { name: 'Unhandled Promise Rejection Capture', status: 'done' },
      { name: 'Manual captureException()', status: 'done' },
      { name: 'Manual captureMessage()', status: 'done' },
      { name: 'User Context (setUser)', status: 'done' },
      { name: 'Tags (setTag)', status: 'done' },
      { name: 'Custom Context (setContext)', status: 'done' },
      { name: 'Breadcrumb Auto-capture', status: 'done' },
      { name: 'PII Scrubbing', status: 'done' },
      { name: 'Sample Rate Support', status: 'done' },
      { name: 'Retry Queue', status: 'done' },
      { name: 'beforeSend Hook', status: 'done' },
      { name: 'React Error Boundary', status: 'done' },
      { name: 'npm Package Publishing', status: 'planned' },
      { name: 'React Native / Mobile SDK', status: 'future' },
      { name: 'Node.js Server SDK', status: 'future' },
    ],
  },
  {
    category: 'Developer Tools',
    items: [
      { name: 'Source Maps Upload', status: 'done' },
      { name: 'Stack Trace Resolution', status: 'done' },
      { name: 'Release Tracking', status: 'done' },
      { name: 'Breadcrumb Timeline UI', status: 'done' },
      { name: 'Raw Event Payload Viewer', status: 'done' },
      { name: 'Browser / OS Detection', status: 'done' },
      { name: 'SDK Test Tool', status: 'done' },
      { name: 'GitHub Integration (link commits)', status: 'future' },
      { name: 'Jira / Linear Integration', status: 'future' },
      { name: 'CodeOwners Support', status: 'future' },
    ],
  },
  {
    category: 'Alerts & Notifications',
    items: [
      { name: 'Alert Rules Configuration', status: 'done' },
      { name: 'Slack Webhook Alerts', status: 'done' },
      { name: 'Alert Cooldowns', status: 'done' },
      { name: 'New Issue Trigger', status: 'done' },
      { name: 'Regression Trigger', status: 'done' },
      { name: 'Email Sending (Resend/SendGrid)', status: 'planned' },
      { name: 'PagerDuty Integration', status: 'future' },
      { name: 'Custom Webhook Outbound', status: 'future' },
    ],
  },
  {
    category: 'Dashboard & Analytics',
    items: [
      { name: 'Issues List with Filters', status: 'done' },
      { name: 'Issue Detail Page', status: 'done' },
      { name: 'Release Overview Page', status: 'done' },
      { name: 'Error Rate Charts', status: 'planned' },
      { name: 'Issues Over Time Graph', status: 'planned' },
      { name: 'Affected Users Stats', status: 'planned' },
      { name: 'Custom Dashboards', status: 'future' },
      { name: 'Export Reports (CSV/PDF)', status: 'future' },
    ],
  },
  {
    category: 'Performance Monitoring',
    items: [
      { name: 'Transaction Tracing', status: 'future' },
      { name: 'Web Vitals (LCP, FID, CLS)', status: 'future' },
      { name: 'Slow Query Detection', status: 'future' },
      { name: 'API Response Time Tracking', status: 'future' },
      { name: 'Frontend Performance Spans', status: 'future' },
    ],
  },
  {
    category: 'Advanced Features',
    items: [
      { name: 'Session Replay', status: 'future' },
      { name: 'Uptime Monitoring', status: 'future' },
      { name: 'Cron Job Monitoring', status: 'future' },
      { name: 'Distributed Tracing', status: 'future' },
      { name: 'AI Issue Summary', status: 'future' },
      { name: 'Rate Limiting', status: 'future' },
      { name: 'Data Retention Policies', status: 'future' },
      { name: 'Kafka + ClickHouse Pipeline', status: 'future' },
    ],
  },
];

const STATUS_CONFIG = {
  done: {
    label: 'Built',
    icon: CheckCircle2,
    className: 'text-green-400',
    badgeClass: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  planned: {
    label: 'Phase 3',
    icon: Clock,
    className: 'text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  future: {
    label: 'Roadmap',
    icon: XCircle,
    className: 'text-muted-foreground',
    badgeClass: 'bg-muted/50 text-muted-foreground border-border',
  },
};

export default function FeaturesPage() {
  const totalDone = FEATURES.flatMap(f => f.items).filter(i => i.status === 'done').length;
  const totalPlanned = FEATURES.flatMap(f => f.items).filter(i => i.status === 'planned').length;
  const totalFuture = FEATURES.flatMap(f => f.items).filter(i => i.status === 'future').length;
  const total = totalDone + totalPlanned + totalFuture;
  const percentage = Math.round((totalDone / total) * 100);

  return (
    <div>
      <PageHeader
        title="Features"
        description="MonitorX vs Sentry — what's built and what's coming"
      />

      <div className="p-6 space-y-8 max-w-4xl">

        {/* Progress Overview */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">Overall Progress vs Sentry</h2>

          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span><strong className="text-green-400">{totalDone}</strong> Built</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span><strong className="text-amber-400">{totalPlanned}</strong> Phase 3 (Next)</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-muted-foreground" />
              <span><strong className="text-muted-foreground">{totalFuture}</strong> Roadmap</span>
            </div>
            <div className="ml-auto">
              <span className="text-2xl font-bold text-green-400">{percentage}%</span>
              <span className="text-muted-foreground text-sm ml-1">complete</span>
            </div>
          </div>
        </div>

        {/* Feature Categories */}
        {FEATURES.map((category) => {
          const categoryDone = category.items.filter(i => i.status === 'done').length;
          return (
            <div key={category.category} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{category.category}</h2>
                <span className="text-xs text-muted-foreground">
                  {categoryDone}/{category.items.length} built
                </span>
              </div>

              <div className="rounded-lg border divide-y divide-border">
                {category.items.map((item) => {
                  const config = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG];
                  const Icon = config.icon;
                  return (
                    <div key={item.name} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 shrink-0 ${config.className}`} />
                        <span className={`text-sm ${item.status === 'future' ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border ${config.badgeClass}`}>
                        {config.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}