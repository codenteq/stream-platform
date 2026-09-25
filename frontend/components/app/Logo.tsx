import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Kamera gövdesi ve üstünde tally ışığı: yayında olduğunu gösteren kırmızı nokta */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-foreground', className)}>
      <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
        <rect x="7" y="11" width="13" height="11" rx="2.5" fill="#fff" />
        <path d="M20.5 15.2 25 12.6v7.8l-4.5-2.6z" fill="#fff" />
        <circle cx="24.5" cy="7.5" r="2.6" className="fill-live" />
      </svg>
    </span>
  );
}

export function Logo({ href = '/', className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2.5 text-foreground', className)}>
      <LogoMark />
      {!compact && <span className="font-display whitespace-nowrap text-[16px] font-bold leading-none">Codenteq Stream</span>}
    </Link>
  );
}
