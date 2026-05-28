'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

export default function AcceptInviteButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleAccept() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/invite/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept invite');
        return;
      }
      router.push('/projects');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-4 py-3 rounded-lg font-semibold text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
      >
        <CheckCircle2 className="w-4 h-4" />
        {loading ? 'Accepting...' : 'Accept Invitation'}
      </button>
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
}