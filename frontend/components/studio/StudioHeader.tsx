'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Circle, Loader2, Square } from 'lucide-react';
import { LogoMark } from '@/components/app/Logo';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { PlatformAvatar } from '@/lib/platforms';
import type { StreamingTarget } from '@/lib/types';
import { cn } from '@/lib/utils';

export function useElapsed(since: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return '00:00';
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

interface StudioHeaderProps {
  title: string;
  isHost: boolean;
  isLive: boolean;
  liveSince: number | null;
  targets: StreamingTarget[];
  isRecording: boolean;
  recordingSince: number | null;
  canRecord: boolean;
  busy: boolean;
  onGoLive: () => void;
  onEndLive: () => void;
  onToggleRecording: () => void;
  statusSlot?: React.ReactNode;
  guestOnStage?: boolean;
}

export function StudioHeader(props: StudioHeaderProps) {
  const { title, isHost, isLive, liveSince, targets, isRecording, recordingSince, canRecord, busy, onGoLive, onEndLive, onToggleRecording, statusSlot, guestOnStage } = props;
  const liveTime = useElapsed(isLive ? liveSince : null);
  const recTime = useElapsed(isRecording ? recordingSince : null);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 sm:px-4">
      {isHost ? (
        <Hint label="Panele dön" side="bottom">
          <Link href="/dashboard" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Panele dön">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Hint>
      ) : (
        <LogoMark className="h-7 w-7" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-[15px] font-bold sm:text-base">{title}</h1>
      </div>

      {isLive && (isHost || !guestOnStage) && (
        <span className="flex items-center gap-2 rounded-md bg-live px-2.5 py-1 text-xs font-bold text-white shadow-[0_0_14px_hsl(var(--live)/0.45)]">
          <span className="h-2 w-2 animate-live-pulse rounded-full bg-white" />
          CANLI
          {isHost && <span className="tabular font-semibold">{liveTime}</span>}
        </span>
      )}

      {!isHost && (
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
            guestOnStage
              ? isLive
                ? 'bg-live font-bold text-white shadow-[0_0_14px_hsl(var(--live)/0.45)]'
                : 'bg-accent text-accent-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn('h-2 w-2 rounded-full', guestOnStage ? (isLive ? 'animate-live-pulse bg-white' : 'bg-primary') : 'bg-muted-foreground/50')}
          />
          {guestOnStage ? (isLive ? 'Yayındasınız' : 'Sahnedesiniz') : 'Kulistesiniz'}
        </span>
      )}

      {isHost && (
        <>
          {statusSlot}
          {isLive && targets.length > 0 && (
            <div className="hidden -space-x-1.5 md:flex">
              {targets.map((t) => (
                <PlatformAvatar key={t.id} platform={t.platform} size={24} ring className={t.egress_id ? '' : 'opacity-40 grayscale'} />
              ))}
            </div>
          )}
          {canRecord && (
            <Button variant="outline" size="sm" onClick={onToggleRecording} className={cn('gap-2', isRecording && 'border-live/50 text-live hover:text-live')}>
              {isRecording ? <Square className="h-3 w-3 fill-current" /> : <Circle className="h-3 w-3 fill-live text-live" />}
              {isRecording ? <span className="tabular">{recTime}</span> : 'Kaydet'}
            </Button>
          )}
          {isLive ? (
            <Button size="sm" variant="outline" onClick={onEndLive} disabled={busy} className="gap-2 border-live/40 font-semibold text-live hover:bg-live hover:text-white">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Yayını bitir
            </Button>
          ) : (
            <Button size="sm" onClick={onGoLive} disabled={busy} className="gap-2 px-4 font-semibold">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Canlı yayına geç
            </Button>
          )}
        </>
      )}
    </header>
  );
}
