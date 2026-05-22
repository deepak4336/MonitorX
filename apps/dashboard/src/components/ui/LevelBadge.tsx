'use client';

import { cn } from '@/lib/utils';

type Level = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

interface LevelBadgeProps {
  level: Level;
  className?: string;
}

const LEVEL_LABELS: Record<Level, string> = {
  fatal: 'Fatal',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  debug: 'Debug',
};

export default function LevelBadge({ level, className }: LevelBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border',
        `level-badge-${level}`,
        className
      )}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}