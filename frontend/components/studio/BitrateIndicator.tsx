'use client';

import { useBitrateStats } from '@/hooks/useBitrateStats';
import { Wifi, WifiOff, Activity } from 'lucide-react';

interface BitrateIndicatorProps {
    targetBitrate: number;    // Kullanıcının seçtiği hedef bitrate (kbps)
    isLive: boolean;
}

export function BitrateIndicator({ targetBitrate, isLive }: BitrateIndicatorProps) {
    const stats = useBitrateStats(targetBitrate, 2000);

    if (!isLive) return null;

    // Stats henüz yüklenmediyse loading göster
    if (!stats) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
                <Activity className="w-4 h-4 text-gray-400 animate-pulse" />
                <span className="text-sm text-gray-400">Bitrate ölçülüyor...</span>
            </div>
        );
    }

    const currentBitrate = stats.outboundVideoBitrate;
    const percentage = targetBitrate > 0 ? (currentBitrate / targetBitrate) * 100 : 0;

    // Durum belirleme
    const getStatus = () => {
        if (percentage >= 80) {
            return {
                color: 'text-green-400',
                bgColor: 'bg-green-500',
                borderColor: 'border-green-500/30',
                label: 'Mükemmel',
                Icon: Wifi,
            };
        }
        if (percentage >= 50) {
            return {
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-500',
                borderColor: 'border-yellow-500/30',
                label: 'Orta',
                Icon: Wifi,
            };
        }
        return {
            color: 'text-red-400',
            bgColor: 'bg-red-500',
            borderColor: 'border-red-500/30',
            label: 'Düşük',
            Icon: WifiOff,
        };
    };

    const status = getStatus();
    const StatusIcon = status.Icon;

    // Format bitrate for display
    const formatBitrate = (kbps: number): string => {
        if (kbps >= 1000) {
            return `${(kbps / 1000).toFixed(1)} Mbps`;
        }
        return `${kbps} kbps`;
    };

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 backdrop-blur-sm rounded-lg border ${status.borderColor} transition-all duration-300`}
            title={`Video: ${formatBitrate(currentBitrate)} | Audio: ${formatBitrate(stats.outboundAudioBitrate)} | Hedef: ${formatBitrate(targetBitrate)}`}
        >
            {/* Status indicator dot */}
            <div className="relative">
                <div className={`w-2 h-2 rounded-full ${status.bgColor}`} />
                <div className={`absolute inset-0 w-2 h-2 rounded-full ${status.bgColor} animate-ping opacity-75`} />
            </div>

            {/* Icon */}
            <StatusIcon className={`w-4 h-4 ${status.color}`} />

            {/* Bitrate values */}
            <div className="flex items-baseline gap-1">
                <span className={`text-sm font-medium ${status.color}`}>
                    {formatBitrate(currentBitrate)}
                </span>
                <span className="text-xs text-gray-500">/</span>
                <span className="text-xs text-gray-400">
                    {formatBitrate(targetBitrate)}
                </span>
            </div>

            {/* Status label */}
            <span className={`text-xs px-1.5 py-0.5 rounded ${status.bgColor}/20 ${status.color}`}>
                {status.label}
            </span>
        </div>
    );
}
