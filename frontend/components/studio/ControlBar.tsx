'use client';

import { useLocalParticipant, useTrackToggle, useTrackVolume } from '@livekit/components-react';
import { Track, type LocalAudioTrack } from 'livekit-client';
import { Camera, CameraOff, LogOut, Mic, MicOff, MonitorUp, MonitorX, Settings, UserPlus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

function ControlButton({
  label,
  onClick,
  active = true,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex w-[76px] flex-col items-center gap-1.5 rounded-xl py-1 text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <span
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors',
          danger
            ? 'text-destructive group-hover:bg-destructive group-hover:text-white'
            : active
              ? 'bg-muted text-foreground group-hover:bg-border'
              : 'bg-destructive text-white group-hover:bg-destructive/90'
        )}
      >
        {children}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/** Mikrofon düğmesinin içindeki küçük VU göstergesi */
function MicLevel({ track }: { track?: LocalAudioTrack }) {
  const volume = useTrackVolume(track);
  const level = Math.min(1, volume * 3);
  return (
    <span className="absolute bottom-[7px] left-1/2 flex h-[3px] w-5 -translate-x-1/2 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
      <span className="h-full rounded-full bg-success transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
    </span>
  );
}

interface ControlBarProps {
  onOpenSettings: () => void;
  onInvite: () => void;
  onLeave: () => void;
}

export function ControlBar({ onOpenSettings, onInvite, onLeave }: ControlBarProps) {
  const onDeviceError = (err: Error) => {
    if (err.name === 'NotAllowedError') toast.error('Tarayıcı izin vermedi. Adres çubuğundan cihaz izinlerini kontrol edin.');
    else toast.error(`Cihaz başlatılamadı: ${err.message}`);
  };
  const mic = useTrackToggle({ source: Track.Source.Microphone, onDeviceError });
  const { microphoneTrack } = useLocalParticipant();
  const cam = useTrackToggle({ source: Track.Source.Camera, onDeviceError });
  const screen = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'include' },
    onDeviceError: (err) => {
      // Kullanıcı paylaşım penceresini iptal ettiyse sessiz geç
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') onDeviceError(err);
    },
  });

  return (
    <div className="flex items-start justify-center gap-0.5 rounded-2xl border bg-background px-2 py-2 shadow-sm sm:gap-1">
      <ControlButton label={mic.enabled ? 'Sesi kapat' : 'Sesi aç'} active={mic.enabled} onClick={() => mic.toggle()} disabled={mic.pending}>
        {mic.enabled ? <Mic className="-mt-1 h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        {mic.enabled && <MicLevel track={microphoneTrack?.track as LocalAudioTrack | undefined} />}
      </ControlButton>
      <ControlButton label={cam.enabled ? 'Kamerayı kapat' : 'Kamerayı aç'} active={cam.enabled} onClick={() => cam.toggle()} disabled={cam.pending}>
        {cam.enabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
      </ControlButton>
      <ControlButton label="Ayarlar" onClick={onOpenSettings}>
        <Settings className="h-5 w-5" />
      </ControlButton>
      <ControlButton label={screen.enabled ? 'Paylaşımı durdur' : 'Ekran paylaş'} onClick={() => screen.toggle()} disabled={screen.pending}>
        {screen.enabled ? <MonitorX className="h-5 w-5 text-primary" /> : <MonitorUp className="h-5 w-5" />}
      </ControlButton>
      <ControlButton label="Davet et" onClick={onInvite}>
        <UserPlus className="h-5 w-5" />
      </ControlButton>
      <div className="mx-1 mt-2 h-8 w-px self-start bg-border" />
      <ControlButton label="Stüdyodan çık" danger onClick={onLeave}>
        <LogOut className="h-5 w-5" />
      </ControlButton>
    </div>
  );
}
