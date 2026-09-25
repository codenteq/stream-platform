'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LogOut, UserX, VideoOff, WifiOff } from 'lucide-react';
import StudioSession, { type LeaveReason } from '@/components/StudioSession';
import { Lobby, type JoinChoices } from '@/components/studio/Lobby';
import { Logo } from '@/components/app/Logo';
import { Button } from '@/components/ui/button';
import type { Broadcast } from '@/lib/types';

type Phase = 'loading' | 'notfound' | 'lobby' | 'studio' | 'left';

interface StudioInfo {
  title: string;
  host_name: string;
  status: string;
}

const GUEST_NAME_KEY = 'studio-guest-name';

function FullScreenMessage({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/60 px-4 text-center">
      <Logo className="mb-10" />
      <div className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">{icon}</div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        {children && <div className="mt-6 flex flex-col gap-2">{children}</div>}
      </div>
    </div>
  );
}

export default function StudioPage() {
  const params = useParams();
  const router = useRouter();
  const studioCode = params.studioCode as string;
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;

  const [phase, setPhase] = useState<Phase>('loading');
  const [info, setInfo] = useState<StudioInfo | null>(null);
  const [role, setRole] = useState<'host' | 'guest'>('guest');
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [defaultName, setDefaultName] = useState('');
  const [token, setToken] = useState('');
  const [choices, setChoices] = useState<JoinChoices | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [leaveReason, setLeaveReason] = useState<LeaveReason>('left');

  useEffect(() => {
    if (!studioCode) return;
    let cancelled = false;

    (async () => {
      const infoRes = await fetch(`/api/public/studio/${studioCode}`).catch(() => null);
      if (!infoRes || !infoRes.ok) {
        if (!cancelled) setPhase('notfound');
        return;
      }
      const studio: StudioInfo = await infoRes.json();

      // Giriş yapmış ve stüdyonun sahibi ise yapımcı olarak katılır
      const authToken = localStorage.getItem('token');
      let asHost = false;
      let hostName = '';
      if (authToken) {
        const headers = { Authorization: `Bearer ${authToken}` };
        const [bRes, meRes] = await Promise.all([
          fetch(`/api/broadcasts/studio/${studioCode}`, { headers }).catch(() => null),
          fetch('/api/me', { headers }).catch(() => null),
        ]);
        if (bRes?.ok) {
          asHost = true;
          if (!cancelled) setBroadcast(await bRes.json());
        } else if (bRes?.status === 401) {
          // Oturum süresi dolmuş: misafir olarak devam edilir, lobide giriş linki gösterilir
          localStorage.removeItem('token');
        }
        if (meRes?.ok) {
          const me = await meRes.json();
          hostName = me.name || me.email?.split('@')[0] || '';
        }
      }

      if (cancelled) return;
      setInfo(studio);
      setRole(asHost ? 'host' : 'guest');
      setDefaultName(asHost ? hostName : localStorage.getItem(GUEST_NAME_KEY) || hostName);
      setPhase('lobby');
    })();

    return () => {
      cancelled = true;
    };
  }, [studioCode]);

  const join = async (c: JoinChoices) => {
    setJoining(true);
    setJoinError('');
    try {
      let res: Response;
      if (role === 'host') {
        res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          body: JSON.stringify({ room: studioCode, name: c.name }),
        });
      } else {
        localStorage.setItem(GUEST_NAME_KEY, c.name);
        res = await fetch('/api/public/join-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studioCode, name: c.name }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Stüdyoya katılınamadı');
      setToken(data.token);
      setChoices(c);
      setPhase('studio');
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const onLeft = (reason: LeaveReason) => {
    if (role === 'host' && reason === 'left') {
      router.push('/dashboard');
      return;
    }
    setLeaveReason(reason);
    setToken('');
    setPhase('left');
    // Yeniden katılınca stüdyo güncel yayın durumuyla açılsın
    if (role === 'host') {
      fetch(`/api/broadcasts/studio/${studioCode}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b && setBroadcast(b))
        .catch(() => undefined);
    }
  };

  if (!serverUrl) {
    return <FullScreenMessage icon={<VideoOff className="h-6 w-6" />} title="Yapılandırma eksik" text="NEXT_PUBLIC_LIVEKIT_WS_URL tanımlı değil." />;
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/60 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Stüdyo yükleniyor…
      </div>
    );
  }

  if (phase === 'notfound') {
    return (
      <FullScreenMessage icon={<VideoOff className="h-6 w-6" />} title="Stüdyo bulunamadı" text="Bu davet linki geçersiz ya da yayın silinmiş olabilir.">
        <Button asChild>
          <Link href="/">Ana sayfaya dön</Link>
        </Button>
      </FullScreenMessage>
    );
  }

  if (phase === 'left') {
    const messages: Record<LeaveReason, { icon: React.ReactNode; title: string; text: string; action: string }> = {
      left: { icon: <LogOut className="h-6 w-6" />, title: 'Stüdyodan ayrıldınız', text: 'Katıldığınız için teşekkürler!', action: 'Tekrar katıl' },
      removed: { icon: <UserX className="h-6 w-6" />, title: 'Stüdyodan çıkarıldınız', text: 'Yapımcı sizi stüdyodan çıkardı.', action: 'Tekrar katıl' },
      ended: { icon: <LogOut className="h-6 w-6" />, title: 'Stüdyo kapandı', text: 'Bu stüdyo oturumu sona erdi.', action: 'Tekrar katıl' },
      duplicate: {
        icon: <WifiOff className="h-6 w-6" />,
        title: 'Stüdyo başka bir sekmede açıldı',
        text: 'Aynı kişi olarak stüdyoya başka bir sekmeden ya da cihazdan girildi. Bu sekmedeki bağlantı kapatıldı.',
        action: 'Bu sekmede devam et',
      },
      error: {
        icon: <WifiOff className="h-6 w-6" />,
        title: 'Bağlantı koptu',
        text:
          role === 'host'
            ? 'Stüdyoyla bağlantınız kesildi. Yeniden bağlandığınızda yayın, yeni bağlantıya otomatik olarak aktarılır.'
            : 'Stüdyoyla bağlantınız kesildi. İnternet bağlantınızı kontrol edip yeniden katılın.',
        action: 'Yeniden bağlan',
      },
    };
    const m = messages[leaveReason];
    return (
      <FullScreenMessage icon={m.icon} title={m.title} text={m.text}>
        <Button onClick={() => setPhase('lobby')}>{m.action}</Button>
        {role === 'host' && (
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Panele dön</Link>
          </Button>
        )}
      </FullScreenMessage>
    );
  }

  if (phase === 'studio' && token && choices) {
    return (
      <StudioSession
        token={token}
        serverUrl={serverUrl}
        studioCode={studioCode}
        role={role}
        title={info?.title || ''}
        broadcast={broadcast}
        choices={choices}
        onLeft={onLeft}
      />
    );
  }

  return (
    <Lobby
      title={info?.title || ''}
      hostName={info?.host_name}
      role={role}
      defaultName={defaultName}
      joining={joining}
      error={joinError}
      onJoin={join}
    />
  );
}
