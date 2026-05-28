'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import Link from 'next/link';

interface Props {
  eventsChartData: { date: string; events: number }[];
  levelChartData: { level: string; count: number }[];
  statusChartData: { status: string; count: number }[];
  topIssues: { id: string; title: string; occurrences: number; level: string; status: string }[];
  projectId: string;
}

const LEVEL_COLORS: Record<string, string> = {
  fatal: '#ef4444',
  error: '#f97316',
  warning: '#eab308',
  info: '#3b82f6',
  debug: '#8b5cf6',
};

const STATUS_COLORS: Record<string, string> = {
  unresolved: '#ef4444',
  resolved: '#22c55e',
  ignored: '#6b7280',
  regressed: '#f59e0b',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-medium mb-1 text-foreground">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-semibold">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts({
  eventsChartData,
  levelChartData,
  statusChartData,
  topIssues,
  projectId,
}: Props) {
  const maxEvents = Math.max(...eventsChartData.map((d) => d.events), 1);

  return (
    <div className="space-y-6">
      {/* Events over time */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-1">Events Over Time</h3>
        <p className="text-xs text-muted-foreground mb-4">Last 30 days</p>
        {maxEvents === 0 ? (
          <EmptyChart message="No events in the last 30 days" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={eventsChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="events"
                name="Events"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Level + Status row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Issues by level - Pie */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Issues by Level</h3>
          {levelChartData.length === 0 ? (
            <EmptyChart message="No issues yet" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={160}>
                <PieChart>
                  <Pie
                    data={levelChartData}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {levelChartData.map((entry) => (
                      <Cell
                        key={entry.level}
                        fill={LEVEL_COLORS[entry.level] ?? '#6b7280'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {levelChartData.map((entry) => (
                  <div key={entry.level} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: LEVEL_COLORS[entry.level] ?? '#6b7280' }}
                      />
                      <span className="capitalize text-muted-foreground">{entry.level}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Issues by status - Bar */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Issues by Status</h3>
          {statusChartData.length === 0 ? (
            <EmptyChart message="No issues yet" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={statusChartData}
                margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                barSize={32}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  cursor={{ fill: 'hsl(var(--accent))' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusChartData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] ?? '#6b7280'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top issues table */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Top Issues by Occurrences</h3>
        {topIssues.length === 0 ? (
          <EmptyChart message="No issues yet" />
        ) : (
          <div className="divide-y divide-border">
            {topIssues.map((issue, i) => (
              <Link
                key={issue.id}
                href={`/projects/${projectId}/issues/${issue.id}`}
                className="flex items-center gap-3 py-2.5 hover:bg-accent/40 px-2 -mx-2 rounded transition-colors"
              >
                <span className="text-xs text-muted-foreground w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: LEVEL_COLORS[issue.level] ?? '#6b7280' }}
                />
                <span className="flex-1 text-xs font-mono truncate">{issue.title}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: `${STATUS_COLORS[issue.status] ?? '#6b7280'}20`,
                    color: STATUS_COLORS[issue.status] ?? '#6b7280',
                  }}
                >
                  {issue.status}
                </span>
                <span className="text-xs tabular-nums font-semibold shrink-0">
                  {issue.occurrences.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}