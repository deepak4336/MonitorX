'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Globe, MousePointer, Terminal, Wifi, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';

interface Breadcrumb {
  type: string;
  category: string;
  message: string;
  level?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface BreadcrumbTimelineProps {
  breadcrumbs: Breadcrumb[];
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'navigation': { icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'ui.click': { icon: MousePointer, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  'console': { icon: Terminal, color: 'text-green-400', bg: 'bg-green-500/10' },
  'http': { icon: Wifi, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'error': { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  'info': { icon: Info, color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

export default function BreadcrumbTimeline({ breadcrumbs }: BreadcrumbTimelineProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!breadcrumbs.length) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No breadcrumbs recorded for this event.</p>
      </div>
    );
  }

  const sorted = [...breadcrumbs].reverse();

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Breadcrumbs ({breadcrumbs.length})
        </span>
        <span className="text-xs text-muted-foreground">Most recent first</span>
      </div>

      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {sorted.map((crumb, i) => {
          const cfg = TYPE_CONFIG[crumb.type] ?? TYPE_CONFIG['info'];
          const Icon = cfg.icon;
          const isExpanded = expanded === i;
          const hasData = crumb.data && Object.keys(crumb.data).length > 0;

          return (
            <div key={i} className="group">
              <button
                onClick={() => hasData && setExpanded(isExpanded ? null : i)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                  hasData ? 'hover:bg-muted/20 cursor-pointer' : 'cursor-default'
                )}
              >
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                  <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{crumb.category}</span>
                    {crumb.level === 'error' && (
                      <span className="text-xs px-1 py-0 rounded bg-destructive/15 text-destructive border border-destructive/20">
                        error
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground mt-0.5 truncate">{crumb.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {new Date(crumb.timestamp).toLocaleTimeString()}
                  </span>
                  {hasData && (
                    isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && hasData && (
                <div className="px-4 pb-3">
                  <div className="ml-9 rounded-md bg-muted/30 p-2 border">
                    <pre className="text-xs font-mono text-muted-foreground overflow-auto">
                      {JSON.stringify(crumb.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}