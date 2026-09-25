'use client';

import { useRef } from 'react';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { BRAND_COLORS, THEMES, type BrandConfig, type BrandTheme } from '@/lib/studio/types';
import { readableTextOn } from '@/lib/studio/compositor';
import { fileToDataUrl } from '@/lib/studio/image';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ThemePreview({ theme, color }: { theme: BrandTheme; color: string }) {
  const fg = theme === 'minimal' ? '#fff' : readableTextOn(color);
  const bg = theme === 'minimal' ? 'rgba(15,23,42,0.7)' : color;
  const radius = theme === 'bubble' ? 999 : theme === 'block' ? 0 : theme === 'bold' ? 2 : 4;
  return (
    <span className="relative flex h-10 w-full items-end overflow-hidden rounded bg-slate-700 p-1">
      <span
        className={cn('px-1.5 py-0.5 text-[9px] leading-none', theme === 'bold' ? 'font-extrabold' : 'font-semibold', theme === 'block' && 'uppercase')}
        style={{ background: bg, color: fg, borderRadius: radius, borderLeft: theme === 'block' ? `3px solid ${fg}` : undefined }}
      >
        Ayşe
      </span>
    </span>
  );
}

function AssetPicker({
  label,
  hint,
  value,
  enabled,
  onToggle,
  onChange,
  maxW,
  maxH,
  type,
  toggleable = true,
}: {
  label: string;
  hint: string;
  value: string;
  enabled: boolean;
  onToggle?: (v: boolean) => void;
  onChange: (url: string) => void;
  maxW: number;
  maxH: number;
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  toggleable?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await fileToDataUrl(file, maxW, maxH, type);
      onChange(url);
      onToggle?.(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Section title={label} action={toggleable && value && onToggle ? <Switch checked={enabled} onCheckedChange={onToggle} /> : undefined}>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
      {value ? (
        <div className="group relative overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:14px_14px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="mx-auto h-24 w-full object-contain" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition group-hover:opacity-100">
            <button onClick={() => input.current?.click()} className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-900">
              Değiştir
            </button>
            <button onClick={() => onChange('')} className="rounded-md bg-white p-1.5 text-destructive" aria-label="Kaldır">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => input.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-xs font-medium">Görsel yükle</span>
        </button>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </Section>
  );
}

export function BrandPanel({ brand, onChange }: { brand: BrandConfig; onChange: (patch: Partial<BrandConfig>) => void }) {
  return (
    <div>
      <Section title="Marka rengi">
        <div className="grid grid-cols-5 gap-2">
          {BRAND_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              className={cn('flex aspect-square items-center justify-center rounded-lg border transition hover:scale-105', brand.color === c && 'ring-2 ring-primary ring-offset-2')}
              style={{ background: c }}
              aria-label={c}
            >
              {brand.color === c && <Check className="h-4 w-4" style={{ color: readableTextOn(c) }} />}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-lg border px-2 py-1.5">
          <input type="color" value={brand.color} onChange={(e) => onChange({ color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
          <span className="tabular text-xs uppercase text-muted-foreground">{brand.color}</span>
          <span className="ml-auto text-xs text-muted-foreground">Özel renk</span>
        </label>
      </Section>

      <Section title="Tema">
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange({ theme: t.id })}
              className={cn('rounded-lg border p-1.5 text-left transition hover:border-primary', brand.theme === t.id && 'border-primary ring-1 ring-primary')}
            >
              <ThemePreview theme={t.id} color={brand.color} />
              <span className="mt-1 block text-center text-[11px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center justify-between">
          <span className="text-sm">Ekran isimlerini göster</span>
          <Switch checked={brand.showNames} onCheckedChange={(v) => onChange({ showNames: v })} />
        </label>
      </Section>

      <AssetPicker
        label="Logo"
        hint="Sağ üst köşede görünür. Şeffaf PNG önerilir."
        value={brand.logoUrl}
        enabled={brand.showLogo}
        onToggle={(v) => onChange({ showLogo: v })}
        onChange={(url) => onChange({ logoUrl: url, showLogo: !!url && brand.showLogo })}
        maxW={600}
        maxH={600}
        type="image/png"
      />
      <AssetPicker
        label="Overlay"
        hint="Tüm ekranın üzerine çizilir. 1920×1080 şeffaf PNG önerilir."
        value={brand.overlayUrl}
        enabled={brand.showOverlay}
        onToggle={(v) => onChange({ showOverlay: v })}
        onChange={(url) => onChange({ overlayUrl: url, showOverlay: !!url && brand.showOverlay })}
        maxW={1920}
        maxH={1080}
        type="image/webp"
      />
      <AssetPicker
        label="Arka plan"
        hint="Katılımcıların arkasında görünür. Boş bırakılırsa marka renginden degrade kullanılır."
        value={brand.backgroundUrl}
        enabled
        toggleable={false}
        onChange={(url) => onChange({ backgroundUrl: url })}
        maxW={1920}
        maxH={1080}
        type="image/jpeg"
      />
    </div>
  );
}
