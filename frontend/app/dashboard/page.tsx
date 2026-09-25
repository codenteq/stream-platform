'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, ChevronDown, Copy, MoreHorizontal, Pencil, Plus, Radio, Trash2, Video, Check } from 'lucide-react';
import { PageHeader } from '@/components/app/AppShell';
import { BroadcastDialog, type BroadcastKind } from '@/components/app/BroadcastDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, studioInviteUrl } from '@/lib/api';
import { PlatformAvatar } from '@/lib/platforms';
import type { Broadcast } from '@/lib/types';
import { cn } from '@/lib/utils';

type Tab = 'upcoming' | 'past';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ b }: { b: Broadcast }) {
  if (b.status === 'live')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
        <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" /> Canlı
      </span>
    );
  if (b.status === 'scheduled')
    return <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Planlandı</span>;
  if (b.status === 'ended') return <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Sona erdi</span>;
  return <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Taslak</span>;
}

function Thumbnail({ b }: { b: Broadcast }) {
  const color = b.brand_color || '#1d6cf0';
  return (
    <div
      className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg sm:w-44"
      style={{ background: `linear-gradient(135deg, ${color}, #0f172a)` }}
    >
      {b.logo_url && b.show_logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo_url} alt="" className="absolute right-2 top-2 h-6 w-auto max-w-[40%] object-contain" />
      ) : null}
      {b.targets.length > 0 ? <Radio className="h-7 w-7 text-white/80" /> : <Video className="h-7 w-7 text-white/80" />}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('upcoming');
  const [dialogKind, setDialogKind] = useState<BroadcastKind>('live');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Broadcast | null>(null);
  const [deleting, setDeleting] = useState<Broadcast | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setBroadcasts(await api.broadcasts());
    } catch (err: any) {
      if (!String(err.message).includes('Session expired')) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const up = broadcasts.filter((b) => b.status !== 'ended');
    up.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      const ta = new Date(a.scheduled_at || a.created_at).getTime();
      const tb = new Date(b.scheduled_at || b.created_at).getTime();
      return a.scheduled_at && b.scheduled_at ? ta - tb : tb - ta;
    });
    return { upcoming: up, past: broadcasts.filter((b) => b.status === 'ended') };
  }, [broadcasts]);

  const list = tab === 'upcoming' ? upcoming : past;

  const openCreate = (kind: BroadcastKind) => {
    setDialogKind(kind);
    setCreateOpen(true);
  };

  const copyInvite = async (b: Broadcast) => {
    await navigator.clipboard.writeText(studioInviteUrl(b.studio_code));
    setCopiedId(b.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteBroadcast(deleting.id);
      setBroadcasts((prev) => prev.filter((b) => b.id !== deleting.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Yayınlar"
        description="Canlı yayınlarınızı ve kayıtlarınızı buradan oluşturun ve yönetin."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" className="gap-2 rounded-lg px-5 shadow-sm">
                <Plus className="h-4 w-4" /> Oluştur <ChevronDown className="h-4 w-4 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-1.5">
              <DropdownMenuItem className="items-start gap-3 py-2.5" onSelect={() => openCreate('live')}>
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
                  <Radio className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-medium">Canlı yayın</span>
                  <span className="block text-xs text-muted-foreground">Bir veya daha fazla hedefe yayın yapın</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start gap-3 py-2.5" onSelect={() => openCreate('recording')}>
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
                  <Video className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-medium">Kayıt</span>
                  <span className="block text-xs text-muted-foreground">Yayına çıkmadan stüdyoda kaydedin</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="mb-4 flex gap-6 border-b">
        {(
          [
            ['upcoming', `Yaklaşan (${upcoming.length})`],
            ['past', `Geçmiş (${past.length})`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm font-medium transition-colors',
              tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-background" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-background px-6 py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
            {tab === 'upcoming' ? <Radio className="h-6 w-6" /> : <CalendarClock className="h-6 w-6" />}
          </span>
          <h3 className="text-lg font-semibold">{tab === 'upcoming' ? 'Henüz yaklaşan yayın yok' : 'Geçmiş yayın yok'}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {tab === 'upcoming'
              ? 'İlk canlı yayınınızı oluşturun, misafirlerinizi davet edin ve birden fazla platformda aynı anda yayına geçin.'
              : 'Sona eren yayınlarınız burada listelenir.'}
          </p>
          {tab === 'upcoming' && (
            <Button className="mt-6 gap-2" onClick={() => openCreate('live')}>
              <Plus className="h-4 w-4" /> Canlı yayın oluştur
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => (
            <li key={b.id} className="flex flex-col gap-4 rounded-xl border bg-background p-3 transition hover:shadow-md sm:flex-row sm:items-center">
              <Thumbnail b={b} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <StatusBadge b={b} />
                </div>
                <h3 className="truncate text-base font-semibold">{b.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {b.status === 'scheduled' && b.scheduled_at
                    ? `Planlanan: ${formatDate(b.scheduled_at)}`
                    : b.status === 'ended' && b.ended_at
                      ? `Bitiş: ${formatDate(b.ended_at)}`
                      : `Oluşturulma: ${formatDate(b.created_at)}`}
                </p>
                <div className="mt-2 flex items-center">
                  {b.targets.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Hedef yok · yalnızca kayıt</span>
                  ) : (
                    <div className="flex -space-x-2">
                      {b.targets.slice(0, 6).map((t) => (
                        <PlatformAvatar key={t.id} platform={t.platform} size={24} ring />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:pr-1">
                <Button asChild className="flex-1 sm:flex-none">
                  <Link href={`/studio/${b.studio_code}`}>Stüdyoya gir</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Diğer">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setEditing(b)}>
                      <Pencil /> Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => copyInvite(b)}>
                      {copiedId === b.id ? <Check /> : <Copy />} Misafir davet linki
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(b)}>
                      <Trash2 /> Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BroadcastDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        kind={dialogKind}
        onSaved={(b, { enterStudio }) => {
          if (enterStudio) router.push(`/studio/${b.studio_code}`);
          else load();
        }}
      />
      <BroadcastDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} broadcast={editing} onSaved={() => load()} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Yayın silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>“{deleting?.title}” kalıcı olarak silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
