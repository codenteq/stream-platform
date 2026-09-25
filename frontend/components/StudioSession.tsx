'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useStartAudio,
  useTracks,
  type TrackReference,
} from '@livekit/components-react';
import { ConnectionState, DisconnectReason, LocalVideoTrack, RoomEvent, Track, VideoPresets, type LocalTrackPublication, type Participant } from 'livekit-client';
import { Loader2, MonitorPlay, Volume2 } from 'lucide-react';
import { CustomAudioRenderer } from '@/components/CustomAudioRenderer';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { ControlBar } from '@/components/studio/ControlBar';
import { ParticipantTile } from '@/components/studio/ParticipantTile';
import { LayoutIcon } from '@/components/studio/LayoutIcon';
import { StudioSidebar, type SidebarTab } from '@/components/studio/StudioSidebar';
import { BrandPanel } from '@/components/studio/panels/BrandPanel';
import { BannersPanel } from '@/components/studio/panels/BannersPanel';
import { ChatPanel } from '@/components/studio/panels/ChatPanel';
import { SettingsDialog } from '@/components/studio/SettingsDialog';
import { InviteDialog } from '@/components/studio/InviteDialog';
import { GoLiveDialog } from '@/components/studio/GoLiveDialog';
import { BitrateIndicator } from '@/components/studio/BitrateIndicator';
import type { JoinChoices } from '@/components/studio/Lobby';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAudioMixer } from '@/hooks/useAudioMixer';
import { useCompositor } from '@/hooks/useCompositor';
import { useLocalRecorder } from '@/hooks/useLocalRecorder';
import { useStudioChannel } from '@/hooks/useStudioChannel';
import { api } from '@/lib/api';
import { fetchWithAuth } from '@/lib/utils';
import { toast } from '@/lib/toast';
import type { Broadcast } from '@/lib/types';
import {
  DEFAULT_BITRATE,
  DEFAULT_BRAND,
  LAYOUTS,
  QUALITY_SIZES,
  audioDelayFor,
  effectiveBitrate,
  stageKey,
  type Banner,
  type BrandConfig,
  type ChatMessage,
  type LayoutId,
  type SceneMessage,
  type StageItem,
  type StageSource,
  type StreamSettings,
} from '@/lib/studio/types';
import { cn } from '@/lib/utils';

export type LeaveReason = 'left' | 'removed' | 'ended' | 'duplicate' | 'error';

interface StudioSessionProps {
  token: string;
  serverUrl: string;
  studioCode: string;
  role: 'host' | 'guest';
  title: string;
  broadcast: Broadcast | null;
  choices: JoinChoices;
  onLeft: (reason: LeaveReason) => void;
}

function brandFromBroadcast(b: Broadcast | null): BrandConfig {
  if (!b) return DEFAULT_BRAND;
  return {
    color: b.brand_color || DEFAULT_BRAND.color,
    theme: (b.theme as BrandConfig['theme']) || 'default',
    showNames: b.show_names ?? true,
    logoUrl: b.logo_url || '',
    showLogo: !!b.show_logo,
    overlayUrl: b.overlay_url || '',
    showOverlay: !!b.show_overlay,
    backgroundUrl: b.background_url || '',
  };
}

function parseBanners(raw: string | undefined): Banner[] {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v.filter((b) => b && typeof b.text === 'string') : [];
  } catch {
    return [];
  }
}

function StartAudioOverlay() {
  const { canPlayAudio, mergedProps } = useStartAudio({ props: {} });
  if (canPlayAudio) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-sm rounded-2xl bg-background p-6 text-center shadow-2xl">
        <Volume2 className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="mb-4 font-medium">Stüdyodaki sesleri duymak için tarayıcınızın izni gerekiyor.</p>
        <Button {...mergedProps} size="lg" className="w-full">
          Sesi etkinleştir
        </Button>
      </div>
    </div>
  );
}

/** Kompozitör için tüm kamera ve ekran izlerini görünmez <video> öğelerine bağlar. */
const HiddenVideos = memo(function HiddenVideos({ videoEls }: { videoEls: React.MutableRefObject<Map<string, HTMLVideoElement>> }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  return (
    <div aria-hidden style={{ position: 'fixed', left: 0, top: 0, width: 320, height: 180, opacity: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: -1 }}>
      {tracks.map((t) => {
        const key = stageKey({ identity: t.participant.identity, source: t.source === Track.Source.ScreenShare ? 'screen' : 'camera' });
        return (
          <VideoTrack
            key={key}
            trackRef={t as TrackReference}
            muted
            ref={(el: HTMLVideoElement | null) => {
              if (el) videoEls.current.set(key, el);
              else videoEls.current.delete(key);
            }}
          />
        );
      })}
    </div>
  );
});

interface HostStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  stage: StageItem[];
  layout: LayoutId;
  brand: BrandConfig;
  banner: Banner | null;
  settings: StreamSettings;
  onCompositeSid: (sid: string | null) => void;
}

/** Yapımcı tarafı: sahneyi canvas'a çizer ve bu görüntüyü "canvas-composite" izi olarak yayınlar. */
function HostStage({ canvasRef, stage, layout, brand, banner, settings, onCompositeSid }: HostStageProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map());
  const { width, height } = QUALITY_SIZES[settings.quality];

  useCompositor(canvasRef, videoEls, { room, stage, layout, brand, banner }, width, height, settings.fps);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !localParticipant) return;
    const mst = canvas.captureStream(settings.fps).getVideoTracks()[0];
    if (!mst) return;
    // userProvidedTrack=true (varsayılan): LiveKit yeniden bağlanmada bu izi getUserMedia ile yeniden yakalamaya çalışmasın
    const track = new LocalVideoTrack(mst);
    let cancelled = false;
    const publishing = localParticipant
      .publishTrack(track, {
        name: 'canvas-composite',
        // H.264 çoğu cihazda donanımla kodlanır; 1080p60 yazılım VP8'e göre CPU'yu rahatlatır
        videoCodec: 'h264',
        // Egress en üst katmanı alır; zayıf bağlantılı misafirler 360p katmanına düşebilir
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h360],
        videoEncoding: { maxBitrate: effectiveBitrate(settings) * 1000, maxFramerate: settings.fps },
        degradationPreference: 'balanced',
      })
      .then((pub) => {
        if (!cancelled) onCompositeSid(pub.trackSid);
      })
      .catch((e) => console.error('Kompozit görüntü yayınlanamadı', e));
    return () => {
      cancelled = true;
      onCompositeSid(null);
      // Yayınlama sürerken temizlenirse, iz yetim kalmasın diye yayın bitince geri çek
      publishing.finally(() => {
        localParticipant.unpublishTrack(track).catch(() => undefined);
        track.stop();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, localParticipant, settings.fps, settings.videoBitrate, width, height, onCompositeSid]);

  // Tam yeniden bağlanmada izler yeni kimliklerle yeniden yayınlanır; egress'in yeniden bağlanabilmesi için takip et
  useEffect(() => {
    const onPublished = (pub: LocalTrackPublication) => {
      if (pub.trackName === 'canvas-composite') onCompositeSid(pub.trackSid);
    };
    room.on(RoomEvent.LocalTrackPublished, onPublished);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, onPublished);
    };
  }, [room, onCompositeSid]);

  return (
    <>
      <canvas ref={canvasRef} className="h-full w-full" />
      <HiddenVideos videoEls={videoEls} />
    </>
  );
}

/** Misafir tarafı: yapımcının yayınladığı kompozit görüntüyü gösterir (yayında görünenin aynısı). */
function GuestStage() {
  const tracks = useTracks([Track.Source.Unknown]);
  const composite = tracks.filter((t) => t.publication.kind === Track.Kind.Video && t.publication.trackName === 'canvas-composite' && !t.publication.isMuted).pop();
  if (!composite) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-300">
        <MonitorPlay className="h-8 w-8" />
        <p className="text-sm">Yapımcının stüdyoya katılması bekleniyor…</p>
      </div>
    );
  }
  return <VideoTrack trackRef={composite as TrackReference} className="h-full w-full object-contain" />;
}

function StudioContent({
  studioCode,
  role,
  title,
  initialBroadcast,
}: {
  studioCode: string;
  role: 'host' | 'guest';
  title: string;
  initialBroadcast: Broadcast | null;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants({
    updateOnlyOn: [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantNameChanged,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ],
  });
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const isHost = role === 'host';

  const [broadcast, setBroadcast] = useState<Broadcast | null>(initialBroadcast);
  const [stage, setStage] = useState<StageItem[]>([]);
  const [layout, setLayout] = useState<LayoutId>('group');
  const [brand, setBrand] = useState<BrandConfig>(() => brandFromBroadcast(initialBroadcast));
  const [banners, setBanners] = useState<Banner[]>(() => parseBanners(initialBroadcast?.banners));
  const [activeBannerId, setActiveBannerId] = useState<string | null>(null);
  const [settings, setSettings] = useState<StreamSettings>({ quality: '1080p', fps: 30, videoBitrate: DEFAULT_BITRATE['1080p'], audioDelayMs: null });
  const initiallyLive = !!initialBroadcast?.targets.some((t) => t.egress_id);
  const [isLive, setIsLive] = useState(initiallyLive);
  const [liveSince, setLiveSince] = useState<number | null>(
    initiallyLive && initialBroadcast?.started_at ? Date.parse(initialBroadcast.started_at) : initiallyLive ? Date.now() : null
  );
  const [busy, setBusy] = useState(false);
  const [compositeSid, setCompositeSid] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab | null>(isHost ? 'brand' : 'chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; text: string; action: string; onConfirm: () => void }>(null);
  const [remoteScene, setRemoteScene] = useState<SceneMessage | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorder = useLocalRecorder();
  const { mixStream, mixSid } = useAudioMixer(room, isHost, stage, audioDelayFor(settings));

  const activeBanner = banners.find((b) => b.id === activeBannerId) || null;

  // ---------- Sahne yönetimi (yapımcı) ----------

  // Yapımcının kamerası varsayılan olarak sahnede başlar
  const seededRef = useRef(false);
  useEffect(() => {
    if (!isHost || seededRef.current || !localParticipant?.identity) return;
    seededRef.current = true;
    setStage([{ identity: localParticipant.identity, source: 'camera' }]);
  }, [isHost, localParticipant?.identity]);

  // Biten ekran paylaşımlarını hemen, ayrılan katılımcıları ise bir süre bekleyip sahneden çıkar.
  // Yeniden bağlanan biri (ya da yapımcının kendi bağlantısı yenilenirken tüm misafirler)
  // kısa süreliğine listeden düşer; hemen çıkarılsaydı yayında sahne boşalırdı.
  const connectedKey = participants.map((p) => p.identity).sort().join('|');
  const screenKey = screenTracks.map((t) => t.participant.identity).sort().join('|');
  useEffect(() => {
    if (!isHost || room.state !== ConnectionState.Connected) return;
    const connected = new Set(connectedKey.split('|'));
    const sharing = new Set(screenKey.split('|'));
    setStage((prev) => {
      const next = prev.filter((i) => !(i.source === 'screen' && connected.has(i.identity) && !sharing.has(i.identity)));
      return next.length === prev.length ? prev : next;
    });
    const t = setTimeout(() => {
      if (room.state !== ConnectionState.Connected) return;
      const present = new Set([room.localParticipant.identity, ...Array.from(room.remoteParticipants.keys())]);
      setStage((prev) => {
        const next = prev.filter((i) => present.has(i.identity));
        return next.length === prev.length ? prev : next;
      });
    }, 20000);
    return () => clearTimeout(t);
  }, [isHost, room, connectedKey, screenKey]);

  // Yapımcı ekran paylaşınca paylaşım otomatik olarak sahneye alınır
  const localSharing = !!localParticipant && screenTracks.some((t) => t.participant.identity === localParticipant.identity);
  const prevSharingRef = useRef(false);
  useEffect(() => {
    if (!isHost || !localParticipant) return;
    if (localSharing && !prevSharingRef.current) {
      const item: StageItem = { identity: localParticipant.identity, source: 'screen' };
      setStage((prev) => [item, ...prev.filter((i) => stageKey(i) !== stageKey(item))]);
      setLayout((l) => (l === 'group' || l === 'solo' || l === 'thin' ? 'screen' : l));
    }
    prevSharingRef.current = localSharing;
  }, [isHost, localParticipant, localSharing]);

  const isOnStage = useCallback((identity: string, source: StageSource) => stage.some((i) => i.identity === identity && i.source === source), [stage]);

  const toggleStage = (identity: string, source: StageSource) => {
    setStage((prev) => {
      const key = `${identity}:${source}`;
      if (prev.some((i) => stageKey(i) === key)) return prev.filter((i) => stageKey(i) !== key);
      const item = { identity, source };
      return source === 'screen' ? [item, ...prev] : [...prev, item];
    });
  };

  const makeMain = (identity: string, source: StageSource) => {
    setStage((prev) => {
      const key = `${identity}:${source}`;
      const item = prev.find((i) => stageKey(i) === key);
      return item ? [item, ...prev.filter((i) => stageKey(i) !== key)] : prev;
    });
  };

  // ---------- Veri kanalları: sahne senkronu ve sohbet ----------

  const sendScene = useStudioChannel<SceneMessage | { type: 'scene-request' }>(room, 'scene', (data, from) => {
    if (isHost && data?.type === 'scene-request') publishSceneRef.current();
    if (isHost || data?.type !== 'scene') return;
    // Misafirler de veri yayınlayabildiği için sahte sahne mesajlarını yok say
    if (!from?.identity.startsWith('host-')) return;
    if (!Array.isArray(data.stage) || typeof data.layout !== 'string') return;
    const stage = data.stage.filter((i): i is StageItem => !!i && typeof i.identity === 'string' && (i.source === 'camera' || i.source === 'screen'));
    setRemoteScene({ type: 'scene', stage, layout: data.layout, isLive: data.isLive === true });
  });

  const publishScene = useCallback(() => {
    if (!isHost) return;
    const msg: SceneMessage = { type: 'scene', stage, layout, isLive };
    sendScene(msg).catch(() => undefined);
  }, [isHost, stage, layout, isLive, sendScene]);
  const publishSceneRef = useRef(publishScene);
  publishSceneRef.current = publishScene;

  useEffect(() => {
    publishScene();
  }, [publishScene]);

  useEffect(() => {
    if (!isHost) return;
    const resend = () => setTimeout(() => publishSceneRef.current(), 600);
    room.on(RoomEvent.ParticipantConnected, resend);
    // Yeniden bağlanırken gönderilemeyen güncellemeler kaybolur; bağlantı dönünce tekrar yayınla
    room.on(RoomEvent.Reconnected, resend);
    return () => {
      room.off(RoomEvent.ParticipantConnected, resend);
      room.off(RoomEvent.Reconnected, resend);
    };
  }, [isHost, room]);

  // Misafir bağlanınca (ve yeniden bağlanınca) güncel sahneyi ister
  useEffect(() => {
    if (isHost) return;
    const ask = () => sendScene({ type: 'scene-request' }).catch(() => undefined);
    const t = setTimeout(ask, 800);
    room.on(RoomEvent.Reconnected, ask);
    return () => {
      clearTimeout(t);
      room.off(RoomEvent.Reconnected, ask);
    };
  }, [isHost, room, sendScene]);

  const sidebarTabRef = useRef(sidebarTab);
  sidebarTabRef.current = sidebarTab;
  const sendChat = useStudioChannel<{ id?: string; text?: string }>(room, 'chat', (data, from) => {
    if (typeof data.text !== 'string') return;
    setMessages((prev) => [
      ...prev,
      { id: data.id || String(Date.now()), identity: from?.identity || '', name: from?.name || from?.identity || 'Misafir', text: data.text!.slice(0, 500), ts: Date.now() },
    ]);
    if (sidebarTabRef.current !== 'chat') setUnread((n) => n + 1);
  });

  const postChat = (text: string) => {
    const id = Math.random().toString(36).slice(2);
    setMessages((prev) => [...prev, { id, identity: localParticipant.identity, name: localParticipant.name || 'Siz', text, ts: Date.now() }]);
    sendChat({ id, text }).catch(() => toast.error('Mesaj gönderilemedi'));
  };

  useEffect(() => {
    if (sidebarTab === 'chat') setUnread(0);
  }, [sidebarTab]);

  // ---------- Marka ve banner kalıcılığı (yapımcı) ----------

  const pendingSave = useRef<Record<string, unknown>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const queueSave = useCallback(
    (patch: Record<string, unknown>) => {
      if (!broadcast) return;
      pendingSave.current = { ...pendingSave.current, ...patch };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const body = pendingSave.current;
        pendingSave.current = {};
        api.updateBroadcast(broadcast.id, body).catch((e) => toast.error(`Değişiklikler kaydedilemedi: ${e.message}`));
      }, 800);
    },
    [broadcast]
  );

  const updateBrand = (patch: Partial<BrandConfig>) => {
    setBrand((prev) => ({ ...prev, ...patch }));
    // Yalnızca değişen alanlar gönderilir: logo/overlay/arka plan data URL'leri megabaytlarca olabilir
    // ve yayındayken yükleme bant genişliğini gereksiz yere tüketir.
    const fields: Record<keyof BrandConfig, string> = {
      color: 'brand_color',
      theme: 'theme',
      showNames: 'show_names',
      logoUrl: 'logo_url',
      showLogo: 'show_logo',
      overlayUrl: 'overlay_url',
      showOverlay: 'show_overlay',
      backgroundUrl: 'background_url',
    };
    const body: Record<string, unknown> = {};
    (Object.keys(patch) as (keyof BrandConfig)[]).forEach((k) => {
      body[fields[k]] = patch[k];
    });
    queueSave(body);
  };

  const updateBanners = (next: Banner[]) => {
    setBanners(next);
    if (activeBannerId && !next.some((b) => b.id === activeBannerId)) setActiveBannerId(null);
    queueSave({ banners: JSON.stringify(next) });
  };

  // ---------- Canlı yayın ----------

  const refreshBroadcast = useCallback(async () => {
    try {
      setBroadcast(await api.broadcastByStudio(studioCode));
    } catch {
      /* sessizce geç */
    }
  }, [studioCode]);

  // Egress'in bağlı olduğu iz kimlikleri. Yeniden bağlanma veya sayfa yenileme sonrası izler
  // yeni kimliklerle yayınlanınca egress bu eski kimliklere bağlı kalır ve yayın akmaz.
  const boundTracksRef = useRef<{ video: string; audio: string } | null>(null);
  const rebindingRef = useRef(false);

  const currentAudioTrackId = () => mixSid || localParticipant.getTrackPublication(Track.Source.Microphone)?.trackSid || null;

  /** start-egress isteği; yalnızca ağ hatası ve geçici (503/504) yanıtlar yeniden denenir. */
  const requestEgress = async (videoTrackId: string, audioTrackId: string, restart: boolean) => {
    const maxRetries = 3;
    let lastError = '';
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let res: Response;
      try {
        res = await fetchWithAuth(`/api/broadcasts/studio/${studioCode}/start-egress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId: videoTrackId,
            audioTrackId,
            quality: settings.quality,
            fps: settings.fps,
            videoBitrate: settings.videoBitrate,
            audioBitrate: 128,
            restart,
          }),
        });
      } catch (err: any) {
        if (String(err.message).includes('Session expired')) throw err;
        lastError = err.message;
        if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        continue;
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        boundTracksRef.current = { video: videoTrackId, audio: audioTrackId };
        if (Array.isArray(data.failed) && data.failed.length > 0) {
          toast.error(`${data.failed.map((f: any) => f.name || f.platform).join(', ')} hedefine bağlanılamadı.`);
        }
        return data as { started_at?: string };
      }

      lastError = data.error || '';
      if (/track.*not found/i.test(lastError)) throw new Error('Yayın görüntüsü bulunamadı. Sayfayı yenileyip tekrar deneyin.');
      if (/no response from servers|unavailable/i.test(lastError) || (!lastError && res.status >= 500)) {
        lastError = 'Yayın servisine (egress) ulaşılamadı. Sunucuda egress servisinin çalıştığından emin olun.';
      }
      if ((res.status === 503 || res.status === 504) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        continue;
      }
      break;
    }
    throw new Error(lastError || 'Yayın başlatılamadı.');
  };

  const startEgress = async (updated: Broadcast) => {
    setBroadcast(updated);
    if (!compositeSid) throw new Error('Stüdyo görüntüsü henüz hazır değil. Birkaç saniye sonra tekrar deneyin.');
    const audioTrackId = currentAudioTrackId();
    if (!audioTrackId) throw new Error('Ses kaynağı bulunamadı. Mikrofonunuzu kontrol edin.');
    if (updated.targets.length === 0) throw new Error('Lütfen en az bir hedef seçin.');

    const data = await requestEgress(compositeSid, audioTrackId, false);
    setIsLive(true);
    setLiveSince(data.started_at ? Date.parse(data.started_at) : Date.now());
    toast.success('Canlı yayındasınız!');
    refreshBroadcast();
  };

  // Yayındayken izler yeni kimlik aldıysa (yeniden bağlanma, sayfa yenileme) egress'i yeni izlere bağla
  useEffect(() => {
    if (!isHost || !isLive || !compositeSid || !mixSid || rebindingRef.current) return;
    const bound = boundTracksRef.current;
    if (bound && bound.video === compositeSid && bound.audio === mixSid) return;
    rebindingRef.current = true;
    requestEgress(compositeSid, mixSid, true)
      .then(() => {
        toast('Yayın bağlantısı yenilendi, yayın sürüyor.');
        refreshBroadcast();
      })
      .catch((err: Error) => {
        toast.error(`Yayın yeniden bağlanamadı: ${err.message}`);
        setIsLive(false);
        setLiveSince(null);
      })
      .finally(() => {
        rebindingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, isLive, compositeSid, mixSid]);

  const stopEgress = async () => {
    setBusy(true);
    try {
      const res = await fetchWithAuth(`/api/broadcasts/studio/${studioCode}/stop-egress`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      boundTracksRef.current = null;
      setIsLive(false);
      setLiveSince(null);
      toast.success('Yayın sona erdi.');
      refreshBroadcast();
      return true;
    } catch (err: any) {
      // Durdurulamayan çıkışlar yayında kalır; kullanıcı tekrar deneyebilsin diye durumu değiştirme
      if (!String(err.message).includes('Session expired')) toast.error(`Yayın durdurulamadı, tekrar deneyin. ${err.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Yayındayken sekme kapatılmak istenirse uyar
  useEffect(() => {
    if (!isHost || !isLive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isHost, isLive]);

  // ---------- Katılımcı işlemleri ----------

  const muteParticipant = async (p: Participant) => {
    const mic = p.getTrackPublication(Track.Source.Microphone);
    if (!mic) return;
    try {
      await api.muteParticipant(studioCode, p.identity, mic.trackSid);
      toast(`${p.name || p.identity} sessize alındı`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeParticipant = (p: Participant) => {
    setConfirm({
      title: `${p.name || p.identity} stüdyodan çıkarılsın mı?`,
      text: 'Kişi stüdyodan çıkarılır. Davet linkiyle tekrar katılabilir.',
      action: 'Çıkar',
      onConfirm: async () => {
        try {
          await api.removeParticipant(studioCode, p.identity);
        } catch (e: any) {
          toast.error(e.message);
        }
      },
    });
  };

  const leave = () => {
    if (isHost && isLive) {
      setConfirm({
        title: 'Stüdyodan çıkılsın mı?',
        text: 'Yayın devam ediyor. Stüdyodan çıkarsanız yayın sona erer.',
        action: 'Yayını bitir ve çık',
        onConfirm: async () => {
          if (recorder.isRecording) recorder.stop();
          // Durdurma başarısız olsa bile ayrılınca izler kalkar ve egress kendiliğinden sona erer;
          // kalan kayıtlar bir sonraki yayın başlatılırken temizlenir.
          await stopEgress();
          room.disconnect();
        },
      });
      return;
    }
    if (recorder.isRecording) recorder.stop();
    room.disconnect();
  };

  const toggleRecording = () => {
    if (recorder.isRecording) {
      recorder.stop();
      toast.success('Kayıt tamamlandı, dosya indiriliyor.');
      return;
    }
    if (!canvasRef.current) return;
    recorder.start(canvasRef.current, mixStream, settings.fps, broadcast?.title || title);
    toast('Kayıt başladı. Kayıt bu tarayıcıda tutulur; sekmeyi kapatmayın.');
  };

  // ---------- Görünüm ----------

  const guestOnStage = !isHost && !!remoteScene?.stage.some((i) => i.identity === localParticipant.identity);
  const showLive = isHost ? isLive : !!remoteScene?.isLive;
  const mainItem = stage[0];

  const backstage: { participant: Participant; source: StageSource }[] = [];
  participants.forEach((p) => {
    backstage.push({ participant: p, source: 'camera' });
    if (screenTracks.some((t) => t.participant.identity === p.identity)) backstage.push({ participant: p, source: 'screen' });
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-studio">
      <StudioHeader
        title={broadcast?.title || title}
        isHost={isHost}
        isLive={showLive}
        liveSince={liveSince}
        targets={broadcast?.targets || []}
        isRecording={recorder.isRecording}
        recordingSince={recorder.startedAt}
        canRecord={isHost && recorder.supported}
        busy={busy}
        onGoLive={() => setGoLiveOpen(true)}
        onEndLive={() =>
          setConfirm({
            title: 'Yayın bitirilsin mi?',
            text: 'Tüm hedeflerdeki canlı yayın sona erecek. Stüdyoda kalmaya devam edebilirsiniz.',
            action: 'Yayını bitir',
            onConfirm: stopEgress,
          })
        }
        onToggleRecording={toggleRecording}
        guestOnStage={guestOnStage}
        statusSlot={
          isLive ? (
            <div className="hidden lg:block">
              <BitrateIndicator targetBitrate={effectiveBitrate(settings)} isLive={isLive} />
            </div>
          ) : null
        }
      />

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-4 pt-4 sm:px-6 scrollbar-thin">
          {/* Sahne */}
          <div className="w-full" style={{ maxWidth: 'min(1120px, calc((100vh - 430px) * 16 / 9))', minWidth: 'min(100%, 480px)' }}>
            {/* Program monitörü: yayındayken çerçeve tally kırmızısına döner */}
            <div
              className={cn(
                'rounded-xl bg-bezel p-1.5 shadow-[0_18px_50px_-18px_rgba(16,26,44,0.55)] transition-shadow',
                showLive ? 'ring-2 ring-live shadow-[0_0_0_5px_hsl(var(--live)/0.14),0_18px_50px_-18px_rgba(16,26,44,0.55)]' : 'ring-1 ring-black/5'
              )}
            >
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-bezel">
              {isHost ? (
                <HostStage
                  canvasRef={canvasRef}
                  stage={stage}
                  layout={layout}
                  brand={brand}
                  banner={activeBanner}
                  settings={settings}
                  onCompositeSid={setCompositeSid}
                />
              ) : (
                <GuestStage />
              )}
              {isHost && stage.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="rounded-lg bg-black/55 px-4 py-2 text-sm text-white">Sahne boş. Aşağıdaki kutucuklardan birini sahneye ekleyin.</p>
                </div>
              )}
            </div>
            </div>

            {/* Düzenler */}
            {isHost && (
              <div className="mt-3 flex justify-center">
                <div className="inline-flex flex-wrap justify-center gap-0.5 rounded-xl border bg-background p-1" role="radiogroup" aria-label="Sahne düzeni">
                  {LAYOUTS.map((l) => (
                    <Hint key={l.id} label={l.label}>
                      <button
                        onClick={() => setLayout(l.id)}
                        role="radio"
                        aria-checked={layout === l.id}
                        className={cn(
                          'flex h-9 w-12 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          layout === l.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                        aria-label={l.label}
                      >
                        <LayoutIcon layout={l.id} className="h-5 w-9" />
                      </button>
                    </Hint>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Kulis */}
          <div className="mt-4 w-full max-w-[1120px]">
            <div className="flex gap-3 overflow-x-auto px-1 pb-2 pt-1 scrollbar-thin sm:justify-center">
              {backstage.map(({ participant, source }) => {
                const onStage = isHost ? isOnStage(participant.identity, source) : !!remoteScene?.stage.some((i) => i.identity === participant.identity && i.source === source);
                return (
                  <ParticipantTile
                    key={`${participant.identity}:${source}`}
                    participant={participant}
                    source={source}
                    onStage={onStage}
                    isMain={!!mainItem && mainItem.identity === participant.identity && mainItem.source === source}
                    isLive={showLive}
                    canManage={isHost}
                    onToggleStage={isHost ? () => toggleStage(participant.identity, source) : undefined}
                    onMakeMain={isHost ? () => makeMain(participant.identity, source) : undefined}
                    onMute={isHost && !participant.isLocal && source === 'camera' ? () => muteParticipant(participant) : undefined}
                    onRemove={isHost && !participant.isLocal && source === 'camera' ? () => removeParticipant(participant) : undefined}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-auto pt-3">
            <ControlBar onOpenSettings={() => setSettingsOpen(true)} onInvite={() => setInviteOpen(true)} onLeave={leave} />
          </div>
        </main>

        <StudioSidebar tabs={isHost ? ['brand', 'banners', 'chat'] : ['chat']} active={sidebarTab} onChange={setSidebarTab} unreadChat={unread}>
          {sidebarTab === 'brand' && isHost && <BrandPanel brand={brand} onChange={updateBrand} />}
          {sidebarTab === 'banners' && isHost && (
            <BannersPanel
              banners={banners}
              activeId={activeBannerId}
              onChange={updateBanners}
              onToggleActive={(id) => setActiveBannerId((cur) => (cur === id ? null : id))}
            />
          )}
          {sidebarTab === 'chat' && <ChatPanel messages={messages} localIdentity={localParticipant.identity} onSend={postChat} />}
        </StudioSidebar>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} isHost={isHost} isLive={isLive} settings={settings} onSettingsChange={setSettings} />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} studioCode={studioCode} />
      {isHost && broadcast && <GoLiveDialog open={goLiveOpen} onOpenChange={setGoLiveOpen} broadcast={broadcast} onGoLive={startEgress} />}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const fn = confirm?.onConfirm;
                setConfirm(null);
                fn?.();
              }}
            >
              {confirm?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function StudioSession({ token, serverUrl, studioCode, role, title, broadcast, choices, onLeft }: StudioSessionProps) {
  const resolution = role === 'host' ? VideoPresets.h1080.resolution : VideoPresets.h720.resolution;
  const video = useMemo(
    () => (choices.videoEnabled ? { deviceId: choices.videoDeviceId, resolution } : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [choices.videoEnabled, choices.videoDeviceId, role]
  );
  const audio = useMemo(
    () => (choices.audioEnabled ? { deviceId: choices.audioDeviceId, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false),
    [choices.audioEnabled, choices.audioDeviceId]
  );
  // Yapımcı kompozit için her görüntüyü tam çözünürlükte almalı; misafirler ise ekrandaki boyuta göre
  // daha düşük katmanlara inebilir (bant genişliği ve yapımcının kodlama yükü azalır).
  const options = useMemo(() => ({ adaptiveStream: role === 'guest', dynacast: true, videoCaptureDefaults: { resolution } }), [resolution, role]);
  const [connected, setConnected] = useState(false);

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video={video}
      audio={audio}
      options={options}
      onConnected={() => setConnected(true)}
      onDisconnected={(reason) => {
        if (reason === DisconnectReason.CLIENT_INITIATED) onLeft('left');
        else if (reason === DisconnectReason.PARTICIPANT_REMOVED) onLeft('removed');
        else if (reason === DisconnectReason.ROOM_DELETED) onLeft('ended');
        else if (reason === DisconnectReason.DUPLICATE_IDENTITY) onLeft('duplicate');
        // Ağ kopması vb.: kullanıcıyı sessizce panele atmak yerine yeniden bağlanma ekranı göster
        else onLeft('error');
      }}
      onError={(e) => toast.error(e.message)}
      onMediaDeviceFailure={(failure, kind) => {
        const what = kind === 'videoinput' ? 'Kamera' : kind === 'audioinput' ? 'Mikrofon' : 'Cihaz';
        toast.error(`${what} başlatılamadı${failure ? ` (${failure})` : ''}. Ayarlardan başka bir cihaz seçebilirsiniz.`);
      }}
      style={{ height: '100vh' }}
    >
      {connected ? (
        <StudioContent studioCode={studioCode} role={role} title={title} initialBroadcast={broadcast} />
      ) : (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-studio text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          Stüdyoya bağlanılıyor…
        </div>
      )}
      <CustomAudioRenderer />
      <StartAudioOverlay />
    </LiveKitRoom>
  );
}
