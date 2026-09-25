'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, Video, Radio } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DestinationPicker } from '@/components/app/DestinationPicker';
import { DestinationDialog } from '@/components/app/DestinationDialog';
import { api } from '@/lib/api';
import type { Broadcast, Destination } from '@/lib/types';

export type BroadcastKind = 'live' | 'recording';

interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: BroadcastKind;
  /** Düzenleme modunda mevcut yayın */
  broadcast?: Broadcast | null;
  onSaved: (broadcast: Broadcast, opts: { enterStudio: boolean }) => void;
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BroadcastDialog({ open, onOpenChange, kind = 'live', broadcast, onSaved }: BroadcastDialogProps) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const isEdit = !!broadcast;
  const isRecording = !isEdit && kind === 'recording';
  const isLive = broadcast?.status === 'live';

  useEffect(() => {
    if (!open) return;
    setError('');
    api
      .destinations()
      .then((list) => {
        setDestinations(list);
        if (broadcast) {
          setSelected(broadcast.targets.filter((t) => t.destination_id).map((t) => t.destination_id as number));
        } else {
          setSelected(list.length === 1 ? [list[0].id] : []);
        }
      })
      .catch(() => setDestinations([]));

    setTitle(broadcast?.title || '');
    setDescription(broadcast?.description || '');
    setScheduleOn(!!broadcast?.scheduled_at);
    setScheduledAt(toLocalInput(broadcast?.scheduled_at));
  }, [open, broadcast]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description,
      };
      if (!isRecording && !isLive) body.destination_ids = selected;
      if (scheduleOn && scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString();
      else if (isEdit) body.clear_schedule = true;

      const saved = isEdit ? await api.updateBroadcast(broadcast!.id, body) : await api.createBroadcast(body);
      onSaved(saved, { enterStudio: !isEdit && !(scheduleOn && scheduledAt) });
      onOpenChange(false);
    } catch (err: any) {
      if (!String(err.message).includes('Session expired')) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const heading = isEdit ? 'Yayını düzenle' : isRecording ? 'Kayıt oluştur' : 'Canlı yayın oluştur';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <form onSubmit={submit} className="space-y-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
                  {isRecording ? <Video className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
                </span>
                <div>
                  <DialogTitle className="text-xl">{heading}</DialogTitle>
                  <DialogDescription>
                    {isRecording
                      ? 'Yayına çıkmadan stüdyoda kayıt alın; kayıt bilgisayarınıza indirilir.'
                      : 'Nerede yayın yapacağınızı seçin ve yayınınızı adlandırın.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {!isRecording && (
              <section className="space-y-3">
                <Label className="text-sm font-semibold">Hedefler</Label>
                <DestinationPicker
                  destinations={destinations}
                  selected={selected}
                  onChange={setSelected}
                  onAdd={() => setAddOpen(true)}
                  disabled={isLive}
                />
                {destinations.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Henüz hedef bağlamadınız. Yayını şimdi oluşturup hedefleri daha sonra stüdyodan da ekleyebilirsiniz.
                  </p>
                )}
                {isLive && <p className="text-xs text-muted-foreground">Yayın sürerken hedefler değiştirilemez.</p>}
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bc-title" className="text-sm font-semibold">
                  Başlık
                </Label>
                <span className="text-xs text-muted-foreground">{title.length}/100</span>
              </div>
              <Input
                id="bc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="ör. Haftalık canlı yayın #12"
                required
                autoFocus
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bc-desc" className="text-sm font-semibold">
                  Açıklama
                </Label>
                <span className="text-xs text-muted-foreground">{description.length}/5000</span>
              </div>
              <Textarea
                id="bc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={3}
                placeholder="İzleyicilerinize bu yayından bahsedin"
              />
            </section>

            <section className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">Sonrası için planla</p>
                    <p className="text-xs text-muted-foreground">Yayın, panelinizde “Yaklaşan” olarak görünür.</p>
                  </div>
                </div>
                <Switch checked={scheduleOn} onCheckedChange={setScheduleOn} />
              </div>
              {scheduleOn && (
                <Input
                  type="datetime-local"
                  className="mt-3"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required={scheduleOn}
                />
              )}
            </section>

            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saving || !title.trim()} className="min-w-[160px]">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Değişiklikleri kaydet' : scheduleOn ? 'Planla' : isRecording ? 'Kayda başla' : 'Canlı yayın oluştur'}
              </Button>
            </div>
          </form>
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
