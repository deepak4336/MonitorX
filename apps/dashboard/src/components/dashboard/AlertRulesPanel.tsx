'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Plus, Trash2, Mail, Hash } from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  trigger: string;
  channel: string;
  destination: string;
  is_active: boolean;
  cooldown_min: number;
  created_at: string;
  last_fired: string | null;
}

interface AlertRulesPanelProps {
  projectId: string;
  initialRules: AlertRule[];
}

const TRIGGER_LABELS: Record<string, string> = {
  new_issue: 'New Issue',
  regression: 'Regression',
  spike: 'Error Spike',
};

export default function AlertRulesPanel({ projectId, initialRules }: AlertRulesPanelProps) {
  const [rules, setRules] = useState(initialRules);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('new_issue');
  const [channel, setChannel] = useState('email');
  const [destination, setDestination] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, trigger, channel, destination, cooldown_min: cooldown }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setRules([data.data, ...rules]);
      setShowForm(false);
      setName('');
      setDestination('');
      router.refresh();
    } catch {
      setError('Failed to create alert rule');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/projects/${projectId}/alerts?id=${id}`, { method: 'DELETE' });
    setRules(rules.filter((r) => r.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {rules.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No alert rules yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors mx-auto"
          >
            <Plus className="w-3.5 h-3.5" /> Add Alert Rule
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border divide-y divide-border">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rule.name}</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {TRIGGER_LABELS[rule.trigger]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {rule.channel === 'email'
                      ? <Mail className="w-3 h-3" />
                      : <Hash className="w-3 h-3" />}
                    <span>{rule.destination}</span>
                    <span>· {rule.cooldown_min}min cooldown</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm border border-border hover:bg-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </button>
          )}
        </>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border p-4 space-y-3 bg-card">
          <h3 className="text-sm font-medium">New Alert Rule</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium">Rule Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New Error Alert"
                required
                className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Trigger</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm focus:outline-none"
              >
                <option value="new_issue">New Issue</option>
                <option value="regression">Regression</option>
                <option value="spike">Error Spike</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm focus:outline-none"
              >
                <option value="email">Email</option>
                <option value="slack">Slack Webhook</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium">
                {channel === 'email' ? 'Email Address' : 'Webhook URL'}
              </label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={channel === 'email' ? 'you@example.com' : 'https://hooks.slack.com/...'}
                required
                className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Cooldown (minutes)</label>
              <input
                type="number"
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
                min={1}
                className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-8 px-3 rounded-md text-sm border border-border hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-8 px-3 rounded-md text-sm bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}