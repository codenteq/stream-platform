'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, Mic, MicOff, Settings2 } from 'lucide-react';
import { Logo } from '@/components/app/Logo';
import { UserAvatar } from '@/components/app/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface JoinChoices {
  name: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  videoDeviceId?: string;
  audioDeviceId?: string;
}

interface LobbyProps {
  title: string;
  hostName?: string;
  role: 'host' | 'guest';
  defaultName: string;
  joining: boolean;
  error?: string;
  onJoin: (choices: JoinChoices) => void;
}

function MicLevel({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!track) {
      setLevel(0);
      return;
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioContextClass();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => undefined);
    };
  }, [stream]);

  return (
    <div className="flex h-4 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={cn('w-1 rounded-full transition-colors', level * 10 > i ? 'bg-emerald-500' : 'bg-muted-foreground/25')}
          style={{ height: `${40 + i * 6}%` }}
        />
      ))}
    </div>
  );
}

export function Lobby({ title, hostName, role, defaultName, joining, error, onJoin }: LobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>('');
  const [micId, setMicId] = useState<string>('');
  // Kullanıcı seçim yapmadıysa tarayıcının açtığı cihaz (bağımlılık değil, yeniden açmayı tetiklemez)
  const [activeCamId, setActiveCamId] = useState<string>('');
  const [activeMicId, setActiveMicId] = useState<string>('');
  const [name, setName] = useState(defaultName);
  const [permissionError, setPermissionError] = useState('');

  useEffect(() => setName((n) => n || defaultName), [defaultName]);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setCams(all.filter((d) => d.kind === 'videoinput' && d.deviceId));
    setMics(all.filter((d) => d.kind === 'audioinput' && d.deviceId));
  }, []);

  // Önizleme akışını seçili cihazlarla (yeniden) aç
  useEffect(() => {
    let cancelled = false;
    let current: MediaStream | null = null;
    if (!videoEnabled && !audioEnabled) {
      setStream(null);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: videoEnabled ? { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: audioEnabled ? { deviceId: micId ? { exact: micId } : undefined } : false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        current = s;
        setStream(s);
        setPermissionError('');
        const vId = s.getVideoTracks()[0]?.getSettings().deviceId;
        const aId = s.getAudioTracks()[0]?.getSettings().deviceId;
        if (vId) setActiveCamId(vId);
        if (aId) setActiveMicId(aId);
        refreshDevices();
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setStream(null);
        setPermissionError(
          err.name === 'NotAllowedError'
            ? 'Kamera ve mikrofon izni verilmedi. Tarayıcınızın adres çubuğundan izin verebilirsiniz.'
            : err.name === 'NotFoundError'
              ? 'Kamera veya mikrofon bulunamadı.'
              : 'Kamera/mikrofon başlatılamadı. Başka bir uygulama kullanıyor olabilir.'
        );
      });
    return () => {
      cancelled = true;
      current?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEnabled, audioEnabled, camId, micId, refreshDevices]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    // LiveKit cihazları kendisi açacak; önizlemeyi serbest bırak
    stream?.getTracks().forEach((t) => t.stop());
    onJoin({
      name: name.trim(),
      videoEnabled,
      audioEnabled,
      videoDeviceId: camId || activeCamId || undefined,
      audioDeviceId: micId || activeMicId || undefined,
    });
  };

  const hasVideo = videoEnabled && !!stream?.getVideoTracks().length;

  return (
    <div className="flex min-h-screen flex-col bg-muted/60">
      <header className="flex h-16 items-center border-b bg-background px-6">
        <Logo compact={false} href={role === 'host' ? '/dashboard' : '/'} />
      </header>

      <main className="flex flex-1 items-center justify-center p-4 md:p-8">
        <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
              <video ref={videoRef} autoPlay playsInline muted className={cn('h-full w-full scale-x-[-1] object-cover', !hasVideo && 'hidden')} />
              {!hasVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
                  <UserAvatar name={name || '?'} size={88} />
                  <span className="text-sm">{videoEnabled ? 'Kamera başlatılıyor…' : 'Kameranız kapalı'}</span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-4">
                <button
                  type="button"
                  onClick={() => setAudioEnabled((v) => !v)}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full transition',
                    audioEnabled ? 'bg-white/90 text-slate-900 hover:bg-white' : 'bg-destructive text-white'
                  )}
                  aria-label={audioEnabled ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
                >
                  {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setVideoEnabled((v) => !v)}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full transition',
                    videoEnabled ? 'bg-white/90 text-slate-900 hover:bg-white' : 'bg-destructive text-white'
                  )}
                  aria-label={videoEnabled ? 'Kamerayı kapat' : 'Kamerayı aç'}
                >
                  {videoEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {permissionError && <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">{permissionError}</p>}
          </div>

          <form onSubmit={join} className="rounded-2xl border bg-background p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">{role === 'host' ? 'Stüdyonuza giriyorsunuz' : `${hostName || 'Yapımcı'} sizi davet etti`}</p>
            <h1 className="mt-1 text-xl font-bold leading-tight">{title}</h1>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Görünen ad</Label>
                <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Adınız" required autoFocus />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" /> Kamera
                </Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  value={camId || activeCamId}
                  onChange={(e) => setCamId(e.target.value)}
                  disabled={!videoEnabled || cams.length === 0}
                >
                  {cams.length === 0 && <option value="">Kamera bulunamadı</option>}
                  {cams.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Kamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-muted-foreground" /> Mikrofon
                  </span>
                  {audioEnabled && <MicLevel stream={stream} />}
                </Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  value={micId || activeMicId}
                  onChange={(e) => setMicId(e.target.value)}
                  disabled={!audioEnabled || mics.length === 0}
                >
                  {mics.length === 0 && <option value="">Mikrofon bulunamadı</option>}
                  {mics.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mikrofon ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="mt-6 w-full text-base" disabled={joining || !name.trim()}>
              {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Stüdyoya gir
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              {role === 'guest' ? 'Yapımcı sizi sahneye alana kadar izleyiciler sizi görmez.' : 'Cihazlarınızı stüdyoda da değiştirebilirsiniz.'}
            </p>
            {role === 'guest' && (
              <p className="mt-4 border-t pt-4 text-center text-xs text-muted-foreground">
                Bu stüdyonun sahibi misiniz?{' '}
                <a href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/dashboard')}`} className="font-medium text-primary hover:underline">
                  Giriş yapın
                </a>
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
