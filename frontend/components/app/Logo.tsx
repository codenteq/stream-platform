import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Codenteq'in logosundaki gün doğumu → okyanus geçişi, tek bir sıçrayış
 * çizgisine indirgendi: yayına "atlamayı" ve birden çok hedefe akmayı anlatır.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('brand-mark-gradient relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]', className)}>
      <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
        <path d="M7 21c1.5-7 6-11.5 13-12.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="22" cy="8" r="2.3" fill="#fff" />
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
