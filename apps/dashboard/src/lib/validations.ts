import { z } from 'zod';

export const StackFrameSchema = z.object({
  filename: z.string(),
  function: z.string().optional(),
  lineno: z.number().int().optional(),
  colno: z.number().int().optional(),
  in_app: z.boolean().optional(),
  context_line: z.string().optional(),
  pre_context: z.array(z.string()).optional(),
  post_context: z.array(z.string()).optional(),
});

export const StacktraceSchema = z.object({
  frames: z.array(StackFrameSchema),
});

export const EventLevelSchema = z.enum(['fatal', 'error', 'warning', 'info', 'debug', 'log']);

export const BreadcrumbSchema = z.object({
  type: z.string(),
  category: z.string(),
  message: z.string(),
  level: z.string().optional(),
  timestamp: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const UserContextSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
}).passthrough();

export const IngestEventSchema = z.object({
  event_id: z.string().optional(),
  timestamp: z.string().optional(),
  platform: z.string().optional().default('javascript'),
  message: z.string().min(1, 'Message is required').max(4096),
  stacktrace: StacktraceSchema.optional(),
  user_agent: z.string().optional(),
  url: z.string().optional(),
  environment: z.string().optional().default('production'),
  level: EventLevelSchema.optional().default('error'),
  project_id: z.string().uuid(),
  extra: z.record(z.unknown()).optional(),
  breadcrumbs: z.array(BreadcrumbSchema).optional(),
  user: UserContextSchema.optional(),
  tags: z.record(z.string()).optional(),
  contexts: z.record(z.unknown()).optional(),
  release: z.string().optional(),
});

export type IngestEventInput = z.infer<typeof IngestEventSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(64),
  slug: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/).optional(),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(64),
  environment: z.string().optional().default('production'),
  organization_id: z.string().uuid(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterSchema = z.object({
  name: z.string().min(2).max(64),
  email: z.string().email(),
  password: z.string().min(8),
});

export const CreateAlertRuleSchema = z.object({
  name: z.string().min(1).max(64),
  trigger: z.enum(['new_issue', 'regression', 'spike']),
  channel: z.enum(['email', 'slack']),
  destination: z.string().min(1),
  cooldown_min: z.number().int().min(1).optional().default(60),
});