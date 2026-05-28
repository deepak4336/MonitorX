'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { Folders, Building2, LogOut, Activity, Sparkles, BarChart2, Bug, Package, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  user: User;
}

const TOP_NAV = [
  { href: '/projects', label: 'Projects', icon: Folders },
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/features', label: 'Features', icon: Sparkles },
];

const PROJECT_NAV = [
  { segment: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { segment: 'issues', label: 'Issues', icon: Bug },
  { segment: 'releases', label: 'Releases', icon: Package },
  { segment: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Extract projectId if we're inside a project route
  // e.g. /projects/abc-123/issues -> abc-123
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const displayName = user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside
      className="w-56 flex flex-col border-r shrink-0"
      style={{
        backgroundColor: 'hsl(var(--mx-sidebar))',
        borderColor: 'hsl(var(--mx-sidebar-border))',
      }}
    >
      {/* Logo */}
      <div
        className="h-14 flex items-center px-4 border-b"
        style={{ borderColor: 'hsl(var(--mx-sidebar-border))' }}
      >
        <Link href="/projects" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-background" />
          </div>
          <span className="font-semibold text-sm tracking-tight">MonitorX</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {/* Top-level nav */}
        {TOP_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                active
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Project-level nav — only shown when inside a project */}
        {projectId && (
          <>
            <div className="pt-3 pb-1 px-2.5">
              <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                Project
              </p>
            </div>
            {PROJECT_NAV.map(({ segment, label, icon: Icon }) => {
              const href = `/projects/${projectId}/${segment}`;
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={segment}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User section */}
      <div
        className="p-2 border-t space-y-0.5"
        style={{ borderColor: 'hsl(var(--mx-sidebar-border))' }}
      >
        <div className="flex items-center gap-2.5 px-2.5 py-1.5">
          <div className="w-6 h-6 rounded-full bg-foreground/10 border border-border flex items-center justify-center shrink-0">
            <span className="text-xs font-medium">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}