'use client';

import { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Radio, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/app/AppShell';
import { DestinationDialog } from '@/components/app/DestinationDialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { api } from '@/lib/api';
import { PlatformAvatar, getPlatform } from '@/lib/platforms';
import type { Destination } from '@/lib/types';

function maskKey(key: string) {
  if (key.length <= 4) return '••••';
  return `••••••••${key.slice(-4)}`;
}

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Destination | null>(null);
  const [deleting, setDeleting] = useState<Destination | null>(null);

  const load = useCallback(async () => {
    try {
      setDestinations(await api.destinations());
    } catch (err: any) {
      if (!String(err.message).includes('Session expired')) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.deleteDestination(deleting.id);
      setDestinations((prev) => prev.filter((d) => d.id !== deleting.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Hedefler"
        description="Yayın yapacağınız kanalları bağlayın. Her yayında hangi hedeflere çıkacağınızı seçebilirsiniz."
        actions={
          <Button
            size="lg"
            className="gap-2 rounded-lg"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Hedef ekle
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-background" />
          ))}
        </div>
      ) : destinations.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-background px-6 py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
            <Radio className="h-6 w-6" />
          </span>
          <h3 className="text-lg font-semibold">Henüz hedef bağlamadınız</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            YouTube, Facebook, LinkedIn, Twitch, X, Kick veya özel bir RTMP sunucusu ekleyin ve aynı anda hepsine yayın yapın.
          </p>
          <Button className="mt-6 gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Hedef ekle
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {destinations.map((d) => (
            <li key={d.id} className="flex items-center gap-4 rounded-xl border bg-background p-4">
              <PlatformAvatar platform={d.platform} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {getPlatform(d.platform).label} · {maskKey(d.stream_key)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Diğer">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(d);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil /> Düzenle
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => setDeleting(d)}>
                    <Trash2 /> Kaldır
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <DestinationDialog open={dialogOpen} onOpenChange={setDialogOpen} destination={editing} onSaved={() => load()} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hedef kaldırılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}” hesabınızdan ve bu hedefi kullanan yayınlardan kaldırılacak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
