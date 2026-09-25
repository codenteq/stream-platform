'use client';

import { useState } from 'react';
import { Eye, EyeOff, Pencil, Trash2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Banner } from '@/lib/studio/types';
import { cn } from '@/lib/utils';

interface BannersPanelProps {
  banners: Banner[];
  activeId: string | null;
  onChange: (banners: Banner[]) => void;
  onToggleActive: (id: string) => void;
}

export function BannersPanel({ banners, activeId, onChange, onToggleActive }: BannersPanelProps) {
  const [text, setText] = useState('');
  const [ticker, setTicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (editingId) {
      onChange(banners.map((b) => (b.id === editingId ? { ...b, text: t, ticker } : b)));
      setEditingId(null);
    } else {
      onChange([...banners, { id: Math.random().toString(36).slice(2, 10), text: t, ticker }]);
    }
    setText('');
    setTicker(false);
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={submit} className="space-y-2 border-b p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Banner metni yazın…"
          maxLength={200}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={ticker} onChange={(e) => setTicker(e.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
            Kayan yazı
          </label>
          <div className="flex gap-2">
            {editingId && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setText('');
                  setTicker(false);
                }}
              >
                Vazgeç
              </Button>
            )}
            <Button type="submit" size="sm" disabled={!text.trim()}>
              {editingId ? 'Kaydet' : 'Oluştur'}
            </Button>
          </div>
        </div>
      </form>

      <div className="flex-1 space-y-2 overflow-y-auto p-4 scrollbar-thin">
        {banners.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <Type className="mb-2 h-6 w-6" />
            <p className="text-sm">Henüz banner yok</p>
            <p className="mt-1 text-xs">Banner'lar yayında alt bant olarak gösterilir. Göstermek için üzerine tıklayın.</p>
          </div>
        )}
        {banners.map((b) => {
          const active = b.id === activeId;
          return (
            <div
              key={b.id}
              className={cn(
                'group relative cursor-pointer rounded-lg border p-3 pr-16 text-sm transition',
                active ? 'border-primary bg-accent' : 'hover:border-primary/50 hover:bg-muted/60'
              )}
              onClick={() => onToggleActive(b.id)}
            >
              <p className="line-clamp-3 break-words">{b.text}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                {b.ticker && <span className="rounded bg-secondary px-1.5 py-0.5">Kayan</span>}
                {active ? (
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <Eye className="h-3 w-3" /> Yayında gösteriliyor
                  </span>
                ) : (
                  <span className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <EyeOff className="h-3 w-3" /> Göstermek için tıklayın
                  </span>
                )}
              </div>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(b.id);
                    setText(b.text);
                    setTicker(b.ticker);
                  }}
                  aria-label="Düzenle"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(banners.filter((x) => x.id !== b.id));
                  }}
                  aria-label="Sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
