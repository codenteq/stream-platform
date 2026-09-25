export type LayoutId = 'solo' | 'thin' | 'group' | 'leader' | 'screen' | 'pip' | 'cinema';

export const LAYOUTS: { id: LayoutId; label: string }[] = [
  { id: 'solo', label: 'Solo' },
  { id: 'thin', label: 'İnce' },
  { id: 'group', label: 'Grup' },
  { id: 'leader', label: 'Lider' },
  { id: 'screen', label: 'Ekran + kenar' },
  { id: 'pip', label: 'Resim içinde resim' },
  { id: 'cinema', label: 'Sinema' },
];

export type StageSource = 'camera' | 'screen';

export interface StageItem {
  identity: string;
  source: StageSource;
}

export const stageKey = (item: StageItem) => `${item.identity}:${item.source}`;

export type BrandTheme = 'default' | 'bubble' | 'minimal' | 'block' | 'bold';

export const THEMES: { id: BrandTheme; label: string }[] = [
  { id: 'default', label: 'Varsayılan' },
  { id: 'bubble', label: 'Kabarcık' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'block', label: 'Blok' },
  { id: 'bold', label: 'Kalın' },
];

export const BRAND_COLORS = ['#0e63a6', '#0f172a', '#e11d48', '#ea580c', '#f59e0b', '#16a34a', '#0891b2', '#7c3aed', '#db2777', '#ffffff'];

export interface Banner {
  id: string;
  text: string;
  ticker: boolean;
}

export interface BrandConfig {
  color: string;
  theme: BrandTheme;
  showNames: boolean;
  logoUrl: string;
  showLogo: boolean;
  overlayUrl: string;
  showOverlay: boolean;
  backgroundUrl: string;
}

export const DEFAULT_BRAND: BrandConfig = {
  color: '#0e63a6',
  theme: 'default',
  showNames: true,
  logoUrl: '',
  showLogo: false,
  overlayUrl: '',
  showOverlay: false,
  backgroundUrl: '',
};

/** Yapımcının misafirlere yayınladığı sahne durumu */
export interface SceneMessage {
  type: 'scene';
  stage: StageItem[];
  layout: LayoutId;
  isLive: boolean;
}

export interface ChatMessage {
  id: string;
  identity: string;
  name: string;
  text: string;
  ts: number;
}

export type QualityId = '1080p' | '720p' | '480p';

export const QUALITY_SIZES: Record<QualityId, { width: number; height: number }> = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
};

export const BITRATE_OPTIONS: Record<QualityId, { value: number; label: string }[]> = {
  '1080p': [
    { value: 4500, label: 'Düşük (4.5 Mbps)' },
    { value: 8000, label: 'Orta (8 Mbps)' },
    { value: 10000, label: 'Yüksek (10 Mbps)' },
    { value: 15000, label: 'Çok yüksek (15 Mbps)' },
  ],
  '720p': [
    { value: 2500, label: 'Düşük (2.5 Mbps)' },
    { value: 4500, label: 'Orta (4.5 Mbps)' },
    { value: 6000, label: 'Yüksek (6 Mbps)' },
    { value: 8000, label: 'Çok yüksek (8 Mbps)' },
  ],
  '480p': [
    { value: 1500, label: 'Düşük (1.5 Mbps)' },
    { value: 2500, label: 'Orta (2.5 Mbps)' },
    { value: 3000, label: 'Yüksek (3 Mbps)' },
    { value: 4500, label: 'Çok yüksek (4.5 Mbps)' },
  ],
};

export const DEFAULT_BITRATE: Record<QualityId, number> = { '1080p': 10000, '720p': 6000, '480p': 3000 };

export interface StreamSettings {
  quality: QualityId;
  fps: number;
  videoBitrate: number;
  /** Sesin geciktirilme süresi (ms). null: kare hızına göre otomatik */
  audioDelayMs: number | null;
}

/** 60 FPS'te bit hızı %50 artırılır; yayın, egress ve gösterge aynı değeri kullanır. */
export const effectiveBitrate = (s: StreamSettings) => (s.fps === 60 ? Math.round(s.videoBitrate * 1.5) : s.videoBitrate);

/**
 * Kompozit görüntü canvas'tan geçerken yaklaşık iki kare gecikir (çizim + yakalama/kodlama).
 * Ses bu kadar geciktirilmezse yayında görüntünün önünde gider.
 */
export const autoAudioDelayMs = (fps: number) => Math.round((1000 / fps) * 2);
export const audioDelayFor = (s: StreamSettings) => s.audioDelayMs ?? autoAudioDelayMs(s.fps);
