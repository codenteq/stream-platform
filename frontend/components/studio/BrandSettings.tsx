import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Palette } from 'lucide-react';
import { fetchWithAuth } from '@/lib/utils';

interface BrandSettingsProps {
    broadcastId: number;
    title: string;
    logoUrl: string;
    showLogo: boolean;
    overlayUrl: string;
    showOverlay: boolean;
    onUpdate: () => void;
}

export function BrandSettings({ broadcastId, title, logoUrl, showLogo, overlayUrl, showOverlay, onUpdate }: BrandSettingsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localTitle, setLocalTitle] = useState(title);
    const [localLogoUrl, setLocalLogoUrl] = useState(logoUrl);
    const [localShowLogo, setLocalShowLogo] = useState(showLogo);
    const [localOverlayUrl, setLocalOverlayUrl] = useState(overlayUrl);
    const [localShowOverlay, setLocalShowOverlay] = useState(showOverlay);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLocalTitle(title);
            setLocalLogoUrl(logoUrl);
            setLocalShowLogo(showLogo);
            setLocalOverlayUrl(overlayUrl);
            setLocalShowOverlay(showOverlay);
        }
    }, [isOpen, title, logoUrl, showLogo, overlayUrl, showOverlay]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const response = await fetchWithAuth(`/api/broadcasts/${broadcastId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: localTitle,
                    logo_url: localLogoUrl,
                    show_logo: localShowLogo,
                    overlay_url: localOverlayUrl,
                    show_overlay: localShowOverlay
                }),
            });

            if (response.ok) {
                onUpdate();
                setIsOpen(false);
            } else {
                alert('Ayarlar kaydedilemedi.');
            }
        } catch (error) {
            console.error(error);
            alert('Bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" title="Marka Ayarları" className="bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 px-2">
                    <Palette className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 text-white">
                <DialogHeader>
                    <DialogTitle>Marka ve Görünüm</DialogTitle>
                    <DialogDescription className="text-gray-400">Yayınınızın başlığını, logosunu ve arayüzünü özelleştirin.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label className="text-gray-300">Yayın Başlığı</Label>
                        <Input value={localTitle} onChange={e => setLocalTitle(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                    </div>

                    <div className="space-y-2 border-t border-gray-700 pt-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-gray-300">Logo</Label>
                            <Switch checked={localShowLogo} onCheckedChange={setLocalShowLogo} />
                        </div>
                        <Input placeholder="Logo URL (PNG/JPG)" value={localLogoUrl} onChange={e => setLocalLogoUrl(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                        <p className="text-xs text-gray-400">Önerilen: 200x200px şeffaf PNG. Sağ üst köşede görünür.</p>
                    </div>

                    <div className="space-y-2 border-t border-gray-700 pt-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-gray-300">Overlay (Arayüz)</Label>
                            <Switch checked={localShowOverlay} onCheckedChange={setLocalShowOverlay} />
                        </div>
                        <Input placeholder="Overlay URL (PNG)" value={localOverlayUrl} onChange={e => setLocalOverlayUrl(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                        <p className="text-xs text-gray-400">Önerilen: 1280x720px şeffaf PNG. Tüm ekranı kaplar.</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleSave} disabled={isLoading} variant="secondary">{isLoading ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
