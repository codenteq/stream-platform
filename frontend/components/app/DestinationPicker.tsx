'use client';

import { Check, Plus } from 'lucide-react';
import { PlatformAvatar } from '@/lib/platforms';
import type { Destination } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DestinationPickerProps {
  destinations: Destination[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onAdd: () => void;
  disabled?: boolean;
}

/** Hedefler yuvarlak platform avatarları olarak listelenir; tıklayınca seçilir. */
export function DestinationPicker({ destinations, selected, onChange, onAdd, disabled }: DestinationPickerProps) {
  const toggle = (id: number) => {
    if (disabled) return;
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="flex flex-wrap gap-4">
      {destinations.map((d) => {
        const isOn = selected.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => toggle(d.id)}
            className={cn('group flex w-[72px] flex-col items-center gap-1.5 text-center', disabled && 'cursor-not-allowed opacity-60')}
            title={d.name}
          >
            <span className="relative">
              <PlatformAvatar
                platform={d.platform}
                size={52}
                className={cn('transition', isOn ? 'ring-[3px] ring-primary ring-offset-2' : 'opacity-50 grayscale group-hover:opacity-80 group-hover:grayscale-0')}
              />
              {isOn && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">{d.name}</span>
          </button>
        );
      })}
      <button type="button" onClick={onAdd} className="flex w-[72px] flex-col items-center gap-1.5 text-center" disabled={disabled}>
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 text-muted-foreground transition hover:border-primary hover:text-primary">
          <Plus className="h-5 w-5" />
        </span>
        <span className="text-xs text-muted-foreground">Hedef ekle</span>
      </button>
    </div>
  );
}
