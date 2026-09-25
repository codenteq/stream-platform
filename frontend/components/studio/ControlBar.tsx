'use client';

import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
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
      className="group flex w-[72px] flex-col items-center gap-1 text-[11px] font-medium text-muted-foreground disabled:opacity-50"
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full transition',
          danger
            ? 'bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-white'
            : active
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border group-hover:bg-secondary'
              : 'bg-destructive text-white shadow-sm group-hover:bg-destructive/90'
        )}
      >
        {children}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
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
    <div className="flex items-start justify-center gap-1 sm:gap-2">
      <ControlButton label={mic.enabled ? 'Sesi kapat' : 'Sesi aç'} active={mic.enabled} onClick={() => mic.toggle()} disabled={mic.pending}>
        {mic.enabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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
      <div className="mx-1 mt-2 h-8 w-px bg-border" />
      <ControlButton label="Stüdyodan çık" danger onClick={onLeave}>
        <LogOut className="h-5 w-5" />
      </ControlButton>
    </div>
  );
}
