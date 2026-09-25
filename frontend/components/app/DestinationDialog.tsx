'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PLATFORMS, PlatformAvatar, getPlatform } from '@/lib/platforms';
import { api } from '@/lib/api';
import type { Destination } from '@/lib/types';

interface DestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Düzenleme modunda mevcut hedef */
  destination?: Destination | null;
  onSaved?: (destination: Destination) => void;
}

export function DestinationDialog({ open, onOpenChange, destination, onSaved }: DestinationDialogProps) {
  const [platform, setPlatform] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [rtmpUrl, setRtmpUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setShowKey(false);
    if (destination) {
      setPlatform(destination.platform);
      setName(destination.name);
      setRtmpUrl(destination.rtmp_url);
      setStreamKey(destination.stream_key);
    } else {
      setPlatform(null);
      setName('');
      setRtmpUrl('');
      setStreamKey('');
    }
  }, [open, destination]);

  const choose = (id: string) => {
    const p = getPlatform(id);
    setPlatform(p.id);
    setName(p.id === 'Custom' ? '' : p.label);
    setRtmpUrl(p.defaultRtmp);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform) return;
    setSaving(true);
    setError('');
    try {
      const body = { platform, name: name.trim() || getPlatform(platform).label, rtmp_url: rtmpUrl.trim(), stream_key: streamKey.trim() };
      const saved = destination ? await api.updateDestination(destination.id, body) : await api.createDestination(body);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err: any) {
      if (!String(err.message).includes('Session expired')) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const info = platform ? getPlatform(platform) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {!info ? (
          <>
            <DialogHeader>
              <DialogTitle>Hedef ekle</DialogTitle>
              <DialogDescription>Yayınınızı göndermek istediğiniz platformu seçin.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p.id)}
                  className="group flex flex-col items-center gap-2 rounded-xl border bg-background px-2 py-4 text-sm font-medium transition hover:border-primary hover:shadow-md"
                >
                  <PlatformAvatar platform={p.id} size={44} className="transition group-hover:scale-105" />
                  {p.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-3">
                {!destination && (
                  <button type="button" onClick={() => setPlatform(null)} className="rounded-md p-1 hover:bg-secondary" aria-label="Geri">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <PlatformAvatar platform={info.id} size={32} />
                <DialogTitle>{destination ? 'Hedefi düzenle' : `${info.label} bağla`}</DialogTitle>
              </div>
              <DialogDescription className="pt-1">{info.help}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="dest-name">Görünen ad</Label>
              <Input id="dest-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`ör. ${info.label} kanalım`} maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-url">Sunucu URL (RTMP)</Label>
              <Input id="dest-url" value={rtmpUrl} onChange={(e) => setRtmpUrl(e.target.value)} placeholder="rtmp://..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-key">Yayın anahtarı</Label>
              <div className="relative">
                <Input
                  id="dest-key"
                  type={showKey ? 'text' : 'password'}
                  value={streamKey}
                  onChange={(e) => setStreamKey(e.target.value)}
                  className="pr-10"
                  required
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? 'Gizle' : 'Göster'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {destination ? 'Kaydet' : 'Hedefi ekle'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
