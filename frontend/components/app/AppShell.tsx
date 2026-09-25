'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, Radio, Settings, LogOut, Menu, X, LifeBuoy } from 'lucide-react';
import { Logo } from '@/components/app/Logo';
import { UserAvatar } from '@/components/app/UserAvatar';
import { api } from '@/lib/api';
import type { CurrentUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV = [
  { href: '/dashboard', label: 'Yayınlar', Icon: Home, exact: true },
  { href: '/dashboard/destinations', label: 'Hedefler', Icon: Radio },
  { href: '/dashboard/settings', label: 'Ayarlar', Icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.replace('/login');
      return;
    }
    api.me().then(setUser).catch(() => undefined);
  }, [router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const displayName = user?.name || user?.email?.split('@')[0] || '';

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-secondary">
        <UserAvatar name={displayName || '?'} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{displayName || '…'}</span>
          <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push('/dashboard/settings')}>
          <Settings /> Hesap ayarları
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={logout}>
          <LogOut /> Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen bg-muted/60">
      {/* Masaüstü kenar çubuğu */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-background px-4 py-5 md:flex">
        <Logo href="/dashboard" className="px-2" />
        <div className="mt-8 flex-1">{nav}</div>
        <a
          href="https://github.com/codenteq/stream-platform"
          target="_blank"
          rel="noreferrer"
          className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LifeBuoy className="h-[18px] w-[18px]" /> Yardım
        </a>
        <div className="border-t pt-3">{userMenu}</div>
      </aside>

      {/* Mobil üst çubuk */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <Logo href="/dashboard" />
        <button onClick={() => setMobileOpen((v) => !v)} className="rounded-md p-2 hover:bg-secondary" aria-label="Menü">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-x-0 top-14 z-40 border-b bg-background p-4 shadow-lg md:hidden">
          {nav}
          <div className="mt-3 border-t pt-3">{userMenu}</div>
        </div>
      )}

      <main className="min-w-0 flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
