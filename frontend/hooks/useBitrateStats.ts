'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

export interface BitrateDataPoint {
    timestamp: number;
    videoBitrate: number;
    audioBitrate: number;
    totalBitrate: number;
    healthPercentage: number;
}

export interface BitrateStats {
    outboundVideoBitrate: number;
    outboundAudioBitrate: number;
    totalBitrate: number;
    timestamp: number;
    isHealthy: boolean;
    healthPercentage: number;
    history: BitrateDataPoint[];
}

interface PrevStatsRef {
    videoBytes: number;
    audioBytes: number;
    timestamp: number;
}

interface UseBitrateStatsOptions {
    onLowBitrate?: (percentage: number) => void;
    lowBitrateThreshold?: number;
    warningCooldownMs?: number;
    historyDurationMs?: number; // Varsayılan 5 dakika
    maxHistoryPoints?: number;  // Maksimum veri noktası
}

export function useBitrateStats(
    targetVideoBitrate: number,
    intervalMs: number = 2000,
    options?: UseBitrateStatsOptions
): BitrateStats | null {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const [stats, setStats] = useState<BitrateStats | null>(null);
    const prevStats = useRef<PrevStatsRef | null>(null);
    const lastWarningTime = useRef<number>(0);
    const historyRef = useRef<BitrateDataPoint[]>([]);

    const {
        onLowBitrate,
        lowBitrateThreshold = 30,
        warningCooldownMs = 30000,
        historyDurationMs = 5 * 60 * 1000, // 5 dakika
        maxHistoryPoints = 150 // 5 dakika / 2 saniye = 150 nokta
    } = options || {};

    const calculateBitrate = useCallback(async () => {
        if (!localParticipant) return;

        try {
            let totalVideoBytes = 0;
            let totalAudioBytes = 0;

            // Video track stats
            const videoPublication = localParticipant.getTrackPublication(Track.Source.Camera);
            const screenSharePublication = localParticipant.getTrackPublication(Track.Source.ScreenShare);

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

                    const videoBitrate = Math.max(0, Math.round((videoBytesDiff * 8) / timeDiffSeconds / 1000));
                    const audioBitrate = Math.max(0, Math.round((audioBytesDiff * 8) / timeDiffSeconds / 1000));
                    const totalBitrate = videoBitrate + audioBitrate;

                    const healthPercentage = targetVideoBitrate > 0
                        ? Math.round((videoBitrate / targetVideoBitrate) * 100)
                        : 0;
                    const isHealthy = healthPercentage >= 50;

                    // Low bitrate warning
                    if (onLowBitrate && healthPercentage < lowBitrateThreshold && healthPercentage > 0) {
                        const timeSinceLastWarning = now - lastWarningTime.current;
                        if (timeSinceLastWarning >= warningCooldownMs) {
                            lastWarningTime.current = now;
                            onLowBitrate(healthPercentage);
                        }
                    }

                    // History management
                    const newDataPoint: BitrateDataPoint = {
                        timestamp: now,
                        videoBitrate,
                        audioBitrate,
                        totalBitrate,
                        healthPercentage
                    };

                    // Eski verileri temizle ve yeni veri ekle
                    const cutoffTime = now - historyDurationMs;
                    historyRef.current = [
                        ...historyRef.current.filter(p => p.timestamp > cutoffTime),
                        newDataPoint
                    ].slice(-maxHistoryPoints);

                    setStats({
                        outboundVideoBitrate: videoBitrate,
                        outboundAudioBitrate: audioBitrate,
                        totalBitrate,
                        timestamp: now,
                        isHealthy,
                        healthPercentage,
                        history: [...historyRef.current]
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
    }, [localParticipant, targetVideoBitrate, onLowBitrate, lowBitrateThreshold, warningCooldownMs, historyDurationMs, maxHistoryPoints]);

    useEffect(() => {
        calculateBitrate();
        const interval = setInterval(calculateBitrate, intervalMs);
        return () => {
            clearInterval(interval);
            prevStats.current = null;
        };
    }, [calculateBitrate, intervalMs]);

    useEffect(() => {
        prevStats.current = null;
        historyRef.current = [];
        setStats(null);
        lastWarningTime.current = 0;
    }, [localParticipant]);

    return stats;
}
