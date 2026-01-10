'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useLocalParticipant,
  useRoomContext,
  LiveKitRoom,
  TrackToggle,
  RoomAudioRenderer,
  useStartAudio,
} from '@livekit/components-react';
import { RoomEvent, Track, VideoPresets } from 'livekit-client';
import '@livekit/components-styles';
import { fetchWithAuth } from '@/lib/utils';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { StreamDestinations, StreamingTarget } from '@/components/studio/StreamDestinations';
import { BrandSettings } from '@/components/studio/BrandSettings';
import { DeviceSettings } from '@/components/studio/DeviceSettings';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { User, LayoutGrid, Settings } from 'lucide-react';
import { CustomAudioRenderer } from '@/components/CustomAudioRenderer';
import { useAudioMixer } from '@/hooks/useAudioMixer';

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

function StudioContent({ studioCode, initialRole }: { studioCode: string, initialRole: 'host' | 'guest' }) {
  const [isLive, setIsLive] = useState<boolean>(false);
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [compositeTrackSid, setCompositeTrackSid] = useState<string | null>(null);
  const [quality, setQuality] = useState<string>('1080p');
  const [fps, setFps] = useState<number>(30);
  const [videoBitrate, setVideoBitrate] = useState<number>(10000);
  const [audioBitrate] = useState<number>(128);
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  // Audio Mixing Hook
  const { mixedTrack } = useAudioMixer(room, localParticipant);

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

  // Quality değiştiğinde varsayılan bitrate'i güncelle
  useEffect(() => {
    const defaultBitrates: Record<string, number> = {
      '1080p': 10000,
      '720p': 6000,
      '480p': 3000
    };
    setVideoBitrate(defaultBitrates[quality] || 3000);
  }, [quality]);

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

        // Check if already live
        const liveTargets = (data.targets || []).filter((t: StreamingTarget) => t.egress_id);
        if (liveTargets.length > 0) {
          setIsLive(true);
        }
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

    // Use the mixed audio track if available, otherwise fallback to microphone
    // The mixer creates a track named 'broadcast-mix'
    let audioTrackId = mixedTrack?.sid;

    if (!audioTrackId) {
      // Fallback or if mixer not ready
      const audioTrack = localParticipant?.getTrackPublication(Track.Source.Microphone);
      audioTrackId = audioTrack?.trackSid;
    }

    if (!audioTrackId) {
      alert('Yayın başlatılamıyor. Ses kaynağı (mikrofon veya mikser) bulunamadı.');
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
        body: JSON.stringify({ trackId: compositeTrackSid, audioTrackId: audioTrackId, quality, fps, videoBitrate, audioBitrate }),
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
        <TrackToggle
          source={Track.Source.ScreenShare}
          captureOptions={{ audio: true }}
          className="bg-gray-800 text-white hover:bg-gray-700 data-[state=on]:bg-green-600"
        >
          Ekran
        </TrackToggle>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="icon" className="bg-gray-800 text-white hover:bg-gray-700 ml-2">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Cihaz Ayarları</DialogTitle>
              <DialogDescription className="text-gray-400">
                Kamera ve mikrofon seçiminizi yapın.
              </DialogDescription>
            </DialogHeader>
            <DeviceSettings />
          </DialogContent>
        </Dialog>

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

            <select
              value={videoBitrate}
              onChange={(e) => setVideoBitrate(Number(e.target.value))}
              className="bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLive}
            >
              {quality === '1080p' && (
                <>
                  <option value="4500">Düşük (4.5 Mbps)</option>
                  <option value="8000">Orta (8 Mbps)</option>
                  <option value="10000">Yüksek (10 Mbps)</option>
                  <option value="15000">Çok Yüksek (15 Mbps)</option>
                </>
              )}
              {quality === '720p' && (
                <>
                  <option value="2500">Düşük (2.5 Mbps)</option>
                  <option value="4500">Orta (4.5 Mbps)</option>
                  <option value="6000">Yüksek (6 Mbps)</option>
                  <option value="8000">Çok Yüksek (8 Mbps)</option>
                </>
              )}
              {quality === '480p' && (
                <>
                  <option value="1500">Düşük (1.5 Mbps)</option>
                  <option value="2500">Orta (2.5 Mbps)</option>
                  <option value="3000">Yüksek (3 Mbps)</option>
                  <option value="4500">Çok Yüksek (4.5 Mbps)</option>
                </>
              )}
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
      <StudioLayout
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

export default function StudioSession({ token, serverUrl, studioCode, initialRole = 'guest' }: StudioSessionProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={!!token}
      video={{ resolution: VideoPresets.h1080.resolution, frameRate: 30 }}
      audio={true}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onMediaDeviceFailure={(error) => console.error('Media device failure:', error)}
    >
      <StudioContent studioCode={studioCode} initialRole={initialRole} />
      {/* Replace default renderer with custom one to avoid echo from mixed track */}
      <CustomAudioRenderer />
      <StartAudioButton />
    </LiveKitRoom>
  );
}
