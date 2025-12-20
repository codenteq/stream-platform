import { useTracks } from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { useEffect, useRef } from 'react';

export function CustomAudioRenderer() {
    // Select all audio tracks
    const tracks = useTracks([Track.Source.Microphone, Track.Source.Unknown, Track.Source.ScreenShareAudio], {
        kind: Track.Kind.Audio,
    });

    return (
        <div style={{ display: 'none' }}>
            {tracks.map((ref) => {
                // FILTER: Do not play the broadcast mix track to prevent echo
                // The broadcast mix track is named 'broadcast-mix'
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
