'use client';

import { useState, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
  VideoTrack,
} from '@livekit/components-react';
import type { Participant, TrackPublication } from 'livekit-client';
import { LocalVideoTrack, Track } from 'livekit-client';
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
        const thumbWidth = thumbHeight * (16/9);
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

function CustomRoomLayout({ layout, onCompositeTrackPublished }: { layout: LayoutMode, onCompositeTrackPublished: (sid: string | null) => void }) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementsRef = useRef<Record<string, HTMLVideoElement>>({});
  const [stageParticipants, setStageParticipants] = useState<Participant[]>([]);

  // Add local participant to stage when they connect and stage is empty
  useEffect(() => {
    if (localParticipant && stageParticipants.length === 0) {
      setStageParticipants([localParticipant]);
    }
  }, [localParticipant, stageParticipants]);

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

  const addToStage = (participant: Participant) => {
    if (stageParticipants.find(p => p.sid === participant.sid)) return;
    setStageParticipants([...stageParticipants, participant]);
  };

  const removeFromStage = (participant: Participant) => {
    setStageParticipants(stageParticipants.filter(p => p.sid !== participant.sid));
  };

  const setFeatured = (participant: Participant) => {
      setStageParticipants([participant, ...stageParticipants.filter(p => p.sid !== participant.sid)]);
  }

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
        {backstageParticipants.map(p => {
            const pub = p.getTrackPublication(Track.Source.Camera);
            return (
                <div key={p.sid} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                    {pub?.track ? (
                        <VideoTrack trackRef={{ participant: p, publication: pub, source: pub.source }} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <User className="h-8 w-8 text-gray-400" />
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                        <p className="text-white text-sm truncate">{p.identity}</p>
                    </div>
                    <Button variant="secondary" size="sm" className="absolute top-2 right-2 z-10" onClick={() => addToStage(p)}>
                      Sahneye Ekle
                    </Button>
                </div>
            );
        })}
        <hr className="border-gray-700" />
        <h2 className="text-lg font-semibold text-white">Sahnede</h2>
         {stageParticipants.map(p => {
            const pub = p.getTrackPublication(Track.Source.Camera);
            return (
                <div key={p.sid} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                    {pub?.track ? (
                        <VideoTrack trackRef={{ participant: p, publication: pub, source: pub.source }} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <User className="h-12 w-12 text-gray-400" />
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                        <p className="text-white text-sm truncate">{p.identity}</p>
                    </div>
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                        {localParticipant && p.sid !== localParticipant.sid && (
                            <Button variant="destructive" size="sm" className="p-1 h-auto" onClick={() => removeFromStage(p)}>Çıkar</Button>
                        )}
                        {layout === 'speaker' && p.sid !== stageParticipants[0]?.sid && (
                             <Button variant="secondary" size="sm" className="p-1 h-auto" onClick={() => setFeatured(p)}>Öne Çıkar</Button>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}

interface StudioSessionProps {
  token: string;
  serverUrl: string;
  studioCode: string;
}

export default function StudioSession({ token, serverUrl, studioCode }: StudioSessionProps) {
  const [isLive, setIsLive] = useState<boolean>(false);
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [compositeTrackSid, setCompositeTrackSid] = useState<string | null>(null);

  const handleGoLive = async () => {
    if (!compositeTrackSid) {
      alert('Yayın başlatılamıyor. Kompozit iz bulunamadı.');
      return;
    }
    try {
      const response = await fetchWithAuth(`/api/broadcasts/studio/${studioCode}/start-track-composite-egress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: compositeTrackSid }),
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
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      data-lk-theme="default"
      style={{ height: '100vh' }}
    >
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-center items-center gap-4 p-4 bg-gray-800/50">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Katılımcı Davet Et</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Katılımcı Davet Et</DialogTitle>
              <DialogDescription>
                Aşağıdaki linki kopyalayarak katılımcıları stüdyonuza davet edebilirsiniz.
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

        <div className="flex items-center gap-2 p-1 bg-gray-700 rounded-md">
            <Button title="Grid Düzeni" size="sm" variant={layout === 'grid' ? 'default' : 'ghost'} onClick={() => setLayout('grid')}><LayoutGrid className="h-4 w-4" /></Button>
            <Button title="Konuşmacı Düzeni" size="sm" variant={layout === 'speaker' ? 'default' : 'ghost'} onClick={() => setLayout('speaker')}><User className="h-4 w-4" /></Button>
        </div>

        {!isLive ? (
          <Button className="font-bold" variant="success" onClick={handleGoLive}>Canlı Yayına Geç</Button>
        ) : (
          <Button className="font-bold" variant="destructive" onClick={handleStopLive}>Yayını Bitir</Button>
        )}
      </div>
      <CustomRoomLayout layout={layout} onCompositeTrackPublished={setCompositeTrackSid} />
    </LiveKitRoom>
  );
}
