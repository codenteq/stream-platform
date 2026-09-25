'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Copy, MoreHorizontal, Pencil, Plus, Radio, Trash2, Video, Check } from 'lucide-react';
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

/** Yayın durumları, stüdyodaki tally ışıklarının diliyle */
function StatusBadge({ b }: { b: Broadcast }) {
  const map = {
    live: { label: 'Canlı', dot: 'bg-live animate-live-pulse', text: 'text-live' },
    scheduled: { label: 'Planlandı', dot: 'bg-cue', text: 'text-cue' },
    ended: { label: 'Sona erdi', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
    draft: { label: 'Taslak', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
  } as const;
  const s = map[b.status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** Küçük önizleme: yayının kendi marka rengi, alt bandı ve logosu */
function Thumbnail({ b }: { b: Broadcast }) {
  const color = b.brand_color || '#0E63A6';
  return (
    <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md bg-bezel sm:w-40" style={{ backgroundImage: `linear-gradient(135deg, ${color}55, transparent 70%)` }}>
      <div className="absolute inset-[7%] bottom-[30%] grid grid-cols-2 gap-[4%]">
        <span className="rounded-[3px] bg-white/10" />
        <span className="rounded-[3px] bg-white/10" />
      </div>
      <span
        className="font-display absolute bottom-[9%] left-[7%] max-w-[80%] truncate px-1.5 py-0.5 text-[9px] font-bold leading-tight text-white"
        style={{ backgroundColor: color }}
      >
        {b.title}
      </span>
      {b.logo_url && b.show_logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo_url} alt="" className="absolute right-[5%] top-[6%] h-[16%] w-auto max-w-[30%] object-contain" />
      ) : null}
      {b.status === 'live' && <span className="absolute left-[5%] top-[6%] rounded-[2px] bg-live px-1 text-[8px] font-bold text-white">CANLI</span>}
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
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-10 md:py-10">
      <PageHeader
        title="Yayınlar"
        description="Canlı yayınlarınızı ve kayıtlarınızı buradan oluşturun ve yönetin."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" className="gap-2 px-5">
                <Plus className="h-4 w-4" /> Oluştur <ChevronDown className="h-4 w-4 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-1.5">
              <DropdownMenuItem className="items-start gap-3 py-2.5" onSelect={() => openCreate('live')}>
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-live/10 text-live">
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
            ['upcoming', 'Yaklaşan', upcoming.length],
            ['past', 'Geçmiş', past.length],
          ] as [Tab, string, number][]
        ).map(([id, label, count]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors',
              tab === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            <span className="tabular rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-background" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border bg-background px-6 py-14">
          <div className="mx-auto max-w-md text-center">
            <h3 className="font-display text-xl font-bold">{tab === 'upcoming' ? 'Sıradaki yayınınızı oluşturun' : 'Henüz sona eren yayın yok'}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tab === 'upcoming'
                ? 'Hedeflerinizi seçin, başlık verin ve stüdyoya girin. Misafirlerinizi stüdyodan davet edebilirsiniz.'
                : 'Yayını bitirdiğinizde burada listelenir.'}
            </p>
            {tab === 'upcoming' && (
              <Button className="mt-6 gap-2" onClick={() => openCreate('live')}>
                <Plus className="h-4 w-4" /> Canlı yayın oluştur
              </Button>
            )}
          </div>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-background">
          {list.map((b) => (
            <li key={b.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
              <Thumbnail b={b} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-semibold">{b.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <StatusBadge b={b} />
                  <span>
                    {b.status === 'scheduled' && b.scheduled_at
                      ? formatDate(b.scheduled_at)
                      : b.status === 'ended' && b.ended_at
                        ? `Bitiş ${formatDate(b.ended_at)}`
                        : `Oluşturuldu ${formatDate(b.created_at)}`}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  {b.targets.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Hedef seçilmedi, yalnızca kayıt</span>
                  ) : (
                    <>
                      <div className="flex -space-x-1.5">
                        {b.targets.slice(0, 6).map((t) => (
                          <PlatformAvatar key={t.id} platform={t.platform} size={22} ring />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{b.targets.length} hedef</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 sm:pl-2">
                <Button asChild variant={b.status === 'live' ? 'default' : 'outline'} className="flex-1 sm:flex-none">
                  <Link href={`/studio/${b.studio_code}`}>{b.status === 'live' ? 'Stüdyoya dön' : 'Stüdyoya gir'}</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Diğer işlemler">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setEditing(b)}>
                      <Pencil /> Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => copyInvite(b)}>
                      {copiedId === b.id ? <Check /> : <Copy />} {copiedId === b.id ? 'Link kopyalandı' : 'Misafir linkini kopyala'}
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
