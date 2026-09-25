'use client';

import { useState } from 'react';
import { useBitrateStats } from '@/hooks/useBitrateStats';
import { BitrateGraph } from './BitrateGraph';
import { Wifi, WifiOff, Activity, HardDrive, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

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
                color: 'text-emerald-600',
                bgColor: 'bg-green-500',
                borderColor: 'border-green-500/30',
                label: 'Mükemmel',
                Icon: Wifi,
            };
        }
        if (percentage >= 50) {
            return {
                color: 'text-amber-600',
                bgColor: 'bg-yellow-500',
                borderColor: 'border-yellow-500/30',
                label: 'Orta',
                Icon: Wifi,
            };
        }
        return {
            color: 'text-red-600',
            bgColor: 'bg-red-500',
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

                {/* Bitrate values */}
                <div className="flex items-baseline gap-1">
                    <span className={`text-sm font-medium ${status.color}`}>
                        {formatBitrate(currentBitrate)}
                    </span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className="text-xs text-muted-foreground">
                        {formatBitrate(targetBitrate)}
                    </span>
                </div>

                {/* Data usage */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-2">
                    <HardDrive className="w-3 h-3" />
                    <span>~{calculateDataUsage(totalBitrate)} GB/sa</span>
                </div>

                {/* Graph toggle */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-2">
                    <BarChart3 className="w-3 h-3" />
                    {showGraph ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>

                {/* Status label */}
                <span className={`text-xs px-1.5 py-0.5 rounded ${status.bgColor}/20 ${status.color}`}>
                    {status.label}
                </span>
            </div>

            {/* Expandable Graph */}
            {showGraph && stats.history && (
                <div className="absolute top-full right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 p-2 shadow-xl">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            <span>Son 5 dakika</span>
                        </div>
                        <BitrateGraph
                            history={stats.history}
                            targetBitrate={targetBitrate}
                            width={220}
                            height={70}
                        />
                        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                            <span>5dk önce</span>
                            <span>Şimdi</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
