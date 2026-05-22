import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { randomBytes } from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a cryptographically secure public key for a project DSN.
 */
export function generatePublicKey(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Build a DSN string from its components.
 * Format: https://<public_key>@<host>/project/<project_id>
 */
export function buildDsn(publicKey: string, projectId: string): string {
  const host = process.env.NEXT_PUBLIC_INGEST_HOST ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${publicKey}@${host}/project/${projectId}`;
}

/**
 * Truncate a string with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

/**
 * Slugify a name.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
