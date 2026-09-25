'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/app/Logo';
import { ProgramMonitor } from '@/components/app/ProgramMonitor';
import { Button } from '@/components/ui/button';
import { PLATFORMS, PlatformAvatar } from '@/lib/platforms';

const STEPS = [
  { title: 'Hedeflerinizi bağlayın', text: 'YouTube, LinkedIn, Twitch veya kendi RTMP sunucunuz. Yayın anahtarını bir kez girersiniz.' },
  { title: 'Stüdyoya girin', text: 'Kamera ve mikrofonunuzu seçin. İndirme veya kurulum yok.' },
  { title: 'Misafir davet edin', text: 'Bir link gönderin. Misafir kuliste bekler, siz hazır olunca sahneye alırsınız.' },
  { title: 'Yayına geçin', text: 'Tek tuşla tüm hedeflerde aynı anda canlısınız.' },
];

const FEATURES = [
  { title: 'Yedi sahne düzeni', text: 'Solo, grup, lider, ekran paylaşımı, resim içinde resim ve daha fazlası arasında yayın sırasında geçiş yapın.' },
  { title: 'Kendi markanız', text: 'Renk, tema, logo, overlay ve arka plan. İsim etiketleri markanızın rengini alır.' },
  { title: 'Alt bant ve kayan yazı', text: 'Hazırladığınız başlıkları tek tıkla yayına çıkarın, işiniz bitince kaldırın.' },
  { title: 'Kulis', text: 'Yalnızca sahnedekilerin sesi yayına gider. Kulisteki misafirler hazırlanırken izleyiciler onları duymaz.' },
  { title: 'Ekran paylaşımı', text: 'Sunumunuzu sesiyle birlikte paylaşın; paylaşım otomatik olarak sahneye gelir.' },
  { title: 'Yerel kayıt', text: 'Stüdyo çıktısını tarayıcıda kaydedin, yayın bitince dosya olarak indirin.' },
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('token')) router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link href="/login">Giriş yap</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Hesap oluştur</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
        <div>
          <h1 className="font-display text-[clamp(40px,6vw,68px)] font-extrabold leading-[1.02]">
            Canlı yayın stüdyonuz, bir tarayıcı sekmesinde.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
            Misafirlerinizi davet edin, yayınınızı markalayın ve YouTube, LinkedIn, Twitch gibi platformlarda aynı anda yayına geçin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <Link href="/register">Ücretsiz hesap oluştur</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
              <Link href="/login">Stüdyoma git</Link>
            </Button>
          </div>
        </div>
        <div>
          <ProgramMonitor />
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex -space-x-1.5">
              {PLATFORMS.filter((p) => ['YouTube', 'LinkedIn', 'Twitch'].includes(p.id)).map((p) => (
                <PlatformAvatar key={p.id} platform={p.id} size={24} ring />
              ))}
            </div>
            Üç platformda aynı anda yayında
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold">İlk yayına dört adımda</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative border-t-2 border-foreground pt-5">
                <span className="font-display tabular text-sm font-bold text-primary">{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div>
          <h2 className="font-display text-3xl font-bold">Stüdyoda neler var</h2>
          <p className="mt-3 text-muted-foreground">Yayını yöneten kişi için tasarlandı: her şey tek ekranda, yayın sırasında da değiştirilebilir.</p>
        </div>
        <dl className="grid gap-x-10 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-t py-5">
              <dt className="font-semibold">{f.title}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{f.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl bg-bezel px-8 py-12 text-white md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold">Bugün yayına geçin.</h2>
            <p className="mt-2 max-w-md text-white/70">Hesap oluşturmak ücretsiz. İlk yayınınız birkaç dakika uzağınızda.</p>
          </div>
          <Button size="lg" variant="secondary" className="h-12 bg-white px-6 text-base text-foreground hover:bg-white/90" asChild>
            <Link href="/register">Ücretsiz hesap oluştur</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <Logo />
          <span>© {new Date().getFullYear()} Codenteq</span>
        </div>
      </footer>
    </div>
  );
}
