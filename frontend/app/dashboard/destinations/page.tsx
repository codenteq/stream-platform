'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from 'next/link';

interface Destination {
    id: string;
    name: string;
    url: string;
}

export default function DestinationsPage() {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [newDestinationName, setNewDestinationName] = useState('');
    const [newDestinationUrl, setNewDestinationUrl] = useState('');

    const fetchDestinations = async () => {
        const token = localStorage.getItem('token');
        try {
            setLoading(true);
            const res = await fetch('/api/destinations', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Yayın hedefleri getirilemedi.');
            const data = await res.json();
            setDestinations(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDestinations();
    }, []);

    const handleAddDestination = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: newDestinationName, url: newDestinationUrl }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.details || 'Hedef eklenemedi.');
            }
            // After adding, refetch the entire list to ensure data consistency
            await fetchDestinations(); 
            setNewDestinationName('');
            setNewDestinationUrl('');
            setCreateOpen(false);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDeleteDestination = async (id: string) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/destinations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Hedef silinemedi.');
            // After deleting, refetch the list to ensure data consistency
            await fetchDestinations(); 
        } catch (err: any) {
            setError(err.message);
        } 
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Yayın Hedefleri</h1>
                <div className="flex items-center gap-2">
                    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild><Button>Yeni Hedef Ekle</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <form onSubmit={handleAddDestination}>
                                <DialogHeader>
                                    <DialogTitle>Yeni Yayın Hedefi</DialogTitle>
                                    <DialogDescription>RTMP URL'ini ve yayın anahtarını girin.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">İsim (Örn: YouTube)</Label>
                                        <Input id="name" value={newDestinationName} onChange={(e) => setNewDestinationName(e.target.value)} required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="url">RTMP URL + Yayın Anahtarı</Label>
                                        <Input id="url" placeholder="rtmp://a.rtmp.youtube.com/live2/your-stream-key" value={newDestinationUrl} onChange={(e) => setNewDestinationUrl(e.target.value)} required />
                                    </div>
                                </div>
                                <DialogFooter><Button type="submit">Ekle</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" asChild><Link href="/dashboard">Panele Geri Dön</Link></Button>
                </div>
            </div>

            {error && <p className="text-destructive mb-4">Hata: {error}</p>}

            {loading ? (
                <p>Yükleniyor...</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {destinations.length > 0 ? (
                        destinations.map((dest) => (
                            <Card key={dest.id}>
                                <CardHeader><CardTitle>{dest.name}</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground truncate">{dest.url}</p></CardContent>
                                <CardFooter className="flex justify-end">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive">Sil</Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                <AlertDialogDescription>Bu işlem geri alınamaz. Bu hedef kalıcı olarak silinecektir.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteDestination(dest.id)}>Sil</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-full text-center text-muted-foreground py-10"><p>Henüz bir yayın hedefi eklemediniz.</p></div>
                    )}
                </div>
            )}
        </div>
    );
}
