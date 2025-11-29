'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchWithAuth } from '@/lib/utils';

interface StreamingTarget {
  id: number;
  platform: string;
  rtmp_url: string;
  stream_key: string;
}

export default function DestinationsPage() {
  const router = useRouter();
  const params = useParams();
  const broadcastId = params.id;

  const [targets, setTargets] = useState<StreamingTarget[]>([]);
  const [newTarget, setNewTarget] = useState({ platform: '', rtmp_url: '', stream_key: '' });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState<boolean>(false);

  const fetchTargets = async () => {
    if (!broadcastId) return;
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/broadcasts/${broadcastId}/targets`);
      if (!res.ok) throw new Error('Yayın hedefleri getirilemedi.');
      const data: StreamingTarget[] = await res.json();
      setTargets(data || []);
    } catch (err: any) {
       if (err.message.includes('Session expired')) {
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [broadcastId]);

  const handleCreateTarget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetchWithAuth(`/api/broadcasts/${broadcastId}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTarget),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Yayın hedefi oluşturulamadı.');
      }
      await fetchTargets();
      setNewTarget({ platform: '', rtmp_url: '', stream_key: '' });
      setCreateDialogOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTarget = async (targetId: number) => {
    setError('');
    try {
      const res = await fetchWithAuth(`/api/broadcasts/${broadcastId}/targets/${targetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Yayın hedefi silinemedi.');
      setTargets(targets.filter(t => t.id !== targetId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Yayın Hedefleri (Yayın ID: {broadcastId})</h1>
            <div className="flex items-center gap-2">
                <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild><Button>Yeni Hedef Ekle</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleCreateTarget}>
                        <DialogHeader>
                        <DialogTitle>Yeni Yayın Hedefi</DialogTitle>
                        <DialogDescription>Canlı yayın yapmak istediğiniz platformun bilgilerini girin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="platform" className="text-right">Platform</Label>
                                <Input id="platform" value={newTarget.platform} onChange={(e) => setNewTarget({...newTarget, platform: e.target.value})} className="col-span-3" required placeholder="örn: YouTube, Twitch"/>
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="rtmp_url" className="text-right">RTMP Adresi</Label>
                                <Input id="rtmp_url" value={newTarget.rtmp_url} onChange={(e) => setNewTarget({...newTarget, rtmp_url: e.target.value})} className="col-span-3" required placeholder="rtmp://a.rtmp.youtube.com/live2"/>
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="stream_key" className="text-right">Yayın Anahtarı</Label>
                                <Input id="stream_key" value={newTarget.stream_key} onChange={(e) => setNewTarget({...newTarget, stream_key: e.target.value})} className="col-span-3" required placeholder="xxxx-xxxx-xxxx-xxxx"/>
                            </div>
                        </div>
                        <DialogFooter><Button type="submit">Ekle</Button></DialogFooter>
                    </form>
                    </DialogContent>
                </Dialog>
                 <Button variant="outline" asChild><Link href="/dashboard">Panele Dön</Link></Button>
            </div>
        </div>

        {error && <p className="text-destructive mb-4">Hata: {error}</p>}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {targets.length > 0 ? (
            targets.map((target) => (
                <Card key={target.id}>
                <CardHeader><CardTitle>{target.platform}</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground overflow-hidden text-ellipsis">URL: {target.rtmp_url}</p>
                    <p className="text-sm text-muted-foreground overflow-hidden text-ellipsis">Anahtar: ****</p>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive">Sil</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                            <AlertDialogDescription>Bu işlem geri alınamaz. Bu yayın hedefini kalıcı olarak silecektir.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTarget(target.id)}>Sil</AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
                </Card>
            ))
            ) : (
            <div className="col-span-full text-center text-muted-foreground py-10"><p>Bu yayın için henüz bir hedef eklenmedi.</p></div>
            )}
        </div>
    </div>
  );
}
