import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { fetchWithAuth } from '@/lib/utils';

export interface StreamingTarget {
    id: number;
    platform: string;
    rtmp_url: string;
    stream_key: string;
    egress_id?: string;
}

interface StreamDestinationsProps {
    broadcastId: number;
    targets: StreamingTarget[];
    onTargetsChange: () => void;
}

export function StreamDestinations({ broadcastId, targets, onTargetsChange }: StreamDestinationsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [platform, setPlatform] = useState('YouTube');
    const [rtmpUrl, setRtmpUrl] = useState('');
    const [streamKey, setStreamKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAddTarget = async () => {
        if (!rtmpUrl || !streamKey) return;
        setIsLoading(true);
        try {
            const response = await fetchWithAuth(`/api/broadcasts/${broadcastId}/targets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, rtmp_url: rtmpUrl, stream_key: streamKey }),
            });
            if (response.ok) {
                setRtmpUrl('');
                setStreamKey('');
                setIsOpen(false);
                onTargetsChange();
            } else {
                alert('Hedef eklenemedi.');
            }
        } catch (error) {
            console.error(error);
            alert('Bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTarget = async (targetId: number) => {
        if (!confirm('Bu yayin hedefini silmek istediğinize emin misiniz?')) return;
        try {
            const response = await fetchWithAuth(`/api/broadcasts/${broadcastId}/targets/${targetId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                onTargetsChange();
            } else {
                alert('Hedef silinemedi.');
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="bg-gray-800 text-white hover:bg-gray-700 border border-gray-700">
                    Yayın Hedefleri ({targets.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 text-white">
                <DialogHeader>
                    <DialogTitle>Yayın Hedefleri</DialogTitle>
                    <DialogDescription className="text-gray-400">Yayınınızın gönderileceği platformları yönetin.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        {targets.map(target => (
                            <div key={target.id} className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                                <div>
                                    <p className="font-bold text-white">{target.platform}</p>
                                    <p className="text-xs text-gray-400 truncate w-48">{target.rtmp_url}</p>
                                </div>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteTarget(target.id)}>Sil</Button>
                            </div>
                        ))}
                        {targets.length === 0 && <p className="text-gray-500 text-center">Henüz hedef eklenmemiş.</p>}
                    </div>

                    <div className="border-t border-gray-700 pt-4 space-y-3">
                        <h3 className="font-semibold text-white">Yeni Hedef Ekle</h3>
                        <select
                            value={platform}
                            onChange={e => setPlatform(e.target.value)}
                            className="w-full p-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="YouTube">YouTube</option>
                            <option value="Twitch">Twitch</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Custom">Custom RTMP</option>
                        </select>
                        <Input placeholder="RTMP URL" value={rtmpUrl} onChange={e => setRtmpUrl(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                        <Input type="password" placeholder="Stream Key" value={streamKey} onChange={e => setStreamKey(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddTarget} disabled={isLoading}>
                            {isLoading ? 'Ekleniyor...' : 'Ekle'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
