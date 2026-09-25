'use client';

import { MessageSquare, Palette, Type, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SidebarTab = 'brand' | 'banners' | 'chat';

const TAB_META: Record<SidebarTab, { label: string; Icon: typeof Palette }> = {
  brand: { label: 'Marka', Icon: Palette },
  banners: { label: "Banner'lar", Icon: Type },
  chat: { label: 'Sohbet', Icon: MessageSquare },
};

interface StudioSidebarProps {
  tabs: SidebarTab[];
  active: SidebarTab | null;
  onChange: (tab: SidebarTab | null) => void;
  unreadChat: number;
  children: React.ReactNode;
}

/** Sağda sekme şeridi ve açılır panel */
export function StudioSidebar({ tabs, active, onChange, unreadChat, children }: StudioSidebarProps) {
  return (
    <>
      {active && (
        <aside className="absolute inset-y-0 right-[76px] z-20 flex w-[min(340px,calc(100vw-92px))] flex-col border-l bg-background shadow-xl lg:static lg:shadow-none">
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <h2 className="font-display text-[15px] font-bold">{TAB_META[active].label}</h2>
            <button onClick={() => onChange(null)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Paneli kapat">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
        </aside>
      )}
      <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-l bg-background py-3">
        {tabs.map((id) => {
          const { label, Icon } = TAB_META[id];
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(isActive ? null : id)}
              className={cn(
                'relative flex w-[64px] flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition',
                isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
              {id === 'chat' && unreadChat > 0 && !isActive && (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-white">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
