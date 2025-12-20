import { useState, useEffect, useRef, useCallback } from 'react';
import {
    useParticipants,
    useLocalParticipant,
    useRoomContext,
    VideoTrack
} from '@livekit/components-react';
import { LocalVideoTrack, Track, RoomEvent, TrackPublication, Participant } from 'livekit-client';
import { ParticipantTile, StageTrack } from './ParticipantTile';

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

interface StudioLayoutProps {
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

export function StudioLayout({
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
}: StudioLayoutProps) {
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

        // Update canvas dimensions when quality changes
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

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
            track.stop();
            onCompositeTrackPublished(null);
        }
    }, [localParticipant, onCompositeTrackPublished, fps, quality, canvasWidth, canvasHeight]);

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

    // Cleanup video elements on participant disconnect (prevents memory leak)
    useEffect(() => {
        if (!room) return;

        const handleParticipantDisconnected = (participant: Participant) => {
            // Remove video element references for this participant
            const keysToDelete = Object.keys(videoElementsRef.current).filter(key =>
                key.startsWith(`${participant.sid}_`)
            );
            keysToDelete.forEach(key => {
                delete videoElementsRef.current[key];
            });

            // Also remove from stage if present
            setStageParticipants(prev =>
                prev.filter(t => t.participant.sid !== participant.sid)
            );
        };

        room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

        return () => {
            room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        };
    }, [room]);


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
