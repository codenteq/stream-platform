import { VideoTrack, useIsSpeaking } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { LayoutGrid, User } from 'lucide-react';

export interface StageTrack {
    participant: Participant;
    source: Track.Source;
}

interface ParticipantTileProps {
    participant: Participant;
    source: Track.Source;
    isHost: boolean;
    variant: 'backstage' | 'stage';
    onAddToStage?: (track: StageTrack) => void;
    onRemoveFromStage?: (track: StageTrack) => void;
    onSetFeatured?: (track: StageTrack) => void;
    layout?: 'grid' | 'speaker';
    localParticipant?: Participant;
    isFeatured?: boolean;
}

export function ParticipantTile({
    participant,
    source,
    isHost,
    variant,
    onAddToStage,
    onRemoveFromStage,
    onSetFeatured,
    layout,
    localParticipant,
    isFeatured
}: ParticipantTileProps) {
    const pub = participant.getTrackPublication(source);
    const isSpeaking = useIsSpeaking(participant);

    return (
        <div className={`relative aspect-video bg-gray-800 rounded-lg overflow-hidden ${isSpeaking ? 'border-2 border-green-500' : ''}`}>
            {pub?.track ? (
                <VideoTrack trackRef={{ participant: participant, publication: pub, source: pub.source }} />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    {source === Track.Source.ScreenShare ? (
                        <div className="text-gray-400 flex flex-col items-center">
                            <LayoutGrid className="h-8 w-8 mb-2" />
                            <span className="text-xs">Ekran Paylaşımı</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <User className={`text-gray-400 ${variant === 'stage' ? 'h-12 w-12' : 'h-8 w-8'}`} />
                            <span className="text-xs text-gray-500 mt-1">Kamera Kapalı</span>
                        </div>
                    )}
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                <p className="text-white text-sm truncate">
                    {participant.identity} {source === Track.Source.ScreenShare ? '(Ekran)' : ''} {participant.isLocal ? '(Siz)' : ''}
                </p>
            </div>

            {isHost && variant === 'backstage' && onAddToStage && (
                <Button variant="secondary" size="sm" className="absolute top-2 right-2 z-10" onClick={() => onAddToStage({ participant, source })}>
                    Sahneye Ekle
                </Button>
            )}

            {isHost && variant === 'stage' && (
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                    {onRemoveFromStage && (
                        <Button variant="destructive" size="sm" className="p-1 h-auto" onClick={() => onRemoveFromStage({ participant, source })}>Çıkar</Button>
                    )}
                    {layout === 'speaker' && !isFeatured && onSetFeatured && (
                        <Button variant="secondary" size="sm" className="p-1 h-auto" onClick={() => onSetFeatured({ participant, source })}>Öne Çıkar</Button>
                    )}
                </div>
            )}
        </div>
    );
}
