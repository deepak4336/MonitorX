'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, SlidersHorizontal } from 'lucide-react';

interface IssueFiltersProps {
  projectId: string;
  availableReleases?: string[];
  availableEnvironments?: string[];
}

const LEVELS = ['fatal', 'error', 'warning', 'info', 'debug'];
const DATE_RANGES = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time', value: '' },
];

export default function IssueFilters({
  projectId,
  availableReleases = [],
  availableEnvironments = [],
}: IssueFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [level, setLevel] = useState(searchParams.get('level') ?? '');
  const [environment, setEnvironment] = useState(searchParams.get('environment') ?? '');
  const [release, setRelease] = useState(searchParams.get('release') ?? '');
  const [dateRange, setDateRange] = useState(searchParams.get('dateRange') ?? '');
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [level, environment, release, dateRange].filter(Boolean).length;

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      updateParams({ search });
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function clearAllFilters() {
    setSearch('');
    setLevel('');
    setEnvironment('');
    setRelease('');
    setDateRange('');
    router.push(pathname);
  }

  const hasActiveFilters = search || level || environment || release || dateRange;

  return (
    <div className="px-6 py-3 border-b space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm
                       focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-md text-sm border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-foreground text-background border-foreground'
              : 'border-border hover:bg-accent'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 bg-background text-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center font-medium">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground border border-border hover:bg-accent transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">

          {/* Level filter */}
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              updateParams({ level: e.target.value });
            }}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none"
          >
            <option value="">All Levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>

          {/* Environment filter */}
          <select
            value={environment}
            onChange={(e) => {
              setEnvironment(e.target.value);
              updateParams({ environment: e.target.value });
            }}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none"
          >
            <option value="">All Environments</option>
            {availableEnvironments.length > 0
              ? availableEnvironments.map((env) => (
                  <option key={env} value={env}>{env}</option>
                ))
              : ['production', 'staging', 'development', 'test'].map((env) => (
                  <option key={env} value={env}>{env}</option>
                ))
            }
          </select>

          {/* Date range filter */}
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              updateParams({ dateRange: e.target.value });
            }}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none"
          >
            {DATE_RANGES.map((dr) => (
              <option key={dr.value} value={dr.value}>{dr.label}</option>
            ))}
          </select>

          {/* Release filter */}
          {availableReleases.length > 0 && (
            <select
              value={release}
              onChange={(e) => {
                setRelease(e.target.value);
                updateParams({ release: e.target.value });
              }}
              className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none"
            >
              <option value="">All Releases</option>
              {availableReleases.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {search && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              Search: "{search}"
              <button onClick={() => setSearch('')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {level && (
            <span className="inline-flex items-center gap-1 text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
              Level: {level}
              <button onClick={() => { setLevel(''); updateParams({ level: '' }); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {environment && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
              Env: {environment}
              <button onClick={() => { setEnvironment(''); updateParams({ environment: '' }); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {dateRange && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {DATE_RANGES.find(d => d.value === dateRange)?.label}
              <button onClick={() => { setDateRange(''); updateParams({ dateRange: '' }); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {release && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              Release: {release}
              <button onClick={() => { setRelease(''); updateParams({ release: '' }); }}><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}