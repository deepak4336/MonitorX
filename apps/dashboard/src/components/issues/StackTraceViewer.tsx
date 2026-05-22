'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface StackFrame {
  filename: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
  resolved_filename?: string;
  resolved_lineno?: number;
  resolved_colno?: number;
  resolved_function?: string;
}

interface Stacktrace {
  frames: StackFrame[];
}

interface StackTraceViewerProps {
  stacktrace: Stacktrace;
  message: string;
}

export default function StackTraceViewer({ stacktrace, message }: StackTraceViewerProps) {
  const [showAll, setShowAll] = useState(false);

  const frames = [...stacktrace.frames].reverse();
  const inAppFrames = frames.filter((f) => f.in_app !== false);
  const displayedFrames = showAll
    ? frames
    : (inAppFrames.length > 0 ? inAppFrames : frames).slice(0, 10);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Error title */}
      <div className="px-4 py-3 border-b bg-destructive/5">
        <p className="font-mono text-sm font-medium text-destructive">{message}</p>
      </div>

      {/* Frames */}
      <div className="divide-y divide-border">
        {displayedFrames.map((frame, i) => {
          const isInApp = frame.in_app !== false;
          const isFirst = i === 0;
          // Use resolved values if available (from source maps)
          const displayFilename = frame.resolved_filename ?? frame.filename;
          const displayLineno = frame.resolved_lineno ?? frame.lineno;
          const displayColno = frame.resolved_colno ?? frame.colno;
          const displayFn = frame.resolved_function ?? frame.function;

          return (
            <FrameRow
              key={i}
              filename={displayFilename}
              fn={displayFn}
              lineno={displayLineno}
              colno={displayColno}
              contextLine={frame.context_line}
              isInApp={isInApp}
              isFirst={isFirst}
              isResolved={!!frame.resolved_filename}
            />
          );
        })}
      </div>

      {/* Show all toggle */}
      {frames.length > displayedFrames.length && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30
                     transition-colors border-t flex items-center justify-center gap-1.5"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Show {frames.length - displayedFrames.length} more frames
        </button>
      )}

      {showAll && frames.length > 10 && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30
                     transition-colors border-t flex items-center justify-center gap-1.5"
        >
          Collapse
        </button>
      )}
    </div>
  );
}

interface FrameRowProps {
  filename: string;
  fn?: string;
  lineno?: number;
  colno?: number;
  contextLine?: string;
  isInApp: boolean;
  isFirst: boolean;
  isResolved?: boolean;
}

function FrameRow({
  filename,
  fn,
  lineno,
  colno,
  contextLine,
  isInApp,
  isFirst,
  isResolved,
}: FrameRowProps) {
  const [expanded, setExpanded] = useState(isFirst);

  const shortFilename = filename
    .replace(/https?:\/\/[^/]+/, '')
    .replace(/\?.*$/, '');

  return (
    <div className={cn('text-xs', isInApp ? 'opacity-100' : 'opacity-50')}>
      <button
        onClick={() => contextLine && setExpanded((e) => !e)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
          contextLine && 'hover:bg-muted/20 cursor-pointer',
          !contextLine && 'cursor-default',
          isFirst && isInApp && 'bg-accent/30'
        )}
      >
        {contextLine ? (
          expanded
            ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
            : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <div className="flex-1 min-w-0 font-mono">
          {fn && (
            <span className={cn('mr-2', isInApp ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {fn}
            </span>
          )}
          <span className="text-muted-foreground">
            {shortFilename}
            {lineno !== undefined && `:${lineno}`}
            {colno !== undefined && `:${colno}`}
          </span>
          {isResolved && (
            <span className="ml-2 text-xs text-green-400 bg-green-500/10 px-1 rounded">
              resolved
            </span>
          )}
        </div>

        {isFirst && isInApp && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/20 shrink-0">
            culprit
          </span>
        )}
      </button>

      {expanded && contextLine && (
        <div className="px-10 py-2 bg-muted/20 border-t">
          <code className="text-xs font-mono text-foreground">{contextLine}</code>
        </div>
      )}
    </div>
  );
}