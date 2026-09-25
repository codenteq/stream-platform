'use client';

import { useState } from 'react';
import { useMediaDeviceSelect } from '@livekit/components-react';
import { Camera, Gauge, Volume2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { BITRATE_OPTIONS, DEFAULT_BITRATE, audioDelayFor, autoAudioDelayMs, type QualityId, type StreamSettings } from '@/lib/studio/types';
import { cn } from '@/lib/utils';

type Tab = 'camera' | 'audio' | 'quality';

function DeviceSelect({ kind, label }: { kind: MediaDeviceKind; label: string }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: false });
  const fallback = kind === 'videoinput' ? 'Kamera' : kind === 'audioinput' ? 'Mikrofon' : 'Hoparlör';
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={activeDeviceId}
        onChange={(e) => setActiveMediaDevice(e.target.value)}
      >
        {devices.length === 0 && <option value="">Cihaz bulunamadı</option>}
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${fallback} ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isHost: boolean;
  isLive: boolean;
  settings: StreamSettings;
  onSettingsChange: (s: StreamSettings) => void;
}

export function SettingsDialog({ open, onOpenChange, isHost, isLive, settings, onSettingsChange }: SettingsDialogProps) {
  const [tab, setTab] = useState<Tab>('camera');
  const tabs: { id: Tab; label: string; Icon: typeof Camera }[] = [
    { id: 'camera', label: 'Kamera', Icon: Camera },
    { id: 'audio', label: 'Ses', Icon: Volume2 },
    ...(isHost ? [{ id: 'quality' as Tab, label: 'Yayın kalitesi', Icon: Gauge }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Ayarlar</DialogTitle>
        </DialogHeader>
        <div className="grid min-h-[320px] grid-cols-[180px_1fr]">
          <nav className="space-y-1 border-r bg-muted/50 p-3">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium',
                  tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="space-y-5 p-6">
            {tab === 'camera' && <DeviceSelect kind="videoinput" label="Kamera" />}
            {tab === 'audio' && (
              <>
                <DeviceSelect kind="audioinput" label="Mikrofon" />
                <DeviceSelect kind="audiooutput" label="Hoparlör" />
                {isHost && (
                  <div className="space-y-2 border-t pt-5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="av-delay">Ses-görüntü senkronu</Label>
                      <span className="tabular text-sm font-semibold">{audioDelayFor(settings)} ms</span>
                    </div>
                    <input
                      id="av-delay"
                      type="range"
                      min={0}
                      max={400}
                      step={10}
                      value={audioDelayFor(settings)}
                      onChange={(e) => onSettingsChange({ ...settings, audioDelayMs: Number(e.target.value) })}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Yayında ses görüntünün önünde gidiyorsa artırın. Otomatik değer kare hızına göre {autoAudioDelayMs(settings.fps)} ms.
                      </p>
                      {settings.audioDelayMs !== null && (
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-primary hover:underline"
                          onClick={() => onSettingsChange({ ...settings, audioDelayMs: null })}
                        >
                          Otomatiğe dön
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === 'quality' && isHost && (
              <>
                {isLive && <p className="rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900">Kalite ayarları yayın sırasında değiştirilemez.</p>}
                <div className="space-y-2">
                  <Label>Çözünürlük</Label>
                  <select
                    className={selectCls}
                    value={settings.quality}
                    disabled={isLive}
                    onChange={(e) => {
                      const q = e.target.value as QualityId;
                      onSettingsChange({ ...settings, quality: q, videoBitrate: DEFAULT_BITRATE[q] });
                    }}
                  >
                    <option value="1080p">1080p Full HD</option>
                    <option value="720p">720p HD</option>
                    <option value="480p">480p SD</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Kare hızı</Label>
                  <select className={selectCls} value={settings.fps} disabled={isLive} onChange={(e) => onSettingsChange({ ...settings, fps: Number(e.target.value) })}>
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Video bit hızı</Label>
                  <select
                    className={selectCls}
                    value={settings.videoBitrate}
                    disabled={isLive}
                    onChange={(e) => onSettingsChange({ ...settings, videoBitrate: Number(e.target.value) })}
                  >
                    {BITRATE_OPTIONS[settings.quality].map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {settings.fps === 60 && <p className="text-xs text-muted-foreground">60 FPS'te bit hızı otomatik olarak %50 artırılır.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
