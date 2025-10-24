'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fetchWithAuth } from '@/lib/utils';

interface User {
  id: number;
  email: string;
  CreatedAt: string; 
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetchWithAuth('/api/me');

        if (!res.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data: User = await res.json();
        setUser(data);
      } catch (err: any) {
        if (!err.message.includes('Session expired')) {
            setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-8">Profilim</h1>
        {error && <p className="text-destructive mb-4">Hata: {error}</p>}
        {user && (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Kullanıcı Bilgileri</CardTitle>
                    <CardDescription>Hesap detaylarınız.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Kullanıcı ID:</span>
                        <span className="font-medium">{user.id}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">E-posta:</span>
                        <span className="font-medium">{user.email}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Hesap Oluşturma:</span>
                        <span className="font-medium">{new Date(user.CreatedAt).toLocaleString()}</span>
                    </div>
                </CardContent>
            </Card>
        )}
        <Button variant="outline" asChild className="mt-8">
            <Link href="/dashboard">Panele Geri Dön</Link>
        </Button>
    </div>
  );
}
