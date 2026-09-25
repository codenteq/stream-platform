'use client';

import { useEffect, useState } from 'react';
import { Loader2, Radio } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DestinationPicker } from '@/components/app/DestinationPicker';
import { DestinationDialog } from '@/components/app/DestinationDialog';
import { api } from '@/lib/api';
import { PlatformAvatar } from '@/lib/platforms';
import type { Broadcast, Destination } from '@/lib/types';

interface GoLiveDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  broadcast: Broadcast;
  /** Hedefler kaydedildikten sonra yayını başlatır */
  onGoLive: (updated: Broadcast) => Promise<void>;
}

/** "Canlı yayına geç" onayı: hangi hedeflere çıkılacağını seçtirir. */
export function GoLiveDialog({ open, onOpenChange, broadcast, onGoLive }: GoLiveDialogProps) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const legacyTargets = broadcast.targets.filter((t) => !t.destination_id);

  useEffect(() => {
    if (!open) return;
    setError('');
    api
      .destinations()
      .then((list) => {
        setDestinations(list);
        const attached = broadcast.targets.filter((t) => t.destination_id).map((t) => t.destination_id as number);
        setSelected(attached.length > 0 ? attached : list.length === 1 ? [list[0].id] : attached);
      })
      .catch(() => setDestinations([]));
  }, [open, broadcast]);

  const total = selected.length + legacyTargets.length;

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const updated = await api.updateBroadcast(broadcast.id, { destination_ids: selected });
      await onGoLive(updated);
      onOpenChange(false);
    } catch (err: any) {
      if (!String(err.message).includes('Session expired')) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-live/10 text-live">
              <Radio className="h-5 w-5" />
            </div>
            <DialogTitle>Canlı yayına geçilsin mi?</DialogTitle>
            <DialogDescription>Sahnedekiler seçtiğiniz hedeflerde canlı olarak yayınlanacak.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Hedefler</p>
            <DestinationPicker destinations={destinations} selected={selected} onChange={setSelected} onAdd={() => setAddOpen(true)} disabled={busy} />
            {legacyTargets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Bu yayına özel hedefler de kullanılacak:
                {legacyTargets.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1">
                    <PlatformAvatar platform={t.platform} size={18} /> {t.name || t.platform}
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={start} disabled={busy || total === 0} className="min-w-[150px] gap-2 bg-live text-white hover:bg-live/90">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Başlatılıyor…' : `Yayına geç${total > 0 ? ` (${total})` : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DestinationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={(d) => {
          setDestinations((prev) => [...prev, d]);
          setSelected((prev) => [...prev, d.id]);
        }}
      />
    </>
  );
}
