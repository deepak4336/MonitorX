'use client';

import { useState } from 'react';
import { Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface SDKTestClientProps {
  dsn: string;
  projectId: string;
}

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

const TEST_SCENARIOS = [
  {
    id: 'null-ref',
    label: 'Null Reference Error',
    description: 'Triggers a TypeError by accessing property on null',
    run: () => {
      const user = null as unknown as { name: string };
      console.log(user.name); // TypeError: Cannot read properties of null
    },
  },
  {
    id: 'custom',
    label: 'Custom Error',
    description: 'Sends a custom application error with extra context',
    run: () => {
      throw new Error('Payment processing failed: Invalid card number');
    },
  },
  {
    id: 'message',
    label: 'Warning Message',
    description: 'Sends a warning-level telemetry message',
    isMessage: true,
    run: () => 'User exceeded API rate limit (100 req/min)',
  },
] as const;

export default function SDKTestClient({ dsn, projectId }: SDKTestClientProps) {
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({});
  const [results, setResults] = useState<Record<string, string>>({});

  async function runTest(scenario: (typeof TEST_SCENARIOS)[number]) {
    setStatuses((s) => ({ ...s, [scenario.id]: 'loading' }));
    setResults((r) => ({ ...r, [scenario.id]: '' }));

    try {
      // Parse DSN to get ingest URL and public key
      const url = new URL(dsn);
      const publicKey = url.username;
      const ingestUrl = `${url.protocol}//${url.host}/api/events`;

      let payload: Record<string, unknown>;

      if (scenario.id === 'message') {
        const message = (scenario as { run: () => string }).run();
        payload = {
          event_id: crypto.randomUUID().replace(/-/g, ''),
          timestamp: new Date().toISOString(),
          platform: 'javascript',
          message,
          level: 'warning',
          environment: 'test',
          project_id: projectId,
          url: window.location.href,
          user_agent: navigator.userAgent,
        };
      } else {
        // Capture the error
        let capturedError: Error | null = null;
        try {
          scenario.run();
        } catch (err) {
          capturedError = err as Error;
        }

        if (!capturedError) {
          throw new Error('No error was thrown');
        }

        // Parse stack trace
        const frames = parseStack(capturedError.stack ?? '');

        payload = {
          event_id: crypto.randomUUID().replace(/-/g, ''),
          timestamp: new Date().toISOString(),
          platform: 'javascript',
          message: capturedError.message,
          level: 'error',
          environment: 'test',
          project_id: projectId,
          url: window.location.href,
          user_agent: navigator.userAgent,
          stacktrace: { frames },
        };
      }

      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MonitorX-Key': publicKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setStatuses((s) => ({ ...s, [scenario.id]: 'success' }));
        setResults((r) => ({
          ...r,
          [scenario.id]: `Event sent! ID: ${data.data.event_id.slice(0, 8)}…`,
        }));
      } else {
        throw new Error(data.error ?? 'Unknown error');
      }
    } catch (err) {
      setStatuses((s) => ({ ...s, [scenario.id]: 'error' }));
      setResults((r) => ({
        ...r,
        [scenario.id]: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }

  return (
    <div className="rounded-lg border divide-y divide-border">
      {TEST_SCENARIOS.map((scenario) => {
        const status = statuses[scenario.id] ?? 'idle';
        const result = results[scenario.id];

        return (
          <div key={scenario.id} className="flex items-center justify-between p-4 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{scenario.label}</p>
              <p className="text-xs text-muted-foreground">{scenario.description}</p>
              {result && (
                <p
                  className={`text-xs mt-1 font-mono ${
                    status === 'success' ? 'text-green-400' : 'text-destructive'
                  }`}
                >
                  {result}
                </p>
              )}
            </div>

            <button
              onClick={() => runTest(scenario)}
              disabled={status === 'loading'}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-border
                         hover:bg-accent disabled:opacity-50 transition-colors shrink-0"
            >
              {status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
              {status === 'error' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
              {status === 'idle' && <Play className="w-3.5 h-3.5" />}
              {status === 'loading' ? 'Sending…' : 'Trigger'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function parseStack(stack: string) {
  return stack
    .split('\n')
    .slice(1)
    .map((line) => {
      const match = line.trim().match(/^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (!match) return null;
      const [, fn, filename, lineno, colno] = match;
      return {
        filename: filename ?? '<unknown>',
        function: fn ?? '<anonymous>',
        lineno: lineno ? parseInt(lineno) : undefined,
        colno: colno ? parseInt(colno) : undefined,
        in_app: !filename?.includes('node_modules'),
      };
    })
    .filter(Boolean)
    .reverse();
}
