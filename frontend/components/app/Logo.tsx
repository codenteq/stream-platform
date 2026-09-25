import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm', className)}>
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="12" height="12" rx="2.5" />
        <path d="M15 10.5l5-3v9l-5-3" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ href = '/', className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2 font-semibold tracking-tight text-foreground', className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[17px]">
          Codenteq<span className="text-primary">Stream</span>
        </span>
      )}
    </Link>
  );
}
