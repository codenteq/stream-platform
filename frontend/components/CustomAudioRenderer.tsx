import { useTracks } from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { useEffect, useRef } from 'react';

export function CustomAudioRenderer() {
    // Select all audio tracks
    const tracks = useTracks([Track.Source.Microphone, Track.Source.Unknown, Track.Source.ScreenShare]);

    return (
        <div style={{ display: 'none' }}>
            {tracks.map((ref) => {
                // FILTER 1: Do not play local tracks (prevents hearing self)
                if (ref.participant.isLocal) {
                    return null;
                }

                // FILTER 2: Do not play the broadcast mix track (prevents feedback loop "gunshots")
                if (ref.publication.trackName === 'broadcast-mix') {
                    return null;
                }

                return <AudioTrack key={ref.publication.trackSid} trackRef={ref} />;
            })}
        </div>
    );
}

function AudioTrack({ trackRef }: { trackRef: any }) {
    const audioEl = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const el = audioEl.current;
        const track = trackRef.publication.track;
        if (!el || !track) return;

        track.attach(el);
        return () => {
            track.detach(el);
        };
    }, [trackRef]);

    return <audio ref={audioEl} />;
}
