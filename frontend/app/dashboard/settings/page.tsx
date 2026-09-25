'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/app/AppShell';
import { UserAvatar } from '@/components/app/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import type { CurrentUser } from '@/lib/types';

export default function SettingsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setName(u.name || '');
      })
      .catch(() => undefined);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const u = await api.updateMe({ name });
      setUser(u);
      setMessage('Kaydedildi');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-10 md:py-10">
      <PageHeader title="Ayarlar" description="Hesap bilgilerinizi yönetin." />

      <form onSubmit={save} className="rounded-xl border bg-background p-6">
        <h2 className="font-display text-lg font-bold">Profil</h2>
        <p className="mb-6 text-sm text-muted-foreground">Görünen adınız stüdyoda ve misafirlerinize varsayılan olarak gösterilir.</p>

        <div className="mb-6 flex items-center gap-4">
          <UserAvatar name={name || user?.email || '?'} size={56} />
          <div>
            <p className="font-medium">{name || user?.email?.split('@')[0]}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Görünen ad</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Adınız" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" value={user?.email || ''} disabled />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {message && <span className="text-sm text-muted-foreground">{message}</span>}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kaydet
          </Button>
        </div>
      </form>

      {user && (
        <p className="mt-4 text-xs text-muted-foreground">
          Üyelik tarihi: {new Date(user.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
