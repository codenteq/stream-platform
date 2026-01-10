'use client';

import { BitrateDataPoint } from '@/hooks/useBitrateStats';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BitrateGraphProps {
    history: BitrateDataPoint[];
    targetBitrate: number;
    width?: number;
    height?: number;
}

export function BitrateGraph({
    history,
    targetBitrate,
    width = 200,
    height = 60
}: BitrateGraphProps) {
    if (history.length < 2) {
        return (
            <div
                className="flex items-center justify-center bg-gray-800/50 rounded-lg border border-gray-700"
                style={{ width, height }}
            >
                <span className="text-xs text-gray-500">Veri toplanıyor...</span>
            </div>
        );
    }

    // Calculate min/max for scaling
    const bitrates = history.map(p => p.videoBitrate);
    const maxBitrate = Math.max(...bitrates, targetBitrate);
    const minBitrate = Math.min(...bitrates);
    const range = maxBitrate - minBitrate || 1;

    // Padding for graph
    const padding = { top: 5, bottom: 5, left: 5, right: 5 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Generate SVG path
    const points = history.map((point, index) => {
        const x = padding.left + (index / (history.length - 1)) * graphWidth;
        const y = padding.top + graphHeight - ((point.videoBitrate - minBitrate) / range) * graphHeight;
        return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;

    // Target line Y position
    const targetY = padding.top + graphHeight - ((targetBitrate - minBitrate) / range) * graphHeight;

    // Trend calculation
    const recentPoints = history.slice(-10);
    const oldAvg = recentPoints.slice(0, 5).reduce((a, b) => a + b.videoBitrate, 0) / 5;
    const newAvg = recentPoints.slice(-5).reduce((a, b) => a + b.videoBitrate, 0) / 5;
    const trend = newAvg - oldAvg;

    // Get current health color
    const currentHealth = history[history.length - 1]?.healthPercentage || 0;
    const getStrokeColor = () => {
        if (currentHealth >= 80) return '#22c55e'; // green
        if (currentHealth >= 50) return '#eab308'; // yellow
        return '#ef4444'; // red
    };

    const TrendIcon = trend > 50 ? TrendingUp : trend < -50 ? TrendingDown : Minus;
    const trendColor = trend > 50 ? 'text-green-400' : trend < -50 ? 'text-red-400' : 'text-gray-400';

    return (
        <div className="relative bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <svg width={width} height={height} className="block">
                {/* Background grid */}
                <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3" />
                    </pattern>
                </defs>
                <rect width={width} height={height} fill="url(#grid)" />

                {/* Target line */}
                <line
                    x1={padding.left}
                    y1={targetY}
                    x2={width - padding.right}
                    y2={targetY}
                    stroke="#6b7280"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                    opacity="0.5"
                />

                {/* Gradient fill under the line */}
                <defs>
                    <linearGradient id="bitrateGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={getStrokeColor()} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={getStrokeColor()} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Fill area */}
                <path
                    d={`${pathD} L ${width - padding.right},${height - padding.bottom} L ${padding.left},${height - padding.bottom} Z`}
                    fill="url(#bitrateGradient)"
                />

                {/* Main line */}
                <path
                    d={pathD}
                    fill="none"
                    stroke={getStrokeColor()}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Current point */}
                <circle
                    cx={width - padding.right}
                    cy={padding.top + graphHeight - ((history[history.length - 1].videoBitrate - minBitrate) / range) * graphHeight}
                    r="3"
                    fill={getStrokeColor()}
                />
            </svg>

            {/* Trend indicator */}
            <div className={`absolute top-1 right-1 ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
            </div>

            {/* Min/Max labels */}
            <div className="absolute bottom-0 left-1 text-[8px] text-gray-500">
                {(minBitrate / 1000).toFixed(1)}
            </div>
            <div className="absolute top-0 left-1 text-[8px] text-gray-500">
                {(maxBitrate / 1000).toFixed(1)}
            </div>
        </div>
    );
}
