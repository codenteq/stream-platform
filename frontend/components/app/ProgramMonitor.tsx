'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Web kamerası karesini andıran sade silüet */
function CameraFeed({ tone, name, className }: { tone: 'warm' | 'cool'; name: string; className?: string }) {
  const room = tone === 'warm' ? ['#8a6a55', '#3b2d27'] : ['#4f6a8c', '#1d2a3d'];
  const person = tone === 'warm' ? '#241a16' : '#131c2a';
  return (
    <div className={cn('relative overflow-hidden rounded-[6px]', className)} style={{ background: `linear-gradient(160deg, ${room[0]}, ${room[1]})` }}>
      {/* pencere ışığı */}
      <div className="absolute right-[12%] top-[10%] h-[38%] w-[22%] rounded-sm bg-white/10" />
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="80" cy="42" r="15" fill={person} />
        <path d="M44 92c2-20 17-31 36-31s34 11 36 31z" fill={person} />
      </svg>
      <span className="font-display absolute bottom-[8%] left-[5%] rounded-[3px] bg-primary px-[0.55em] py-[0.25em] text-[clamp(8px,1.1vw,12px)] font-bold text-white">
        {name}
      </span>
    </div>
  );
}

function useTimecode(startSeconds: number) {
  const [s, setS] = useState(startSeconds);
  useEffect(() => {
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * Tanıtım sayfasının kahramanı: yayındaki bir stüdyonun program monitörü.
 * Tek bir açılış anı: tally ışığı yanar, alt bant kayarak gelir, zaman kodu akar.
 */
export function ProgramMonitor({ className }: { className?: string }) {
  const timecode = useTimecode(12 * 60 + 48);

  return (
    <div className={cn('rounded-[14px] bg-bezel p-2 shadow-[0_30px_80px_-20px_rgba(16,26,44,0.55)] ring-1 ring-black/5', className)}>
      <div className="flex items-center justify-between px-2 pb-2 pt-1 text-[11px] text-white/60">
        <span className="flex items-center gap-2">
          <span className="monitor-tally flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 font-bold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            CANLI
          </span>
          <span className="tabular text-white/80">{timecode}</span>
        </span>
        <span className="tabular">1080p30</span>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-[8px]" style={{ background: 'linear-gradient(135deg, #1b2c4f, #0b1321)' }}>
        <div className="absolute inset-[4%] grid grid-cols-2 gap-[2%] pb-[12%]">
          <CameraFeed tone="warm" name="Ayşe Demir" />
          <CameraFeed tone="cool" name="Mehmet Kaya" />
        </div>
        {/* Alt bant */}
        <div className="monitor-lower-third absolute bottom-[6%] left-[4%] flex flex-col items-start">
          <span className="font-display bg-white px-[0.8em] py-[0.3em] text-[clamp(10px,1.6vw,17px)] font-extrabold text-foreground">
            Haftalık ürün yayını
          </span>
          <span className="bg-primary px-[0.8em] py-[0.2em] text-[clamp(8px,1.1vw,12px)] font-semibold text-white">12. bölüm, canlı soru-cevap</span>
        </div>
        {/* Logo */}
        <span className="absolute right-[3%] top-[5%] flex h-[9%] items-center gap-1 rounded-[4px] bg-white/90 px-[0.6em] text-[clamp(7px,0.9vw,10px)] font-bold text-foreground">
          ACME
        </span>
      </div>
      <style>{`
        .monitor-tally { background: rgba(255,255,255,0.12); animation: tally-on 0.4s ease-out 0.5s forwards; }
        @keyframes tally-on { to { background: hsl(var(--live)); box-shadow: 0 0 14px hsl(var(--live) / 0.7); } }
        .monitor-lower-third { transform: translateX(-120%); animation: lower-third-in 0.6s cubic-bezier(.2,.8,.2,1) 1.1s forwards; }
        @keyframes lower-third-in { to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) {
          .monitor-tally { background: hsl(var(--live)); animation: none; }
          .monitor-lower-third { transform: none; animation: none; }
        }
      `}</style>
    </div>
  );
}
