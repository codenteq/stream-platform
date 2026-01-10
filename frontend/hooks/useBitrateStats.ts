'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

export interface BitrateStats {
    outboundVideoBitrate: number;   // kbps
    outboundAudioBitrate: number;   // kbps
    totalBitrate: number;           // kbps
    timestamp: number;
    isHealthy: boolean;             // Hedef bitrate'in %50'sinden fazla mı
}

interface PrevStatsRef {
    videoBytes: number;
    audioBytes: number;
    timestamp: number;
}

export function useBitrateStats(
    targetVideoBitrate: number,
    intervalMs: number = 2000
): BitrateStats | null {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const [stats, setStats] = useState<BitrateStats | null>(null);
    const prevStats = useRef<PrevStatsRef | null>(null);

    const calculateBitrate = useCallback(async () => {
        if (!localParticipant) return;

        try {
            let totalVideoBytes = 0;
            let totalAudioBytes = 0;

            // Video track stats
            const videoPublication = localParticipant.getTrackPublication(Track.Source.Camera);
            const screenSharePublication = localParticipant.getTrackPublication(Track.Source.ScreenShare);

            // Get stats from video tracks
            for (const pub of [videoPublication, screenSharePublication]) {
                if (pub?.track?.sender) {
                    const report = await pub.track.sender.getStats();
                    report.forEach((stat: RTCStats & { bytesSent?: number; kind?: string }) => {
                        if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
                            totalVideoBytes += stat.bytesSent || 0;
                        }
                    });
                }
            }

            // Audio track stats
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            if (audioPublication?.track?.sender) {
                const report = await audioPublication.track.sender.getStats();
                report.forEach((stat: RTCStats & { bytesSent?: number; kind?: string }) => {
                    if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
                        totalAudioBytes += stat.bytesSent || 0;
                    }
                });
            }

            const now = Date.now();

            if (prevStats.current) {
                const timeDiffSeconds = (now - prevStats.current.timestamp) / 1000;

                if (timeDiffSeconds > 0) {
                    const videoBytesDiff = totalVideoBytes - prevStats.current.videoBytes;
                    const audioBytesDiff = totalAudioBytes - prevStats.current.audioBytes;

                    // Convert to kbps: (bytes * 8 bits) / seconds / 1000
                    const videoBitrate = Math.max(0, Math.round((videoBytesDiff * 8) / timeDiffSeconds / 1000));
                    const audioBitrate = Math.max(0, Math.round((audioBytesDiff * 8) / timeDiffSeconds / 1000));
                    const totalBitrate = videoBitrate + audioBitrate;

                    // Health check: is current bitrate at least 50% of target?
                    const isHealthy = videoBitrate >= (targetVideoBitrate * 0.5);

                    setStats({
                        outboundVideoBitrate: videoBitrate,
                        outboundAudioBitrate: audioBitrate,
                        totalBitrate,
                        timestamp: now,
                        isHealthy,
                    });
                }
            }

            prevStats.current = {
                videoBytes: totalVideoBytes,
                audioBytes: totalAudioBytes,
                timestamp: now,
            };
        } catch (error) {
            console.error('Failed to get bitrate stats:', error);
        }
    }, [localParticipant, targetVideoBitrate]);

    useEffect(() => {
        // Initial calculation
        calculateBitrate();

        // Set up interval
        const interval = setInterval(calculateBitrate, intervalMs);

        return () => {
            clearInterval(interval);
            prevStats.current = null;
        };
    }, [calculateBitrate, intervalMs]);

    // Reset stats when participant changes
    useEffect(() => {
        prevStats.current = null;
        setStats(null);
    }, [localParticipant]);

    return stats;
}
