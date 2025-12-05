'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveKitRoom,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
  VideoTrack,
  useRoomContext,
  RoomAudioRenderer,
  useIsSpeaking,
  useStartAudio,
} from '@livekit/components-react';
import type { Participant, TrackPublication } from 'livekit-client';
import { LocalVideoTrack, Track, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { LayoutGrid, User, Palette } from 'lucide-react';
import { fetchWithAuth } from '@/lib/utils';

type LayoutMode = 'grid' | 'speaker';

const calculateLayout = (canvasWidth: number, canvasHeight: number, participantCount: number, layout: LayoutMode) => {
  const boxes: { x: number, y: number, width: number, height: number }[] = [];

  if (participantCount === 0) return boxes;

  if (layout === 'speaker' && participantCount > 1) {
    boxes.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight }); // Main speaker
    const thumbHeight = canvasHeight / 5;
    const thumbWidth = thumbHeight * (16 / 9);
    const thumbY = canvasHeight - thumbHeight - 20;

    const otherParticipantsCount = participantCount - 1;
    const totalThumbWidth = otherParticipantsCount * thumbWidth + (otherParticipantsCount - 1) * 10;
    let startX = (canvasWidth - totalThumbWidth) / 2;

    for (let i = 1; i < participantCount; i++) {
      boxes.push({ x: startX, y: thumbY, width: thumbWidth, height: thumbHeight });
      startX += thumbWidth + 10;
    }
  } else {
    const rows = Math.round(Math.sqrt(participantCount));
    const cols = Math.ceil(participantCount / rows);
    const cellWidth = canvasWidth / cols;
    const cellHeight = canvasHeight / rows;
    for (let i = 0; i < participantCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      boxes.push({ x: col * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight });
    }
  }
  return boxes;
};

interface StageTrack {
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
  layout?: LayoutMode;
  localParticipant?: Participant;
  isFeatured?: boolean;
}

function ParticipantTile({
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
            <User className={`text-gray-400 ${variant === 'stage' ? 'h-12 w-12' : 'h-8 w-8'}`} />
          )}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
        <p className="text-white text-sm truncate">
          {participant.identity} {source === Track.Source.ScreenShare ? '(Ekran)' : ''}
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

interface CustomRoomLayoutProps {
  layout: LayoutMode;
  onCompositeTrackPublished: (sid: string | null) => void;
  setLayout: (layout: LayoutMode) => void;
  isHost: boolean;
  logoUrl: string;
  showLogo: boolean;
  overlayUrl: string;
  showOverlay: boolean;
  quality: string;
  fps: number;
}

function CustomRoomLayout({
  layout,
  onCompositeTrackPublished,
  setLayout,
  isHost,
  logoUrl,
  showLogo,
  overlayUrl,
  showOverlay,
  quality,
  fps
}: CustomRoomLayoutProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementsRef = useRef<Record<string, HTMLVideoElement>>({});
  const [stageParticipants, setStageParticipants] = useState<StageTrack[]>([]);
  const room = useRoomContext();

  // Determine canvas dimensions based on quality
  const canvasWidth = quality === '1080p' ? 1920 : (quality === '720p' ? 1280 : 854);
  const canvasHeight = quality === '1080p' ? 1080 : (quality === '720p' ? 720 : 480);

  // Image refs
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const overlayImageRef = useRef<HTMLImageElement | null>(null);

  // Load images when URLs change
  useEffect(() => {
    if (logoUrl) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = logoUrl;
      img.onload = () => { logoImageRef.current = img; };
    } else {
      logoImageRef.current = null;
    }
  }, [logoUrl]);

  useEffect(() => {
    if (overlayUrl) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = overlayUrl;
      img.onload = () => { overlayImageRef.current = img; };
    } else {
      overlayImageRef.current = null;
    }
  }, [overlayUrl]);


  // Helper to broadcast state changes
  const broadcastState = useCallback(async (newStageTracks: StageTrack[], newLayout: LayoutMode) => {
    if (!localParticipant || !isHost) return;

    const state = {
      type: 'SCENE_UPDATE',
      stageTracks: newStageTracks.map(t => ({ sid: t.participant.sid, source: t.source })),
      layout: newLayout
    };

    try {
      const data = new TextEncoder().encode(JSON.stringify(state));
      await localParticipant.publishData(data, { reliable: true });
    } catch (error) {
      console.error('Failed to broadcast state:', error);
    }
  }, [localParticipant, isHost]);

  // Add local participant camera to stage initially
  useEffect(() => {
    if (localParticipant && stageParticipants.length === 0 && isHost) {
      const newStage = [{ participant: localParticipant, source: Track.Source.Camera }];
      setStageParticipants(newStage);
    }
  }, [localParticipant, isHost]);

  // Deduplicate participants to avoid UI glitches
  const allParticipants = Array.from(
    new Map(
      [localParticipant, ...remoteParticipants]
        .filter((p) => !!p)
        .map(p => [p.sid, p])
    ).values()
  );

  // Publish canvas stream
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !localParticipant) return;

    const stream = canvas.captureStream(fps);
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    const track = new LocalVideoTrack(videoTrack);

    let publication: TrackPublication | undefined;
    localParticipant.publishTrack(track, { name: 'canvas-composite', simulcast: false }).then((pub) => {
      publication = pub;
      onCompositeTrackPublished(pub.trackSid);
    });

    return () => {
      if (publication) {
        localParticipant.unpublishTrack(track);
      }
      onCompositeTrackPublished(null);
    }
  }, [localParticipant, onCompositeTrackPublished]);

  // Drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const worker = new Worker('/timer-worker.js');

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Filter tracks that have a video element
      const tracksToDraw = stageParticipants.filter(t => {
        const key = `${t.participant.sid}_${t.source}`;
        return videoElementsRef.current[key];
      });

      const layoutBoxes = calculateLayout(canvas.width, canvas.height, tracksToDraw.length, layout);

      tracksToDraw.forEach((t, index) => {
        const key = `${t.participant.sid}_${t.source}`;
        const video = videoElementsRef.current[key];
        const box = layoutBoxes[index];
        if (video && box && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          ctx.drawImage(video, box.x, box.y, box.width, box.height);
        }
      });

      // Draw Logo (Top Right)
      if (showLogo && logoImageRef.current) {
        const logoSize = 100;
        const padding = 20;
        ctx.drawImage(logoImageRef.current, canvas.width - logoSize - padding, padding, logoSize, logoSize);
      }

      // Draw Overlay (Full Screen)
      if (showOverlay && overlayImageRef.current) {
        ctx.drawImage(overlayImageRef.current, 0, 0, canvas.width, canvas.height);
      }
    };

    worker.onmessage = () => {
      draw();
    };

    worker.postMessage({ type: 'start', interval: 1000 / fps });

    return () => {
      worker.postMessage({ type: 'stop' });
      worker.terminate();
    };
  }, [stageParticipants, layout, showLogo, showOverlay, fps]);

  // --- SYNC LOGIC ---

  // Listen for incoming state updates
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array, participant?: Participant) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);

        if (data.type === 'SCENE_UPDATE') {
          const local = room.localParticipant;
          const remotes = Array.from(room.remoteParticipants.values());
          const potentialParticipants = [local, ...remotes];

          const newStage = data.stageTracks.map((t: any) => {
            const p = potentialParticipants.find((pp: any) => pp?.sid === t.sid);
            return p ? { participant: p, source: t.source } : undefined;
          }).filter((t: any) => t !== undefined) as StageTrack[];

          setStageParticipants(newStage);
          setLayout(data.layout);
        }
      } catch (e) {
        console.error('Failed to parse data message:', e);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, setLayout]);

  // Sync new participants
  useEffect(() => {
    if (!room || !isHost) return;

    const handleParticipantConnected = () => {
      broadcastState(stageParticipants, layout);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room, stageParticipants, layout, broadcastState, isHost]);


  // Actions
  const addToStage = (track: StageTrack) => {
    if (!isHost) return;
    if (stageParticipants.find(t => t.participant.sid === track.participant.sid && t.source === track.source)) return;
    const newStage = [...stageParticipants, track];
    setStageParticipants(newStage);
    broadcastState(newStage, layout);
  };

  const removeFromStage = (track: StageTrack) => {
    if (!isHost) return;
    const newStage = stageParticipants.filter(t => !(t.participant.sid === track.participant.sid && t.source === track.source));
    setStageParticipants(newStage);
    broadcastState(newStage, layout);
  };

  const setFeatured = (track: StageTrack) => {
    if (!isHost) return;
    const newStage = [track, ...stageParticipants.filter(t => !(t.participant.sid === track.participant.sid && t.source === track.source))];
    setStageParticipants(newStage);
    broadcastState(newStage, layout);
  };

  // Derive backstage tracks
  // A track is in backstage if it exists (published) AND is NOT on stage
  const backstageTracks: StageTrack[] = [];
  allParticipants.forEach(p => {
    // Check Camera
    if (p.getTrackPublication(Track.Source.Camera)) {
      if (!stageParticipants.find(t => t.participant.sid === p.sid && t.source === Track.Source.Camera)) {
        backstageTracks.push({ participant: p, source: Track.Source.Camera });
      }
    }
    // Check ScreenShare
    if (p.getTrackPublication(Track.Source.ScreenShare)) {
      if (!stageParticipants.find(t => t.participant.sid === p.sid && t.source === Track.Source.ScreenShare)) {
        backstageTracks.push({ participant: p, source: Track.Source.ScreenShare });
      }
    }
  });

  return (
    <div className="flex h-full pt-20">
      <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1920px', height: '1080px', overflow: 'hidden', zIndex: -1 }}>
        {allParticipants.map(p => {
          // Render both Camera and ScreenShare video tracks to be used by canvas
          const tracks = [Track.Source.Camera, Track.Source.ScreenShare];
          return tracks.map(source => {
            const pub = p.getTrackPublication(source);
            if (!pub?.track) return null;
            const trackRef = { participant: p, publication: pub, source: source };
            return (
              <VideoTrack
                key={`${p.sid}_${source}`}
                trackRef={trackRef}
                ref={node => {
                  if (node) {
                    videoElementsRef.current[`${p.sid}_${source}`] = node;
                  }
                }}
              />
            );
          });
        })}
      </div>

      <div className="flex-1 flex items-center justify-center bg-black p-4">
        <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className="w-full h-full aspect-video" />
      </div>

      <div className="w-64 bg-gray-900 p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">Kulis</h2>
        {backstageTracks.map(t => (
          <ParticipantTile
            key={`${t.participant.sid}_${t.source}`}
            participant={t.participant}
            source={t.source}
            isHost={isHost}
            variant="backstage"
            onAddToStage={addToStage}
          />
        ))}
        <hr className="border-gray-700" />
        <h2 className="text-lg font-semibold text-white">Sahnede</h2>
        {stageParticipants.map((t, index) => (
          <ParticipantTile
            key={`${t.participant.sid}_${t.source}`}
            participant={t.participant}
            source={t.source}
            isHost={isHost}
            variant="stage"
            onRemoveFromStage={removeFromStage}
            onSetFeatured={setFeatured}
            layout={layout}
            localParticipant={localParticipant}
            isFeatured={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

interface StreamingTarget {
  id: number;
  platform: string;
  rtmp_url: string;
  stream_key: string;
}

function StreamDestinations({ broadcastId, targets, onTargetsChange }: { broadcastId: number, targets: StreamingTarget[], onTargetsChange: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [platform, setPlatform] = useState('YouTube');
  const [rtmpUrl, setRtmpUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTarget = async () => {
    if (!rtmpUrl || !streamKey) return;
    setIsLoading(true);
    try {
      const response = await fetchWithAuth(`/api/broadcasts/${broadcastId}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, rtmp_url: rtmpUrl, stream_key: streamKey }),
      });
      if (response.ok) {
        setRtmpUrl('');
        setStreamKey('');
        setIsOpen(false);
        onTargetsChange();
      } else {
        alert('Hedef eklenemedi.');
      }
    } catch (error) {
      console.error(error);
      alert('Bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTarget = async (targetId: number) => {
    if (!confirm('Bu yayin hedefini silmek istediğinize emin misiniz?')) return;
    try {
      const response = await fetchWithAuth(`/api/broadcasts/${broadcastId}/targets/${targetId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onTargetsChange();
      } else {
        alert('Hedef silinemedi.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="bg-gray-800 text-white hover:bg-gray-700 border border-gray-700">
          Yayın Hedefleri ({targets.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Yayın Hedefleri</DialogTitle>
          <DialogDescription className="text-gray-400">Yayınınızın gönderileceği platformları yönetin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {targets.map(target => (
              <div key={target.id} className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                <div>
                  <p className="font-bold text-white">{target.platform}</p>
                  <p className="text-xs text-gray-400 truncate w-48">{target.rtmp_url}</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteTarget(target.id)}>Sil</Button>
              </div>
            ))}
            {targets.length === 0 && <p className="text-gray-500 text-center">Henüz hedef eklenmemiş.</p>}
          </div>

          <div className="border-t border-gray-700 pt-4 space-y-3">
            <h3 className="font-semibold text-white">Yeni Hedef Ekle</h3>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full p-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="YouTube">YouTube</option>
              <option value="Twitch">Twitch</option>
              <option value="Facebook">Facebook</option>
              <option value="Custom">Custom RTMP</option>
            </select>
            <Input placeholder="RTMP URL" value={rtmpUrl} onChange={e => setRtmpUrl(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
            <Input type="password" placeholder="Stream Key" value={streamKey} onChange={e => setStreamKey(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddTarget} disabled={isLoading}>
              {isLoading ? 'Ekleniyor...' : 'Ekle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BrandSettingsProps {
  broadcastId: number;
  title: string;
  logoUrl: string;
  showLogo: boolean;
  overlayUrl: string;
  showOverlay: boolean;
  onUpdate: () => void;
}

function BrandSettings({ broadcastId, title, logoUrl, showLogo, overlayUrl, showOverlay, onUpdate }: BrandSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [localLogoUrl, setLocalLogoUrl] = useState(logoUrl);
  const [localShowLogo, setLocalShowLogo] = useState(showLogo);
  const [localOverlayUrl, setLocalOverlayUrl] = useState(overlayUrl);
  const [localShowOverlay, setLocalShowOverlay] = useState(showOverlay);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalTitle(title);
      setLocalLogoUrl(logoUrl);
      setLocalShowLogo(showLogo);
      setLocalOverlayUrl(overlayUrl);
      setLocalShowOverlay(showOverlay);
    }
  }, [isOpen, title, logoUrl, showLogo, overlayUrl, showOverlay]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth(`/api/broadcasts/${broadcastId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: localTitle,
          logo_url: localLogoUrl,
          show_logo: localShowLogo,
          overlay_url: localOverlayUrl,
          show_overlay: localShowOverlay
        }),
      });

      if (response.ok) {
        onUpdate();
        setIsOpen(false);
      } else {
        alert('Ayarlar kaydedilemedi.');
      }
    } catch (error) {
      console.error(error);
      alert('Bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Marka Ayarları" className="bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 px-2">
          <Palette className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Marka ve Görünüm</DialogTitle>
          <DialogDescription className="text-gray-400">Yayınınızın başlığını, logosunu ve arayüzünü özelleştirin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Yayın Başlığı</Label>
            <Input value={localTitle} onChange={e => setLocalTitle(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
          </div>

          <div className="space-y-2 border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Logo</Label>
              <Switch checked={localShowLogo} onCheckedChange={setLocalShowLogo} />
            </div>
            <Input placeholder="Logo URL (PNG/JPG)" value={localLogoUrl} onChange={e => setLocalLogoUrl(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
            <p className="text-xs text-gray-400">Önerilen: 200x200px şeffaf PNG. Sağ üst köşede görünür.</p>
          </div>

          <div className="space-y-2 border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Overlay (Arayüz)</Label>
              <Switch checked={localShowOverlay} onCheckedChange={setLocalShowOverlay} />
            </div>
            <Input placeholder="Overlay URL (PNG)" value={localOverlayUrl} onChange={e => setLocalOverlayUrl(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
            <p className="text-xs text-gray-400">Önerilen: 1280x720px şeffaf PNG. Tüm ekranı kaplar.</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isLoading} variant="secondary">{isLoading ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudioContent({ studioCode, initialRole = 'guest' }: { studioCode: string, initialRole?: 'host' | 'guest' }) {
  const [isLive, setIsLive] = useState<boolean>(false);
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [compositeTrackSid, setCompositeTrackSid] = useState<string | null>(null);
  const [quality, setQuality] = useState<string>('480p');
  const [fps, setFps] = useState<number>(30);
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const room = useRoomContext();

  // Role Management
  const [role, setRole] = useState<'host' | 'guest'>(initialRole);
  const isHost = role === 'host';

  // Broadcast Management
  const [broadcastId, setBroadcastId] = useState<number | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [targets, setTargets] = useState<StreamingTarget[]>([]);

  // Brand State
  const [logoUrl, setLogoUrl] = useState('');
  const [showLogo, setShowLogo] = useState(false);
  const [overlayUrl, setOverlayUrl] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    const updateRole = () => {
      if (localParticipant?.metadata) {
        try {
          const meta = JSON.parse(localParticipant.metadata);
          if (meta.role) setRole(meta.role);
        } catch (e) {
          console.error("Failed to parse participant metadata", e);
        }
      }
    };
    updateRole();
    room.on(RoomEvent.ParticipantMetadataChanged, updateRole);
    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, updateRole);
    };
  }, [localParticipant, room]);

  const fetchBroadcastDetails = useCallback(async () => {
    if (!isHost) return;
    try {
      const response = await fetchWithAuth(`/api/broadcasts/studio/${studioCode}`);
      if (response.ok) {
        const data = await response.json();
        setBroadcastId(data.id);
        setBroadcastTitle(data.title);
        setTargets(data.targets || []);
        // Brand details
        setLogoUrl(data.logo_url || '');
        setShowLogo(data.show_logo || false);
        setOverlayUrl(data.overlay_url || '');
        setShowOverlay(data.show_overlay || false);
      }
    } catch (error) {
      console.error('Failed to fetch broadcast details:', error);
    }
  }, [studioCode, isHost]);

  useEffect(() => {
    fetchBroadcastDetails();
  }, [fetchBroadcastDetails]);


  const handleGoLive = async () => {
    if (!compositeTrackSid) {
      alert('Yayın başlatılamıyor. Kompozit iz bulunamadı.');
      return;
    }

    const audioTrack = localParticipant?.getTrackPublication(Track.Source.Microphone);
    const audioTrackId = audioTrack?.trackSid;

    if (!audioTrackId) {
      alert('Yayın başlatılamıyor. Mikrofon izi bulunamadı. Lütfen mikrofonunuzu açın.');
      return;
    }

    if (targets.length === 0) {
      alert('Lütfen önce en az bir yayın hedefi (YouTube, Twitch vb.) ekleyin.');
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/broadcasts/studio/${studioCode}/start-egress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: compositeTrackSid, audioTrackId: audioTrackId, quality, fps }),
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Yayın başarıyla başlatıldı! Egress ID: ${data.egressId}`);
        setIsLive(true);
      } else {
        const errorData = await response.json();
        alert(`Yayın başlatılamadı: ${errorData.error || response.statusText}`);
      }
    } catch (error: any) {
      if (!error.message.includes('Session expired')) {
        alert(`Bir hata oluştu: ${error.message}`);
      }
    }
  };

  const handleStopLive = async () => {
    try {
      const response = await fetchWithAuth(`/api/broadcasts/studio/${studioCode}/stop-egress`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Yayın başarıyla durduruldu!');
        setIsLive(false);
      } else {
        const errorData = await response.json();
        alert(`Yayın durdurulamadı: ${errorData.error || response.statusText}`);
      }
    } catch (error: any) {
      if (!error.message.includes('Session expired')) {
        alert(`Bir hata oluştu: ${error.message}`);
      }
    }
  };

  return (
    <>
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-center items-center gap-4 p-4 bg-gray-900/90 border-b border-gray-800 backdrop-blur-sm">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="bg-gray-800 text-white hover:bg-gray-700">
              <User className="mr-2 h-4 w-4" />
              Davet Et
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Katılımcı Davet Et</DialogTitle>
              <DialogDescription className="text-gray-400">
                Aşağıdaki linki kopyalayarak katılımcıları stüdyonuzda davet edebilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="invite-link" className="text-right text-gray-300">
                  Davet Linki
                </Label>
                <Input
                  id="invite-link"
                  defaultValue={`http://localhost:3001/studio/${studioCode}`}
                  readOnly
                  className="col-span-3 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => navigator.clipboard.writeText(`http://localhost:3001/studio/${studioCode}`)} variant="secondary">
                Kopyala
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="h-6 w-px bg-gray-700 mx-2" />

        <TrackToggle source={Track.Source.Camera} className="bg-gray-800 text-white hover:bg-gray-700 data-[state=on]:bg-green-600">Kamera</TrackToggle>
        <TrackToggle source={Track.Source.Microphone} className="bg-gray-800 text-white hover:bg-gray-700 data-[state=on]:bg-green-600">Mikrofon</TrackToggle>
        <TrackToggle source={Track.Source.ScreenShare} className="bg-gray-800 text-white hover:bg-gray-700 data-[state=on]:bg-green-600">Ekran</TrackToggle>

        {isHost && (
          <>
            <div className="h-6 w-px bg-gray-700 mx-2" />

            <div className="flex items-center gap-1 p-1 bg-gray-800 rounded-lg border border-gray-700">
              <Button title="Grid Düzeni" size="icon" variant={layout === 'grid' ? 'secondary' : 'ghost'} onClick={() => setLayout('grid')} className="h-8 w-8">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button title="Konuşmacı Düzeni" size="icon" variant={layout === 'speaker' ? 'secondary' : 'ghost'} onClick={() => setLayout('speaker')} className="h-8 w-8">
                <User className="h-4 w-4" />
              </Button>
            </div>

            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLive}
            >
              <option value="1080p">1080p (FHD)</option>
              <option value="720p">720p (HD)</option>
              <option value="480p">480p (SD)</option>
            </select>

            <select
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLive}
            >
              <option value="30">30 FPS</option>
              <option value="60">60 FPS</option>
            </select>

            {broadcastId && (
              <>
                <StreamDestinations
                  broadcastId={broadcastId}
                  targets={targets}
                  onTargetsChange={fetchBroadcastDetails}
                />
                <BrandSettings
                  broadcastId={broadcastId}
                  title={broadcastTitle}
                  logoUrl={logoUrl}
                  showLogo={showLogo}
                  overlayUrl={overlayUrl}
                  showOverlay={showOverlay}
                  onUpdate={fetchBroadcastDetails}
                />
              </>
            )}

            <div className="flex-1" />

            {!isLive ? (
              <Button className="font-bold bg-green-600 hover:bg-green-700 text-white" onClick={handleGoLive}>
                Canlı Yayına Geç
              </Button>
            ) : (
              <Button className="font-bold" variant="destructive" onClick={handleStopLive}>
                Yayını Bitir
              </Button>
            )}
          </>
        )}
      </div>
      <CustomRoomLayout
        layout={layout}
        onCompositeTrackPublished={setCompositeTrackSid}
        setLayout={setLayout}
        isHost={isHost}
        logoUrl={logoUrl}
        showLogo={showLogo}
        overlayUrl={overlayUrl}
        showOverlay={showOverlay}
        quality={quality}
        fps={fps}
      />
    </>
  );
}

interface StudioSessionProps {
  token: string;
  serverUrl: string;
  studioCode: string;
  initialRole?: 'host' | 'guest';
}

function StartAudioButton() {
  const { canPlayAudio, mergedProps } = useStartAudio({ props: {} });

  if (canPlayAudio) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="text-center space-y-4">
        <p className="text-white text-xl">Yayına katılmak için lütfen tıklayın</p>
        <Button {...mergedProps} size="lg">
          Sesi ve Görüntüyü Başlat
        </Button>
      </div>
    </div>
  );
}

export default function StudioSession({ token, serverUrl, studioCode, initialRole = 'guest' }: StudioSessionProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={!!token}
      video={true}
      audio={true}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onMediaDeviceFailure={(error) => console.error('Media device failure:', error)}
    >
      <StudioContent studioCode={studioCode} initialRole={initialRole} />
      <RoomAudioRenderer />
      <StartAudioButton />
    </LiveKitRoom>
  );
}
