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
import { LayoutGrid, User } from 'lucide-react';
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

interface ParticipantTileProps {
  participant: Participant;
  isHost: boolean;
  variant: 'backstage' | 'stage';
  onAddToStage?: (p: Participant) => void;
  onRemoveFromStage?: (p: Participant) => void;
  onSetFeatured?: (p: Participant) => void;
  layout?: LayoutMode;
  localParticipant?: Participant;
  isFeatured?: boolean;
}

function ParticipantTile({
  participant,
  isHost,
  variant,
  onAddToStage,
  onRemoveFromStage,
  onSetFeatured,
  layout,
  localParticipant,
  isFeatured
}: ParticipantTileProps) {
  const pub = participant.getTrackPublication(Track.Source.Camera);
  const isSpeaking = useIsSpeaking(participant);

  return (
    <div className={`relative aspect-video bg-gray-800 rounded-lg overflow-hidden ${isSpeaking ? 'border-2 border-green-500' : ''}`}>
      {pub?.track ? (
        <VideoTrack trackRef={{ participant: participant, publication: pub, source: pub.source }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className={`text-gray-400 ${variant === 'stage' ? 'h-12 w-12' : 'h-8 w-8'}`} />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
        <p className="text-white text-sm truncate">{participant.identity}</p>
      </div>

      {isHost && variant === 'backstage' && onAddToStage && (
        <Button variant="secondary" size="sm" className="absolute top-2 right-2 z-10" onClick={() => onAddToStage(participant)}>
          Sahneye Ekle
        </Button>
      )}

      {isHost && variant === 'stage' && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {localParticipant && participant.sid !== localParticipant.sid && onRemoveFromStage && (
            <Button variant="destructive" size="sm" className="p-1 h-auto" onClick={() => onRemoveFromStage(participant)}>Çıkar</Button>
          )}
          {layout === 'speaker' && !isFeatured && onSetFeatured && (
            <Button variant="secondary" size="sm" className="p-1 h-auto" onClick={() => onSetFeatured(participant)}>Öne Çıkar</Button>
          )}
        </div>
      )}
    </div>
  );
}

function CustomRoomLayout({ layout, onCompositeTrackPublished, setLayout, isHost }: { layout: LayoutMode, onCompositeTrackPublished: (sid: string | null) => void, setLayout: (layout: LayoutMode) => void, isHost: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementsRef = useRef<Record<string, HTMLVideoElement>>({});
  const [stageParticipants, setStageParticipants] = useState<Participant[]>([]);
  const room = useRoomContext();

  // Helper to broadcast state changes
  const broadcastState = useCallback(async (newStageParticipants: Participant[], newLayout: LayoutMode) => {
    if (!localParticipant || !isHost) return; // Only host can broadcast

    const state = {
      type: 'SCENE_UPDATE',
      stageParticipantSids: newStageParticipants.map(p => p.sid),
      layout: newLayout
    };

    try {
      console.log('Broadcasting state:', state);
      const data = new TextEncoder().encode(JSON.stringify(state));
      await localParticipant.publishData(data, { reliable: true });
      console.log('State broadcasted successfully');
    } catch (error) {
      console.error('Failed to broadcast state:', error);
    }
  }, [localParticipant, isHost]);

  // Add local participant to stage when they connect and stage is empty (Initial local only)
  useEffect(() => {
    if (localParticipant && stageParticipants.length === 0 && isHost) {
      const newStage = [localParticipant];
      setStageParticipants(newStage);
      // We don't broadcast here immediately to avoid storm, 
      // but if we are the first/host, we might want to.
      // For now, let's rely on explicit actions or the "sync on join" logic.
    }
  }, [localParticipant, isHost]); // Removed stageParticipants dependency to avoid loop, but need to be careful.

  const allParticipants = [localParticipant, ...remoteParticipants].filter(p => p);

  // Publish canvas stream
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !localParticipant) return;

    const stream = canvas.captureStream(25);
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return; // Add a guard
    const track = new LocalVideoTrack(videoTrack);

    let publication: TrackPublication | undefined;
    localParticipant.publishTrack(track, { name: 'canvas-composite' }).then((pub) => {
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const participantsToDraw = stageParticipants.filter(p => videoElementsRef.current[p.sid]);
      const layoutBoxes = calculateLayout(canvas.width, canvas.height, participantsToDraw.length, layout);

      participantsToDraw.forEach((p, index) => {
        const video = videoElementsRef.current[p.sid];
        const box = layoutBoxes[index];
        if (video && box && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          ctx.drawImage(video, box.x, box.y, box.width, box.height);
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [stageParticipants, layout]);

  // --- SYNC LOGIC ---

  // Listen for incoming state updates
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array, participant?: Participant) => {
      try {
        const str = new TextDecoder().decode(payload);
        console.log('Data received:', str, 'from', participant?.identity);
        const data = JSON.parse(str);

        if (data.type === 'SCENE_UPDATE') {
          // Resolve SIDs to Participant objects using the Room instance directly
          // to avoid stale closures from React state
          const local = room.localParticipant;
          const remotes = Array.from(room.remoteParticipants.values());
          const potentialParticipants = [local, ...remotes];

          console.log('Resolving SIDs:', data.stageParticipantSids);
          console.log('Potential Participants (Live):', potentialParticipants.map(p => p?.sid));

          const newStage = data.stageParticipantSids.map((sid: string) =>
            potentialParticipants.find((p: any) => p?.sid === sid)
          ).filter((p: any) => p !== undefined) as Participant[];

          console.log('Resolved New Stage:', newStage.map(p => p.sid));
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

  // Sync new participants (Send them current state)
  useEffect(() => {
    if (!room || !isHost) return; // Only host syncs new participants

    const handleParticipantConnected = () => {
      // If I have state, send it to the new guy.
      // Ideally only the HOST does this, but for now anyone with state can.
      // To avoid flood, maybe check if I am the "oldest" or just let it be for now (LiveKit handles data messages well).
      // Better: Only send if I am the one who last changed it? 
      // Simplest: Just send it.
      broadcastState(stageParticipants, layout);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      console.log('Track subscribed:', track.kind, track.sid, 'from', participant.identity);
    };
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, stageParticipants, layout, broadcastState, isHost]);


  // Actions
  const addToStage = (participant: Participant) => {
    if (!isHost) return;
    if (stageParticipants.find(p => p.sid === participant.sid)) return;
    const newStage = [...stageParticipants, participant];
    setStageParticipants(newStage);
    broadcastState(newStage, layout);
  };

  const removeFromStage = (participant: Participant) => {
    if (!isHost) return;
    const newStage = stageParticipants.filter(p => p.sid !== participant.sid);
    setStageParticipants(newStage);
    broadcastState(newStage, layout);
  };

  const setFeatured = (participant: Participant) => {
    if (!isHost) return;
    const newStage = [participant, ...stageParticipants.filter(p => p.sid !== participant.sid)];
    setStageParticipants(newStage);
    broadcastState(newStage, layout);
  };

  const backstageParticipants = allParticipants.filter(
    p => !stageParticipants.find(sp => sp.sid === p.sid)
  );

  return (
    <div className="flex h-full pt-20">
      <div style={{ display: 'none' }}>
        {allParticipants.map(p => {
          const pub = p.getTrackPublication(Track.Source.Camera);
          if (!pub?.track) {
            return null;
          }
          const trackRef = { participant: p, publication: pub, source: pub.source };
          return (
            <VideoTrack
              key={p.sid}
              trackRef={trackRef}
              ref={node => {
                if (node) {
                  videoElementsRef.current[p.sid] = node;
                }
              }}
            />
          );
        })}
      </div>

      <div className="flex-1 flex items-center justify-center bg-black p-4">
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full aspect-video" />
      </div>

      <div className="w-64 bg-gray-900 p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">Kulis</h2>
        {backstageParticipants.map(p => (
          <ParticipantTile
            key={p.sid}
            participant={p}
            isHost={isHost}
            variant="backstage"
            onAddToStage={addToStage}
          />
        ))}
        <hr className="border-gray-700" />
        <h2 className="text-lg font-semibold text-white">Sahnede</h2>
        {stageParticipants.map((p, index) => (
          <ParticipantTile
            key={p.sid}
            participant={p}
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

interface StudioSessionProps {
  token: string;
  serverUrl: string;
  studioCode: string;
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
        <Button variant="outline" size="sm">Yayın Hedefleri ({targets.length})</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yayın Hedefleri</DialogTitle>
          <DialogDescription>Yayınınızın gönderileceği platformları yönetin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {targets.map(target => (
              <div key={target.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
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
              className="w-full p-2 bg-gray-700 text-white rounded"
            >
              <option value="YouTube">YouTube</option>
              <option value="Twitch">Twitch</option>
              <option value="Facebook">Facebook</option>
              <option value="Custom">Custom RTMP</option>
            </select>
            <Input placeholder="RTMP URL" value={rtmpUrl} onChange={e => setRtmpUrl(e.target.value)} />
            <Input type="password" placeholder="Stream Key" value={streamKey} onChange={e => setStreamKey(e.target.value)} />
            <Button className="w-full" onClick={handleAddTarget} disabled={isLoading}>
              {isLoading ? 'Ekleniyor...' : 'Ekle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudioContent({ studioCode, initialRole = 'guest' }: { studioCode: string, initialRole?: 'host' | 'guest' }) {
  const [isLive, setIsLive] = useState<boolean>(false);
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [compositeTrackSid, setCompositeTrackSid] = useState<string | null>(null);
  const [quality, setQuality] = useState<string>('480p');
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const room = useRoomContext();

  // Role Management
  const [role, setRole] = useState<'host' | 'guest'>(initialRole);
  const isHost = role === 'host';

  // Broadcast Management
  const [broadcastId, setBroadcastId] = useState<number | null>(null);
  const [targets, setTargets] = useState<StreamingTarget[]>([]);

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
        setTargets(data.targets || []);
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
        body: JSON.stringify({ trackId: compositeTrackSid, audioTrackId: audioTrackId, quality }),
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
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-center items-center gap-4 p-4 bg-gray-800/50">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Katılımcı Davet Et</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Katılımcı Davet Et</DialogTitle>
              <DialogDescription>
                Aşağıdaki linki kopyalayarak katılımcıları stüdyonuzda davet edebilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="invite-link" className="text-right">
                  Davet Linki
                </Label>
                <Input
                  id="invite-link"
                  defaultValue={`http://localhost:3001/studio/${studioCode}`}
                  readOnly
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => navigator.clipboard.writeText(`http://localhost:3001/studio/${studioCode}`)}>Kopyala</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TrackToggle source={Track.Source.Camera}>Kamera</TrackToggle>
        <TrackToggle source={Track.Source.Microphone}>Mikrofon</TrackToggle>
        <TrackToggle source={Track.Source.ScreenShare}>Ekran Paylaş</TrackToggle>

        {isHost && (
          <>
            <div className="flex items-center gap-2 p-1 bg-gray-700 rounded-md">
              <Button title="Grid Düzeni" size="sm" variant={layout === 'grid' ? 'default' : 'ghost'} onClick={() => setLayout('grid')}><LayoutGrid className="h-4 w-4" /></Button>
              <Button title="Konuşmacı Düzeni" size="sm" variant={layout === 'speaker' ? 'default' : 'ghost'} onClick={() => setLayout('speaker')}><User className="h-4 w-4" /></Button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="bg-gray-700 text-white border-none rounded-md p-2 text-sm"
                disabled={isLive}
              >
                <option value="1080p">1080p (FHD)</option>
                <option value="720p">720p (HD)</option>
                <option value="480p">480p (SD)</option>
              </select>
            </div>

            {broadcastId && (
              <StreamDestinations
                broadcastId={broadcastId}
                targets={targets}
                onTargetsChange={fetchBroadcastDetails}
              />
            )}

            {!isLive ? (
              <Button className="font-bold" variant="success" onClick={handleGoLive}>Canlı Yayına Geç</Button>
            ) : (
              <Button className="font-bold" variant="destructive" onClick={handleStopLive}>Yayını Bitir</Button>
            )}
          </>
        )}
      </div>
      <CustomRoomLayout layout={layout} onCompositeTrackPublished={setCompositeTrackSid} setLayout={setLayout} isHost={isHost} />
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
