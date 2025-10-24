'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchWithAuth } from '@/lib/utils';

interface Broadcast {
  id: number;
  title: string;
  studio_code: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [newBroadcastTitle, setNewBroadcastTitle] = useState<string>('');
  const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState<boolean>(false);

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/broadcasts');
      if (!res.ok) throw new Error('Yayınlar getirilemedi.');
      const data: Broadcast[] = await res.json();
      setBroadcasts(data || []);
    } catch (err: any) {
      if (err.message.includes('Session expired')) {
        // The fetchWithAuth utility will handle the redirect.
        // We just need to stop processing.
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handleCreateBroadcast = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetchWithAuth('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newBroadcastTitle }),
      });
      if (!res.ok) throw new Error('Yayın oluşturulamadı.');
      await fetchBroadcasts();
      setNewBroadcastTitle('');
      setCreateDialogOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateBroadcast = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBroadcast) return;
    setError('');
    try {
      const res = await fetchWithAuth(`/api/broadcasts/${editingBroadcast.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: editingBroadcast.title }),
        }
      );
      if (!res.ok) throw new Error('Yayın güncellenemedi.');
      await fetchBroadcasts();
      setEditingBroadcast(null);
      setEditDialogOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBroadcast = async (broadcastId: number) => {
    setError('');
    try {
      const res = await fetchWithAuth(`/api/broadcasts/${broadcastId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Yayın silinemedi.');
      setBroadcasts(broadcasts.filter(b => b.id !== broadcastId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {editingBroadcast && (
            <form onSubmit={handleUpdateBroadcast}>
              <DialogHeader><DialogTitle>Yayını Düzenle</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-title" className="text-right">Başlık</Label>
                  <Input id="edit-title" value={editingBroadcast.title} onChange={(e) => setEditingBroadcast({...editingBroadcast, title: e.target.value})} className="col-span-3" required />
                </div>
              </div>
              <DialogFooter><Button type="submit">Kaydet</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Yayın Panelim</h1>
        <div className="flex items-center gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild><Button>Yeni Yayın Oluştur</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreateBroadcast}>
                <DialogHeader>
                  <DialogTitle>Yeni Yayın Oluştur</DialogTitle>
                  <DialogDescription>Yayınınız için bir başlık girin.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Başlık</Label>
                    <Input id="title" value={newBroadcastTitle} onChange={(e) => setNewBroadcastTitle(e.target.value)} className="col-span-3" required />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Oluştur</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" asChild><Link href="/dashboard/destinations">Yayın Hedefleri</Link></Button>
          <Button variant="outline" asChild><Link href="/profile">Profil</Link></Button>
          <Button variant="outline" onClick={handleLogout}>Çıkış Yap</Button>
        </div>
      </div>

      {error && <p className="text-destructive mb-4">Hata: {error}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {broadcasts.length > 0 ? (
          broadcasts.map((broadcast) => (
            <Card key={broadcast.id}>
              <CardHeader><CardTitle>{broadcast.title}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Oluşturulma: {new Date(broadcast.created_at).toLocaleString()}</p></CardContent>
              <CardFooter className="flex justify-between">
                <Button asChild><Link href={`/studio/${broadcast.studio_code}`}>Stüdyoya Git</Link></Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setEditingBroadcast(broadcast); setEditDialogOpen(true); }}>Düzenle</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive">Sil</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>Bu işlem geri alınamaz. Bu yayın kalıcı olarak silinecektir.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteBroadcast(broadcast.id)}>Sil</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center text-muted-foreground py-10"><p>Henüz bir yayın oluşturmadınız.</p></div>
        )}
      </div>
    </div>
  );
}