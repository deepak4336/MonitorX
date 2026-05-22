'use client';

import { Globe, Monitor, User, Tag, Package } from 'lucide-react';
import { format } from 'date-fns';

interface EventContextPanelProps {
  event: {
    url?: string | null;
    user_agent?: string | null;
    user_context?: Record<string, unknown> | null;
    tags?: Record<string, string> | null;
    contexts?: Record<string, unknown> | null;
    release?: string | null;
    environment: string;
    timestamp: string | Date;
  };
}

export default function EventContextPanel({ event }: EventContextPanelProps) {
  const browser = (event.contexts as any)?.browser;
  const os = (event.contexts as any)?.os;
  const user = event.user_context as Record<string, string> | null;
  const tags = event.tags as Record<string, string> | null;

  const sections = [
    {
      title: 'Request',
      icon: Globe,
      show: !!event.url,
      rows: [
        { label: 'URL', value: event.url },
        { label: 'Environment', value: event.environment },
        { label: 'Timestamp', value: format(new Date(event.timestamp), 'PPpp') },
      ].filter((r) => r.value),
    },
    {
      title: 'Browser',
      icon: Monitor,
      show: !!(browser || event.user_agent),
      rows: [
        { label: 'Browser', value: browser ? `${browser.name} ${browser.version}` : null },
        { label: 'OS', value: os?.name },
        { label: 'User Agent', value: event.user_agent },
      ].filter((r) => r.value),
    },
    {
      title: 'User',
      icon: User,
      show: !!user,
      rows: [
        { label: 'ID', value: user?.id },
        { label: 'Email', value: user?.email },
        { label: 'Username', value: user?.username },
      ].filter((r) => r.value),
    },
    {
      title: 'Release',
      icon: Package,
      show: !!event.release,
      rows: [
        { label: 'Version', value: event.release },
      ].filter((r) => r.value),
    },
  ].filter((s) => s.show);

  return (
    <div className="space-y-4">
      {sections.map(({ title, icon: Icon, rows }) => (
        <div key={title} className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {title}
            </span>
          </div>
          <div className="divide-y divide-border">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-start gap-4 px-4 py-2.5">
                <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
                <span className="text-xs font-mono break-all flex-1">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {tags && Object.keys(tags).length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags</span>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {Object.entries(tags).map(([key, value]) => (
              <span key={key} className="inline-flex items-center gap-1 text-xs bg-muted/50 border rounded px-2 py-1 font-mono">
                <span className="text-muted-foreground">{key}</span>
                <span className="text-foreground/60">=</span>
                <span>{value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}