import { FaFacebookF, FaLinkedinIn, FaTwitch, FaYoutube, FaXTwitter, FaInstagram } from 'react-icons/fa6';
import { SiKick } from 'react-icons/si';
import { Radio } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

export interface PlatformInfo {
  id: string;
  label: string;
  color: string;
  Icon: ComponentType<{ className?: string }>;
  defaultRtmp: string;
  help: string;
}

export const PLATFORMS: PlatformInfo[] = [
  {
    id: 'YouTube',
    label: 'YouTube',
    color: '#FF0000',
    Icon: FaYoutube,
    defaultRtmp: 'rtmp://a.rtmp.youtube.com/live2',
    help: 'YouTube Studio → Canlı yayın → Yayın ayarları bölümündeki "Yayın anahtarı"nı kopyalayın.',
  },
  {
    id: 'Facebook',
    label: 'Facebook',
    color: '#1877F2',
    Icon: FaFacebookF,
    defaultRtmp: 'rtmps://live-api-s.facebook.com:443/rtmp',
    help: 'Facebook Live Producer → "Yayın yazılımı" seçeneğindeki yayın anahtarını kullanın.',
  },
  {
    id: 'LinkedIn',
    label: 'LinkedIn',
    color: '#0A66C2',
    Icon: FaLinkedinIn,
    defaultRtmp: '',
    help: 'LinkedIn Live etkinliğinizde "Harici yayın aracı" ile verilen sunucu URL ve anahtarını girin.',
  },
  {
    id: 'Twitch',
    label: 'Twitch',
    color: '#9146FF',
    Icon: FaTwitch,
    defaultRtmp: 'rtmp://live.twitch.tv/app',
    help: 'Twitch Yapımcı Paneli → Ayarlar → Yayın → "Birincil yayın anahtarı".',
  },
  {
    id: 'X',
    label: 'X (Twitter)',
    color: '#111111',
    Icon: FaXTwitter,
    defaultRtmp: '',
    help: 'X Media Studio → Producer → "Kaynak oluştur" ile verilen RTMP URL ve anahtarını girin.',
  },
  {
    id: 'Kick',
    label: 'Kick',
    color: '#53FC18',
    Icon: SiKick,
    defaultRtmp: '',
    help: 'Kick Yapımcı Paneli → Ayarlar → Yayın anahtarı bölümündeki Stream URL ve anahtarı kopyalayın.',
  },
  {
    id: 'Instagram',
    label: 'Instagram',
    color: '#E1306C',
    Icon: FaInstagram,
    defaultRtmp: 'rtmps://edgetee-upload-ams.xx.fbcdn.net:443/rtmp',
    help: 'Instagram web → Canlı → "Yayın yazılımı" ile verilen URL ve anahtarı girin (yalnızca dikey görüntü önerilir).',
  },
  {
    id: 'Custom',
    label: 'Özel RTMP',
    color: '#475569',
    Icon: Radio,
    defaultRtmp: 'rtmp://',
    help: 'RTMP/RTMPS destekleyen herhangi bir sunucuya yayın yapın.',
  },
];

export function getPlatform(id: string): PlatformInfo {
  return PLATFORMS.find((p) => p.id.toLowerCase() === (id || '').toLowerCase()) || PLATFORMS[PLATFORMS.length - 1];
}

/** Yuvarlak platform avatarı */
export function PlatformAvatar({
  platform,
  size = 36,
  className,
  ring,
}: {
  platform: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const p = getPlatform(platform);
  const Icon = p.Icon;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-white', ring && 'ring-2 ring-background', className)}
      style={{ width: size, height: size, backgroundColor: p.color, fontSize: size * 0.46 }}
      title={p.label}
    >
      <Icon className={p.id === 'Kick' ? 'text-black' : undefined} />
    </span>
  );
}
