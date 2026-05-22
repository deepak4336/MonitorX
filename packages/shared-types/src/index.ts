// ─── Telemetry Event Schema ──────────────────────────────────────────────────

export type EventLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface StackFrame {
  filename: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
}

export interface Stacktrace {
  frames: StackFrame[];
}

export interface TelemetryEvent {
  event_id: string;
  timestamp: string;
  platform: string;
  message: string;
  stacktrace?: Stacktrace;
  user_agent?: string;
  url?: string;
  environment: string;
  level: EventLevel;
  project_id: string;
  extra?: Record<string, unknown>;
}

export interface IngestEventPayload {
  event_id?: string;
  timestamp?: string;
  platform?: string;
  message: string;
  stacktrace?: Stacktrace;
  user_agent?: string;
  url?: string;
  environment?: string;
  level?: EventLevel;
  extra?: Record<string, unknown>;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IngestResponse {
  event_id: string;
  issue_id: string;
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  environment: string;
  organization_id: string;
  created_at: string;
  dsn?: string;
}

export interface Issue {
  id: string;
  title: string;
  culprit?: string;
  level: EventLevel;
  status: 'unresolved' | 'resolved' | 'ignored';
  occurrences: number;
  first_seen: string;
  last_seen: string;
  environment: string;
  project_id: string;
  fingerprint: string;
}

export interface IssueWithEvents extends Issue {
  events: TelemetryEvent[];
}

export type MemberRole = 'owner' | 'developer' | 'viewer';

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}
