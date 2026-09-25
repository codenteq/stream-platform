import { useTracks, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useEffect, useRef } from 'react';

/**
 * Uzak katılımcıların sesini çalar. Yerel izler ve yayın miksi ("broadcast-mix")
 * çalınmaz; aksi halde kişi kendi sesini yankı olarak duyardı.
 */
export function CustomAudioRenderer() {
  const tracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown], {
    onlySubscribed: true,
  });

  return (
    <div style={{ display: 'none' }}>
      {tracks.map((ref) => {
        if (ref.participant.isLocal) return null;
        if (ref.publication.kind !== Track.Kind.Audio) return null;
        if (ref.publication.trackName === 'broadcast-mix') return null;
        return <AudioTrack key={ref.publication.trackSid} trackRef={ref as TrackReference} />;
      })}
    </div>
  );
}

function AudioTrack({ trackRef }: { trackRef: TrackReference }) {
  const audioEl = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioEl.current;
    const track = trackRef.publication.track;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [trackRef.publication.track]);

  return <audio ref={audioEl} />;
}
