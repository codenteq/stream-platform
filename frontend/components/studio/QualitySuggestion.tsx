'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, ChevronDown } from 'lucide-react';

interface QualitySuggestionProps {
    currentQuality: string;
    currentBitrate: number;
    targetBitrate: number;
    healthPercentage: number;
    onQualityChange?: (quality: string) => void;
    isLive: boolean;
}

const QUALITY_OPTIONS = [
    { value: '1080p', label: '1080p (FHD)', minBitrate: 6000 },
    { value: '720p', label: '720p (HD)', minBitrate: 3000 },
    { value: '480p', label: '480p (SD)', minBitrate: 1500 },
];

export function QualitySuggestion({
    currentQuality,
    currentBitrate,
    targetBitrate,
    healthPercentage,
    onQualityChange,
    isLive
}: QualitySuggestionProps) {
    const [isDismissed, setIsDismissed] = useState(false);
    const [showSuggestion, setShowSuggestion] = useState(false);

    // Determine if we should show a suggestion
    useEffect(() => {
        // Yayın başladıktan sonra kalite değiştirilemez
        if (isLive) {
            setShowSuggestion(false);
            return;
        }

        // Reset dismissed state when quality changes
        setIsDismissed(false);

        // Only show if health is below 40% for extended period
        if (healthPercentage > 0 && healthPercentage < 40) {
            const timer = setTimeout(() => {
                if (!isDismissed) {
                    setShowSuggestion(true);
                }
            }, 5000); // 5 saniye düşük durumda kalırsa göster
            return () => clearTimeout(timer);
        } else {
            setShowSuggestion(false);
        }
    }, [healthPercentage, isDismissed, isLive]);

    // Find recommended quality based on current bitrate
    const getRecommendedQuality = () => {
        for (const option of QUALITY_OPTIONS) {
            if (currentBitrate >= option.minBitrate) {
                return option;
            }
        }
        return QUALITY_OPTIONS[QUALITY_OPTIONS.length - 1]; // 480p as fallback
    };

    const recommendedQuality = getRecommendedQuality();
    const currentQualityIndex = QUALITY_OPTIONS.findIndex(o => o.value === currentQuality);
    const recommendedIndex = QUALITY_OPTIONS.findIndex(o => o.value === recommendedQuality.value);

    // Only show if recommended quality is lower than current
    if (!showSuggestion || recommendedIndex <= currentQualityIndex || isLive) {
        return null;
    }

    const handleAccept = () => {
        if (onQualityChange) {
            onQualityChange(recommendedQuality.value);
        }
        setShowSuggestion(false);
        setIsDismissed(true);
    };

    const handleDismiss = () => {
        setShowSuggestion(false);
        setIsDismissed(true);
    };

    return (
        <div className="animate-in slide-in-from-top-2 fade-in duration-300 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />

            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-yellow-400">
                    Bant genişliği yetersiz
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    Mevcut bant genişliğiniz ({(currentBitrate / 1000).toFixed(1)} Mbps) seçilen kalite için yetersiz görünüyor.
                    Daha iyi yayın kalitesi için <span className="text-yellow-400 font-medium">{recommendedQuality.label}</span> öneriyoruz.
                </div>

                <div className="flex items-center gap-2 mt-2">
                    <button
                        onClick={handleAccept}
                        className="px-3 py-1 text-xs font-medium bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-md transition-colors flex items-center gap-1"
                    >
                        <ChevronDown className="w-3 h-3" />
                        {recommendedQuality.label} geç
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="px-3 py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                    >
                        Kapat
                    </button>
                </div>
            </div>

            <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-400 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
