'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, MonitorUp, Palette, Radio, Type, UserPlus, Video, Mic, Camera } from 'lucide-react';
import { Logo } from '@/components/app/Logo';
import { Button } from '@/components/ui/button';
import { PLATFORMS, PlatformAvatar } from '@/lib/platforms';

const FEATURES = [
  { Icon: Radio, title: 'Çoklu yayın', text: 'YouTube, Facebook, LinkedIn, Twitch, X ve daha fazlasına aynı anda yayın yapın.' },
  { Icon: UserPlus, title: 'Misafir davet edin', text: 'Bir link paylaşın; misafirleriniz indirme yapmadan tarayıcıdan katılsın.' },
  { Icon: Layers, title: 'Hazır düzenler', text: 'Tek tıkla solo, grup, lider, ekran paylaşımı ve daha fazlası arasında geçiş yapın.' },
  { Icon: Palette, title: 'Markalama', text: 'Logo, overlay, arka plan, renk ve temalarla yayınınızı kişiselleştirin.' },
  { Icon: Type, title: 'Banner ve kayan yazı', text: 'Alt bant başlıkları ve kayan yazılarla izleyicilerinizi bilgilendirin.' },
  { Icon: MonitorUp, title: 'Ekran paylaşımı', text: 'Sunumlarınızı ve uygulamalarınızı sesiyle birlikte sahneye taşıyın.' },
];

function StudioMock() {
  return (
    <div className="relative mx-auto w-full max-w-4xl rounded-2xl border bg-background p-3 shadow-2xl shadow-primary/10">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-24 rounded-full bg-secondary" />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-live px-2 py-1 text-[10px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" /> CANLI
          </span>
          <div className="h-6 w-20 rounded-md bg-primary" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 p-[3%]">
            <div className="grid h-full grid-cols-2 gap-[2%]">
              {['#6366f1', '#0ea5e9'].map((c, i) => (
                <div key={i} className="relative overflow-hidden rounded-lg" style={{ background: `linear-gradient(160deg, ${c}, #0f172a)` }}>
                  <div className="absolute bottom-[8%] left-[6%] rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                    {i === 0 ? 'Ayşe' : 'Mehmet'}
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-[3%] bottom-[5%] rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
              Canlı yayınımıza hoş geldiniz!
            </div>
          </div>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`h-6 w-9 rounded ${i === 2 ? 'bg-accent ring-2 ring-primary' : 'bg-secondary'}`} />
            ))}
          </div>
          <div className="flex justify-center gap-2">
            {[Mic, Camera, MonitorUp, UserPlus].map((I, i) => (
              <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <I className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-xl bg-muted p-2">
          <div className="h-2 w-12 rounded-full bg-border" />
          <div className="grid grid-cols-4 gap-1">
            {['#1d6cf0', '#e11d48', '#16a34a', '#f59e0b'].map((c) => (
              <div key={c} className="aspect-square rounded" style={{ background: c }} />
            ))}
          </div>
          <div className="h-8 rounded bg-background" />
          <div className="h-8 rounded bg-background" />
          <div className="h-8 rounded bg-background" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('token')) router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Giriş yap</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Ücretsiz başla</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-accent/60 to-background px-4 pb-16 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
            Tarayıcınızdaki <span className="text-primary">canlı yayın stüdyosu</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Profesyonel canlı yayınlar ve kayıtlar oluşturun. Misafirlerinizi davet edin, yayınınızı markalayın ve birden fazla platformda aynı anda yayına geçin.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link href="/register">Ücretsiz başlayın</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <Link href="/login">
                <Video className="mr-2 h-4 w-4" /> Stüdyoya git
              </Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2">
            {PLATFORMS.filter((p) => p.id !== 'Custom').map((p) => (
              <PlatformAvatar key={p.id} platform={p.id} size={30} />
            ))}
          </div>
        </div>
        <div className="mt-14">
          <StudioMock />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Yayın için ihtiyacınız olan her şey</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Kurulum yok, indirme yok. Birkaç tıkla profesyonel görünen yayınlar.</p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-2xl border p-6 transition hover:shadow-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-5xl rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold">İlk yayınınıza bugün başlayın</h2>
          <p className="mx-auto mt-2 max-w-lg opacity-90">Ücretsiz hesap oluşturun ve dakikalar içinde yayına geçin.</p>
          <Button size="lg" variant="secondary" className="mt-6 h-12 px-8 text-base" asChild>
            <Link href="/register">Hesap oluştur</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} Codenteq Stream</footer>
    </div>
  );
}
