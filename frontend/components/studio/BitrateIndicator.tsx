'use client';

import { useState } from 'react';
import { useBitrateStats } from '@/hooks/useBitrateStats';
import { BitrateGraph } from './BitrateGraph';
import { Wifi, WifiOff, Activity, ChevronDown, ChevronUp } from 'lucide-react';

interface BitrateIndicatorProps {
    targetBitrate: number;
    isLive: boolean;
}

export function BitrateIndicator({ targetBitrate, isLive }: BitrateIndicatorProps) {
    const [showGraph, setShowGraph] = useState(false);
    const stats = useBitrateStats(targetBitrate, 2000);

    if (!isLive) return null;

    if (!stats) {
        return (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-background rounded-lg border">
                <Activity className="w-4 h-4 text-muted-foreground animate-pulse" />
                <span className="text-sm text-muted-foreground">Bitrate ölçülüyor...</span>
            </div>
        );
    }

    const currentBitrate = stats.outboundVideoBitrate;
    const totalBitrate = stats.totalBitrate;
    const percentage = stats.healthPercentage;

    const getStatus = () => {
        if (percentage >= 80) {
            return {
                color: 'text-success',
                bgColor: 'bg-success',
                borderColor: 'border-green-500/30',
                label: 'Mükemmel',
                Icon: Wifi,
            };
        }
        if (percentage >= 50) {
            return {
                color: 'text-cue',
                bgColor: 'bg-cue',
                borderColor: 'border-yellow-500/30',
                label: 'Orta',
                Icon: Wifi,
            };
        }
        return {
            color: 'text-live',
            bgColor: 'bg-live',
            borderColor: 'border-red-500/30',
            label: 'Düşük',
            Icon: WifiOff,
        };
    };

    const status = getStatus();
    const StatusIcon = status.Icon;

    const formatBitrate = (kbps: number): string => {
        if (kbps >= 1000) {
            return `${(kbps / 1000).toFixed(1)} Mbps`;
        }
        return `${kbps} kbps`;
    };

    const calculateDataUsage = (kbps: number): string => {
        const gbPerHour = (kbps * 3600) / 8 / 1024 / 1024;
        return gbPerHour.toFixed(1);
    };

    return (
        <div className="relative">
            <div
                className={`flex items-center gap-2 px-2.5 py-1 bg-background rounded-lg border ${status.borderColor} transition-all duration-300 cursor-pointer`}
                onClick={() => setShowGraph(!showGraph)}
                title={`Video: ${formatBitrate(currentBitrate)} | Audio: ${formatBitrate(stats.outboundAudioBitrate)} | Hedef: ${formatBitrate(targetBitrate)} | Tahmini: ~${calculateDataUsage(totalBitrate)} GB/saat`}
            >
                {/* Status indicator dot */}
                <div className="relative">
                    <div className={`w-2 h-2 rounded-full ${status.bgColor}`} />
                    <div className={`absolute inset-0 w-2 h-2 rounded-full ${status.bgColor} animate-ping opacity-75`} />
                </div>

                <StatusIcon className={`w-4 h-4 ${status.color}`} />

                <span className={`tabular text-sm font-semibold ${status.color}`}>{formatBitrate(currentBitrate)}</span>
                {showGraph ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>

            {/* Expandable Graph */}
            {showGraph && stats.history && (
                <div className="absolute top-full right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="w-[252px] rounded-lg bg-bezel p-3 text-white shadow-xl">
                        <div className="mb-2 flex items-baseline justify-between">
                            <span className={`text-xs font-semibold ${status.color}`}>Bağlantı: {status.label.toLocaleLowerCase('tr-TR')}</span>
                            <span className="tabular text-[11px] text-white/60">Hedef {formatBitrate(targetBitrate)}</span>
                        </div>
                        <BitrateGraph
                            history={stats.history}
                            targetBitrate={targetBitrate}
                            width={220}
                            height={70}
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-white/50">
                            <span>5 dk önce</span>
                            <span>Şimdi</span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-y-1 border-t border-white/10 pt-2 text-[11px]">
                            <dt className="text-white/60">Görüntü</dt>
                            <dd className="tabular text-right">{formatBitrate(currentBitrate)}</dd>
                            <dt className="text-white/60">Ses</dt>
                            <dd className="tabular text-right">{formatBitrate(stats.outboundAudioBitrate)}</dd>
                            <dt className="text-white/60">Veri kullanımı</dt>
                            <dd className="tabular text-right">~{calculateDataUsage(totalBitrate)} GB/saat</dd>
                        </dl>
                    </div>
                </div>
            )}
        </div>
    );
}
