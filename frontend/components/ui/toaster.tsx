'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { dismissToast, subscribeToasts, type ToastItem } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex max-w-md items-start gap-3 rounded-xl bg-foreground px-4 py-3 text-sm text-background shadow-xl animate-in fade-in-0 slide-in-from-bottom-2'
            )}
            role="status"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.kind === 'success' && 'text-emerald-400', t.kind === 'error' && 'text-red-400')} />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="opacity-60 hover:opacity-100" aria-label="Kapat">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
