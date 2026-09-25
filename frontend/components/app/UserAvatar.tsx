import { cn } from '@/lib/utils';

const COLORS = ['#1d6cf0', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5', '#b45309'];

export function initialsOf(name: string) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function UserAvatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, backgroundColor: colorFor(name || '?'), fontSize: Math.max(10, size * 0.38) }}
    >
      {initialsOf(name)}
    </span>
  );
}
