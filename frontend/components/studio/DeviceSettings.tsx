
import { useMediaDeviceSelect } from '@livekit/components-react';
import { RoomAudioRenderer } from '@livekit/components-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from 'react';

export function DeviceSettings() {
    const videoSelect = useMediaDeviceSelect({ kind: 'videoinput' });
    const audioSelect = useMediaDeviceSelect({ kind: 'audioinput' });

    // Debugging: Log devices to console
    useEffect(() => {
        console.log("Video devices:", videoSelect.devices);
        console.log("Audio devices:", audioSelect.devices);
    }, [videoSelect.devices, audioSelect.devices]);

    return (
        <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <Label htmlFor="camera-select" className="text-white">Kamera</Label>
                <Select
                    value={videoSelect.activeDeviceId}
                    onValueChange={videoSelect.setActiveMediaDevice}
                >
                    <SelectTrigger id="camera-select" className="bg-gray-800 text-white border-gray-700">
                        <SelectValue placeholder="Kamera Seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700">
                        {videoSelect.devices.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="mic-select" className="text-white">Mikrofon</Label>
                <Select
                    value={audioSelect.activeDeviceId}
                    onValueChange={audioSelect.setActiveMediaDevice}
                >
                    <SelectTrigger id="mic-select" className="bg-gray-800 text-white border-gray-700">
                        <SelectValue placeholder="Mikrofon Seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700">
                        {audioSelect.devices.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
