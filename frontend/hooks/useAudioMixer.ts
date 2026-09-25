import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalAudioTrack, RoomEvent, Track, type Participant, type Room } from 'livekit-client';
import type { StageItem } from '@/lib/studio/types';

interface MixNode {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  mst: MediaStreamTrack;
  identity: string;
  kind: 'mic' | 'screen';
}

const EVENTS = [
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.ActiveDeviceChanged,
] as const;

/**
 * Yayına gidecek sesi tarayıcıda karıştırır ve "broadcast-mix" adlı tek bir iz olarak yayınlar.
 * Yalnızca sahnedeki katılımcıların sesi yayına gider; kulistekiler duyulmaz.
 */
export function useAudioMixer(room: Room, enabled: boolean, stage: StageItem[]) {
  const [mixedTrack, setMixedTrack] = useState<LocalAudioTrack | null>(null);
  const [mixStream, setMixStream] = useState<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Map<string, MixNode>>(new Map());
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const applyGains = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const onStage = stageRef.current;
    nodesRef.current.forEach((n) => {
      const audible =
        n.kind === 'screen'
          ? onStage.some((s) => s.identity === n.identity && s.source === 'screen')
          : onStage.some((s) => s.identity === n.identity);
      n.gain.gain.setTargetAtTime(audible ? 1 : 0, ctx.currentTime, 0.04);
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    const dest = ctx.createMediaStreamDestination();
    ctxRef.current = ctx;
    const nodes = nodesRef.current;

    const track = new LocalAudioTrack(dest.stream.getAudioTracks()[0], undefined, false);
    let cancelled = false;
    const publishing = room.localParticipant
      .publishTrack(track, { name: 'broadcast-mix', source: Track.Source.Unknown, dtx: false, red: false })
      .then(() => {
        if (cancelled) return;
        setMixedTrack(track);
        setMixStream(dest.stream);
      })
      .catch((e) => console.error('Karışık ses izi yayınlanamadı', e));

    const sync = () => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
      const wanted = new Map<string, { mst: MediaStreamTrack; identity: string; kind: 'mic' | 'screen' }>();
      const collect = (p: Participant) => {
        p.audioTrackPublications.forEach((pub) => {
          if (!pub.track || pub.trackName === 'broadcast-mix') return;
          const kind = pub.source === Track.Source.Microphone ? 'mic' : pub.source === Track.Source.ScreenShareAudio ? 'screen' : null;
          const mst = pub.track.mediaStreamTrack;
          if (!kind || !mst || mst.readyState === 'ended') return;
          wanted.set(`${p.identity}:${pub.trackSid}`, { mst, identity: p.identity, kind });
        });
      };
      collect(room.localParticipant);
      room.remoteParticipants.forEach(collect);

      nodes.forEach((n, key) => {
        const w = wanted.get(key);
        if (!w || w.mst !== n.mst) {
          n.source.disconnect();
          n.gain.disconnect();
          nodes.delete(key);
        }
      });
      wanted.forEach((w, key) => {
        if (nodes.has(key)) return;
        try {
          const source = ctx.createMediaStreamSource(new MediaStream([w.mst]));
          const gain = ctx.createGain();
          gain.gain.value = 0;
          source.connect(gain).connect(dest);
          nodes.set(key, { source, gain, ...w });
        } catch (e) {
          console.error('Ses mikse eklenemedi', e);
        }
      });
      applyGains();
    };

    EVENTS.forEach((ev) => room.on(ev, sync));
    // Cihaz değişiminde (restartTrack) MediaStreamTrack yenilenir; düzenli kontrol bunu yakalar.
    const interval = window.setInterval(sync, 2000);
    sync();

    return () => {
      cancelled = true;
      EVENTS.forEach((ev) => room.off(ev, sync));
      window.clearInterval(interval);
      nodes.forEach((n) => {
        n.source.disconnect();
        n.gain.disconnect();
      });
      nodes.clear();
      publishing.finally(() => {
        room.localParticipant.unpublishTrack(track).catch(() => undefined);
        track.stop();
        ctx.close().catch(() => undefined);
      });
      ctxRef.current = null;
      setMixedTrack(null);
      setMixStream(null);
    };
  }, [room, enabled, applyGains]);

  useEffect(() => {
    applyGains();
  }, [stage, applyGains]);

  return { mixedTrack, mixStream };
}
