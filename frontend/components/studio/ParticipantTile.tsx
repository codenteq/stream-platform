'use client';

import { VideoTrack, useIsMuted, useIsSpeaking } from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import { MicOff, MonitorUp, MoreVertical, Star, UserX, VolumeX } from 'lucide-react';
import { UserAvatar } from '@/components/app/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StageSource } from '@/lib/studio/types';
import { cn } from '@/lib/utils';

interface ParticipantTileProps {
  participant: Participant;
  source: StageSource;
  onStage: boolean;
  isMain?: boolean;
  canManage: boolean;
  onToggleStage?: () => void;
  onMakeMain?: () => void;
  onMute?: () => void;
  onRemove?: () => void;
}

/** Kulis şeridindeki katılımcı kutucuğu. Üzerine gelince "Sahneye ekle / Kaldır" gösterir. */
export function ParticipantTile({ participant, source, onStage, isMain, canManage, onToggleStage, onMakeMain, onMute, onRemove }: ParticipantTileProps) {
  const lkSource = source === 'screen' ? Track.Source.ScreenShare : Track.Source.Camera;
  const pub = participant.getTrackPublication(lkSource);
  const camMuted = useIsMuted({ participant, source: lkSource, publication: pub } as any);
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone, publication: participant.getTrackPublication(Track.Source.Microphone) } as any);
  const speaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity;
  const showVideo = !!pub?.track && !camMuted;
  const hasMic = !!participant.getTrackPublication(Track.Source.Microphone);

  return (
    <div className="group w-[168px] shrink-0">
      <div
        className={cn(
          'relative aspect-video overflow-hidden rounded-lg bg-slate-800 ring-2 transition',
          onStage ? 'ring-primary' : speaking && source === 'camera' ? 'ring-emerald-400' : 'ring-transparent'
        )}
      >
        {showVideo ? (
          <VideoTrack
            trackRef={{ participant, publication: pub!, source: lkSource }}
            className={cn('h-full w-full', source === 'screen' ? 'object-contain' : 'object-cover', participant.isLocal && source === 'camera' && 'scale-x-[-1]')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {source === 'screen' ? <MonitorUp className="h-6 w-6 text-slate-400" /> : <UserAvatar name={name} size={40} />}
          </div>
        )}

        {onStage && (
          <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {isMain ? 'Ana' : 'Sahnede'}
          </span>
        )}
        {source === 'camera' && hasMic && micMuted && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white">
            <MicOff className="h-3 w-3" />
          </span>
        )}

        {canManage && onToggleStage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <Button size="sm" variant={onStage ? 'secondary' : 'default'} className="h-8 shadow" onClick={onToggleStage}>
              {onStage ? 'Kaldır' : 'Sahneye ekle'}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {source === 'screen' ? `${name} · Ekran` : name}
          {participant.isLocal && <span className="text-muted-foreground"> (Siz)</span>}
        </p>
        {canManage && (onMakeMain || onMute || onRemove) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Seçenekler">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onMakeMain && (
                <DropdownMenuItem onSelect={onMakeMain} disabled={!onStage || isMain}>
                  <Star /> Ana görüntü yap
                </DropdownMenuItem>
              )}
              {onMute && (
                <DropdownMenuItem onSelect={onMute} disabled={!hasMic || micMuted}>
                  <VolumeX /> Sessize al
                </DropdownMenuItem>
              )}
              {onRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={onRemove}>
                    <UserX /> Stüdyodan çıkar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
