'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileCode, CheckCircle2 } from 'lucide-react';

interface SourceMapEntry {
  id: string;
  filename: string;
  release: string | null;
  created_at: string;
}

interface SourceMapUploaderProps {
  projectId: string;
  existingMaps: SourceMapEntry[];
}

export default function SourceMapUploader({ projectId, existingMaps }: SourceMapUploaderProps) {
  const [maps, setMaps] = useState(existingMaps);
  const [filename, setFilename] = useState('');
  const [release, setRelease] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(
      file.name.replace('.map', '').replace('.js.map', '.js')
    );
    const reader = new FileReader();
    reader.onload = (ev) => setContent(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!filename || !content) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/sourcemaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          filename,
          release: release || undefined,
          content,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setSuccess(true);
      setFilename('');
      setRelease('');
      setContent('');
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleUpload} className="rounded-lg border p-4 space-y-3 bg-card">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-medium">Source Map File (.map)</label>
            <input
              type="file"
              accept=".map,.js.map"
              onChange={handleFileChange}
              className="w-full h-8 px-3 rounded-md border border-border bg-background text-xs
                         file:mr-2 file:text-xs file:border-0 file:bg-muted file:px-2 file:py-1 file:rounded cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Filename (minified JS)</label>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="app.min.js"
              className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm
                         focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Release (optional)</label>
            <input
              value={release}
              onChange={(e) => setRelease(e.target.value)}
              placeholder="v1.0.0"
              className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm
                         focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={loading || !filename || !content}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm bg-foreground text-background
                     hover:bg-foreground/90 disabled:opacity-50 transition-colors"
        >
          {success ? (
            <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Uploaded!</>
          ) : loading ? 'Uploading...' : (
            <><Upload className="w-3.5 h-3.5" /> Upload Source Map</>
          )}
        </button>
      </form>

      {maps.length > 0 && (
        <div className="rounded-lg border divide-y divide-border">
          {maps.map((sm) => (
            <div key={sm.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-sm font-mono">{sm.filename}</span>
                  {sm.release && (
                    <span className="ml-2 text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {sm.release}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(sm.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}