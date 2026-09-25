'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/app/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
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
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(res.status === 409 ? 'Bu e-posta ile zaten bir hesap var' : data.error || 'Kayıt başarısız');

      // Kayıttan sonra doğrudan giriş yap
      const login = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (login.ok) {
        const { token } = await login.json();
        localStorage.setItem('token', token);
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Hesap oluşturun"
      subtitle="Dakikalar içinde ilk canlı yayınınıza başlayın."
      footer={
        <>
          Zaten hesabınız var mı?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Giriş yapın
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Adınız</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ad Soyad" autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" placeholder="ornek@eposta.com" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Şifre</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">En az 6 karakter</p>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ücretsiz başla
        </Button>
      </form>
    </AuthCard>
  );
}
