'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/app/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('token')) router.push('/dashboard');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(res.status === 401 ? 'E-posta veya şifre hatalı' : data.error || 'Giriş yapılamadı');
      localStorage.setItem('token', data.token);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') ? next : '/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Tekrar hoş geldiniz"
      subtitle="Stüdyonuza erişmek için giriş yapın."
      footer={
        <>
          Hesabınız yok mu?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Ücretsiz kaydolun
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" placeholder="ornek@eposta.com" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Şifre</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Giriş yap
        </Button>
      </form>
    </AuthCard>
  );
}
