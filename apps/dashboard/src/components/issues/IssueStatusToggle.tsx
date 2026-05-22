'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, EyeOff, AlertTriangle, RotateCcw } from 'lucide-react';

interface IssueStatusToggleProps {
  issueId: string;
  projectId: string;
  currentStatus: string;
}

export default function IssueStatusToggle({ issueId, projectId, currentStatus }: IssueStatusToggleProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(newStatus);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  function getStatusStyle(s: string) {
    switch (s) {
      case 'resolved':
        return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'ignored':
        return 'text-muted-foreground border-border bg-muted/30';
      case 'regressed':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      default:
        return 'text-destructive border-destructive/30 bg-destructive/10';
    }
  }

  function getStatusLabel(s: string) {
    switch (s) {
      case 'resolved': return 'Resolved';
      case 'ignored': return 'Ignored';
      case 'regressed': return 'Regressed';
      default: return 'Unresolved';
    }
  }

  function StatusIcon({ s }: { s: string }) {
    switch (s) {
      case 'resolved': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'ignored': return <EyeOff className="w-3.5 h-3.5" />;
      case 'regressed': return <RotateCcw className="w-3.5 h-3.5" />;
      default: return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  }

  const allStatuses = ['unresolved', 'resolved', 'ignored'];
  const otherStatuses = allStatuses.filter((s) => s !== status);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${getStatusStyle(status)}`}
      >
        <StatusIcon s={status} />
        {loading ? 'Updating…' : getStatusLabel(status)}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-card border rounded-lg shadow-lg overflow-hidden">
            {otherStatuses.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
              >
                <span className="text-muted-foreground">
                  <StatusIcon s={s} />
                </span>
                Mark as {getStatusLabel(s)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}