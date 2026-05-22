'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Org {
  id: string;
  name: string;
}

interface CreateProjectButtonProps {
  organizations: Org[];
  variant?: 'default' | 'outline';
}

export default function CreateProjectButton({ organizations, variant = 'default' }: CreateProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? '');
  const [environment, setEnvironment] = useState('production');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !orgId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, organization_id: orgId, environment }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? 'Failed to create project');
        return;
      }

      setOpen(false);
      setName('');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (organizations.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors',
          variant === 'default'
            ? 'bg-foreground text-background hover:bg-foreground/90'
            : 'border border-border hover:bg-accent'
        )}
      >
        <Plus className="w-4 h-4" />
        New Project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-card border rounded-lg shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Create Project</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My Web App"
                  required
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm
                             focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Organization</label>
                <select
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm
                             focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Environment</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm
                             focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 px-3 rounded-md text-sm border border-border hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-8 px-3 rounded-md text-sm bg-foreground text-background 
                             hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
