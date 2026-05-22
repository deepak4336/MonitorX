'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { cn, slugify } from '@/lib/utils';

interface CreateOrgButtonProps {
  variant?: 'default' | 'outline';
}

export default function CreateOrgButton({ variant = 'default' }: CreateOrgButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleNameChange(v: string) {
    setName(v);
    setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: slug || slugify(name) }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Failed to create organization');
        return;
      }
      setOpen(false);
      setName('');
      setSlug('');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
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
        New Organization
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-card border rounded-lg shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Create Organization</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Organization Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Corp"
                  required
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm
                             focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-corp"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono
                             focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Used in URLs. Only lowercase letters, numbers, and hyphens.</p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

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
                  className="h-8 px-3 rounded-md text-sm bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
