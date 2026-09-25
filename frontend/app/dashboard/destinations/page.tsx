'use client';

import { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
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
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-10 md:py-10">
      <PageHeader
        title="Hedefler"
        description="Yayın yapacağınız kanalları bağlayın. Her yayında hangi hedeflere çıkacağınızı seçebilirsiniz."
        actions={
          <Button
            size="lg"
            className="gap-2"
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
        <div className="rounded-xl border bg-background px-6 py-12">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-5 flex justify-center -space-x-2">
              {['YouTube', 'Facebook', 'LinkedIn', 'Twitch', 'X', 'Kick'].map((p) => (
                <PlatformAvatar key={p} platform={p} size={36} ring />
              ))}
            </div>
            <h3 className="font-display text-xl font-bold">İlk hedefinizi bağlayın</h3>
            <p className="mt-2 text-sm text-muted-foreground">Bir hedef ekledikten sonra her yayında hangi platformlara çıkacağınızı seçebilirsiniz.</p>
            <Button className="mt-6 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Hedef ekle
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-background">
          {destinations.map((d) => (
            <li key={d.id} className="flex items-center gap-4 px-4 py-3.5">
              <PlatformAvatar platform={d.platform} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {getPlatform(d.platform).label}
                  <span className="tabular ml-3 tracking-wider">{maskKey(d.stream_key)}</span>
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
