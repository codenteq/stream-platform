import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioPresets, LocalAudioTrack, RoomEvent, Track, type LocalTrackPublication, type Participant, type Room } from 'livekit-client';
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

const MIX_TRACK_NAME = 'broadcast-mix';

/** Firefox, örnekleme hızı farklı MediaStream kaynaklarını bağlarken hata verebildiği için sabit hız yalnızca diğer tarayıcılarda istenir. */
function createContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
  try {
    // 48 kHz: Opus'un yerel hızı. Bluetooth kulaklığın 16 kHz'e düşürdüğü çıkış cihazından bağımsız kalır.
    return isFirefox ? new AudioContextClass() : new AudioContextClass({ sampleRate: 48000 });
  } catch {
    return new AudioContextClass();
  }
}

/**
 * Yayına gidecek sesi tarayıcıda karıştırır ve "broadcast-mix" adlı tek bir iz olarak yayınlar.
 * Yalnızca sahnedeki katılımcıların sesi yayına gider; kulistekiler duyulmaz.
 *
 * Zincir: kaynaklar → kaynak başına kazanç → sınırlayıcı → gecikme (A/V senkronu) → hedef.
 * Gecikme, kompozit görüntünün canvas üzerinden geçerken biriktirdiği gecikmeyi dengeler;
 * aksi halde yayında ses görüntünün önünde gider.
 */
export function useAudioMixer(room: Room, enabled: boolean, stage: StageItem[], audioDelayMs: number) {
  const [mixedTrack, setMixedTrack] = useState<LocalAudioTrack | null>(null);
  const [mixStream, setMixStream] = useState<MediaStream | null>(null);
  const [mixSid, setMixSid] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const nodesRef = useRef<Map<string, MixNode>>(new Map());
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const delayMsRef = useRef(audioDelayMs);
  delayMsRef.current = audioDelayMs;

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

    const ctx = createContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    const dest = ctx.createMediaStreamDestination();

    // Aynı anda konuşan sesler ve ekran sesi toplandığında 0 dBFS'i aşıp kırpılmasın diye sınırlayıcı
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = Math.max(0, Math.min(1, delayMsRef.current / 1000));
    limiter.connect(delay).connect(dest);

    ctxRef.current = ctx;
    delayRef.current = delay;
    const nodes = nodesRef.current;

    // userProvidedTrack=true: LiveKit bu izi yeniden bağlanmada getUserMedia ile yeniden yakalamaya çalışmasın
    const track = new LocalAudioTrack(dest.stream.getAudioTracks()[0]);
    let cancelled = false;
    const publishing = room.localParticipant
      .publishTrack(track, {
        name: MIX_TRACK_NAME,
        source: Track.Source.Unknown,
        audioPreset: AudioPresets.musicHighQualityStereo,
        forceStereo: true,
        dtx: false,
        red: false,
      })
      .then((pub) => {
        if (cancelled) return;
        setMixedTrack(track);
        setMixStream(dest.stream);
        setMixSid(pub.trackSid);
      })
      .catch((e) => console.error('Karışık ses izi yayınlanamadı', e));

    // Tam yeniden bağlanmada izler yeni kimliklerle yeniden yayınlanır
    const onLocalPublished = (pub: LocalTrackPublication) => {
      if (pub.trackName === MIX_TRACK_NAME) setMixSid(pub.trackSid);
    };
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);

    const sync = () => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
      const wanted = new Map<string, { mst: MediaStreamTrack; identity: string; kind: 'mic' | 'screen' }>();
      const collect = (p: Participant) => {
        p.audioTrackPublications.forEach((pub) => {
          if (!pub.track || pub.trackName === MIX_TRACK_NAME) return;
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
          source.connect(gain).connect(limiter);
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
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      window.clearInterval(interval);
      nodes.forEach((n) => {
        n.source.disconnect();
        n.gain.disconnect();
      });
      nodes.clear();
      ctxRef.current = null;
      delayRef.current = null;
      setMixedTrack(null);
      setMixStream(null);
      setMixSid(null);
      publishing.finally(() => {
        room.localParticipant.unpublishTrack(track).catch(() => undefined);
        track.stop();
        ctx.close().catch(() => undefined);
      });
    };
  }, [room, enabled, applyGains]);

  useEffect(() => {
    applyGains();
  }, [stage, applyGains]);

  // A/V senkron gecikmesi canlıyken de yumuşakça değiştirilebilir
  useEffect(() => {
    const ctx = ctxRef.current;
    const delay = delayRef.current;
    if (!ctx || !delay) return;
    delay.delayTime.setTargetAtTime(Math.max(0, Math.min(1, audioDelayMs / 1000)), ctx.currentTime, 0.1);
  }, [audioDelayMs, mixedTrack]);

  return { mixedTrack, mixStream, mixSid };
}
