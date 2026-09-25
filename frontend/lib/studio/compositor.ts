import type { Banner, BrandConfig, BrandTheme, LayoutId } from './types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  boxes: Box[];
  /** Tam ekran düzenlerde (solo/pip/sinema) ana görüntünün köşeleri yuvarlatılmaz */
  fullBleedMain: boolean;
}

const RATIO = 16 / 9;

function fit(w: number, h: number): { w: number; h: number } {
  return w / h > RATIO ? { w: h * RATIO, h } : { w, h: w / RATIO };
}

function gridBoxes(n: number, x0: number, y0: number, W: number, H: number, gap: number): Box[] {
  let best = { cols: 1, rows: n, tw: 0, th: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (W - gap * (cols - 1)) / cols;
    const ch = (H - gap * (rows - 1)) / rows;
    const t = fit(cw, ch);
    if (t.w > best.tw) best = { cols, rows, tw: t.w, th: t.h };
  }
  const { cols, rows, tw, th } = best;
  const totalH = rows * th + (rows - 1) * gap;
  const boxes: Box[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols);
    const rowW = inRow * tw + (inRow - 1) * gap;
    const sx = x0 + (W - rowW) / 2;
    const sy = y0 + (H - totalH) / 2 + r * (th + gap);
    for (let c = 0; c < inRow; c++) boxes.push({ x: sx + c * (tw + gap), y: sy, w: tw, h: th });
  }
  return boxes;
}

/** Sahnedeki öğe sayısına ve düzene göre her öğenin kutusunu hesaplar. */
export function computeLayout(layout: LayoutId, n: number, W: number, H: number): LayoutResult {
  if (n === 0) return { boxes: [], fullBleedMain: false };

  const pad = W * 0.03;
  const gap = W * 0.012;
  const aw = W - pad * 2;
  const ah = H - pad * 2;

  switch (layout) {
    case 'solo':
      return { boxes: [{ x: 0, y: 0, w: W, h: H }], fullBleedMain: true };

    case 'thin': {
      // Herkes tam yükseklikte dikey şeritler halinde yan yana
      if (n === 1) {
        const m = fit(aw, ah);
        return { boxes: [{ x: pad + (aw - m.w) / 2, y: pad + (ah - m.h) / 2, w: m.w, h: m.h }], fullBleedMain: false };
      }
      const w = (aw - gap * (n - 1)) / n;
      return { boxes: Array.from({ length: n }, (_, i) => ({ x: pad + i * (w + gap), y: pad, w, h: ah })), fullBleedMain: false };
    }

    case 'leader': {
      if (n === 1) {
        const m = fit(aw, ah);
        return { boxes: [{ x: pad + (aw - m.w) / 2, y: pad + (ah - m.h) / 2, w: m.w, h: m.h }], fullBleedMain: false };
      }
      // Ana görüntü üstte büyük, diğerleri altta tek sıra
      const others = n - 1;
      const rowH = ah * 0.22;
      const mainArea = fit(aw, ah - rowH - gap);
      const thumb = fit((aw - gap * (others - 1)) / others, rowH);
      const totalH = mainArea.h + gap + thumb.h;
      const top = pad + (ah - totalH) / 2;
      const boxes: Box[] = [{ x: pad + (aw - mainArea.w) / 2, y: top, w: mainArea.w, h: mainArea.h }];
      const rowW = others * thumb.w + (others - 1) * gap;
      const sx = pad + (aw - rowW) / 2;
      for (let i = 0; i < others; i++) boxes.push({ x: sx + i * (thumb.w + gap), y: top + mainArea.h + gap, w: thumb.w, h: thumb.h });
      return { boxes, fullBleedMain: false };
    }

    case 'screen': {
      if (n === 1) {
        const m = fit(aw, ah);
        return { boxes: [{ x: pad + (aw - m.w) / 2, y: pad + (ah - m.h) / 2, w: m.w, h: m.h }], fullBleedMain: false };
      }
      // Ana görüntü solda, diğerleri sağda dikey sütun
      const others = n - 1;
      const colW = aw * 0.2;
      const main = fit(aw - colW - gap, ah);
      const thumbH = Math.min(colW / RATIO, (ah - gap * (others - 1)) / others);
      const thumbW = thumbH * RATIO;
      const blockW = main.w + gap + thumbW;
      const sx = pad + (aw - blockW) / 2;
      const boxes: Box[] = [{ x: sx, y: pad + (ah - main.h) / 2, w: main.w, h: main.h }];
      const colH = others * thumbH + (others - 1) * gap;
      const cy = pad + (ah - colH) / 2;
      for (let i = 0; i < others; i++) boxes.push({ x: sx + main.w + gap, y: cy + i * (thumbH + gap), w: thumbW, h: thumbH });
      return { boxes, fullBleedMain: false };
    }

    case 'pip': {
      const boxes: Box[] = [{ x: 0, y: 0, w: W, h: H }];
      if (n > 1) {
        const w = W * 0.24;
        const h = w / RATIO;
        boxes.push({ x: W - w - pad, y: H - h - pad, w, h });
      }
      return { boxes, fullBleedMain: true };
    }

    case 'cinema': {
      const boxes: Box[] = [{ x: 0, y: 0, w: W, h: H }];
      const others = n - 1;
      if (others > 0) {
        const w = Math.min(W * 0.16, (aw - gap * (others - 1)) / others);
        const h = w / RATIO;
        const rowW = others * w + (others - 1) * gap;
        const sx = (W - rowW) / 2;
        for (let i = 0; i < others; i++) boxes.push({ x: sx + i * (w + gap), y: H - h - pad * 0.8, w, h });
      }
      return { boxes, fullBleedMain: true };
    }

    case 'group':
    default:
      return { boxes: gridBoxes(n, pad, pad, aw, ah, gap), fullBleedMain: false };
  }
}

/** Düzenin en fazla kaç öğe gösterdiği */
export function layoutCapacity(layout: LayoutId): number {
  if (layout === 'solo') return 1;
  if (layout === 'pip') return 2;
  return 12;
}

// ---------- Çizim yardımcıları ----------

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

type Drawable = HTMLVideoElement | HTMLImageElement;

function sourceSize(src: Drawable) {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  return { w: src.naturalWidth, h: src.naturalHeight };
}

export function drawMedia(ctx: CanvasRenderingContext2D, src: Drawable, box: Box, mode: 'cover' | 'contain') {
  const { w: sw, h: sh } = sourceSize(src);
  if (!sw || !sh) return;
  const scale = mode === 'cover' ? Math.max(box.w / sw, box.h / sh) : Math.min(box.w / sw, box.h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  if (mode === 'cover') {
    // Kaynaktan kırp: yüzler çoğunlukla üst-ortada olduğundan hafif yukarı hizala
    const cw = box.w / scale;
    const ch = box.h / scale;
    const cx = (sw - cw) / 2;
    const cy = Math.max(0, (sh - ch) * 0.4);
    ctx.drawImage(src, cx, cy, cw, ch, box.x, box.y, box.w, box.h);
  } else {
    ctx.drawImage(src, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  }
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.padEnd(6, '0');
  const n = parseInt(v.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function readableTextOn(hex: string) {
  const { r, g, b } = hexToRgb(hex || '#000000');
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0f172a' : '#ffffff';
}

export function shade(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex || '#000000');
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

const FALLBACK_FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
let cachedFont: string | null = null;

/** Sayfanın Archivo ailesini (next/font'un ürettiği adla) canvas için döndürür. */
function fontFamily() {
  if (cachedFont) return cachedFont;
  if (typeof document === 'undefined') return FALLBACK_FONT;
  const family = getComputedStyle(document.body).fontFamily || FALLBACK_FONT;
  cachedFont = family;
  // Canvas yazı tipini ancak yüklendikten sonra kullanabilir
  document.fonts?.load(`700 32px ${family}`).catch(() => undefined);
  return family;
}

/** Yayın grafikleri için geniş kesim (tarayıcı destekliyorsa) */
function setStretch(ctx: CanvasRenderingContext2D, value: 'normal' | 'expanded') {
  const c = ctx as CanvasRenderingContext2D & { fontStretch?: string };
  if ('fontStretch' in c) c.fontStretch = value;
}

function tagStyle(theme: BrandTheme, color: string) {
  switch (theme) {
    case 'bubble':
      return { bg: color, fg: readableTextOn(color), radius: 999, weight: 600, upper: false, accent: false };
    case 'minimal':
      return { bg: 'rgba(15,23,42,0.62)', fg: '#ffffff', radius: 6, weight: 500, upper: false, accent: false };
    case 'block':
      return { bg: color, fg: readableTextOn(color), radius: 0, weight: 700, upper: true, accent: true };
    case 'bold':
      return { bg: color, fg: readableTextOn(color), radius: 4, weight: 800, upper: false, accent: false };
    case 'default':
    default:
      return { bg: color, fg: readableTextOn(color), radius: 6, weight: 700, upper: false, accent: false };
  }
}

interface CachedTag {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  margin: number;
}

// İsim etiketleri (gölge ve ölçüm dahil) bir kez çizilip önbellekten kopyalanır;
// her karede shadowBlur ve measureText döngüsü çalıştırmak 1080p60'ta pahalıdır.
const tagCache = new Map<string, CachedTag>();
const TAG_CACHE_LIMIT = 64;

function fontReady(family: string) {
  try {
    return document.fonts?.check(`700 20px ${family}`) ?? true;
  } catch {
    return true;
  }
}

function renderTag(name: string, brand: BrandConfig, fs: number, maxW: number, canvasH: number): CachedTag {
  const family = fontFamily();
  const key = [name, brand.theme, brand.color, Math.round(fs * 10), Math.round(maxW), canvasH, fontReady(family)].join('|');
  const hit = tagCache.get(key);
  if (hit) return hit;

  const s = tagStyle(brand.theme, brand.color);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `${s.weight} ${fs}px ${family}`;
  ctx.font = font;
  setStretch(ctx, 'expanded');
  const text = s.upper ? name.toUpperCase() : name;
  const padX = fs * 0.7;
  const padY = fs * 0.42;
  let label = text;
  while (ctx.measureText(label).width + padX * 2 > maxW && label.length > 3) label = label.slice(0, -2);
  if (label !== text) label = label.trimEnd() + '…';
  const tw = ctx.measureText(label).width;
  const accentW = s.accent ? fs * 0.3 : 0;
  const w = tw + padX * 2 + accentW;
  const h = fs + padY * 2;
  const margin = Math.ceil(fs * 0.8); // gölge payı

  canvas.width = Math.ceil(w + margin * 2);
  canvas.height = Math.ceil(h + margin * 2);
  // Boyut değişince bağlam sıfırlanır
  ctx.font = font;
  setStretch(ctx, 'expanded');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = fs * 0.4;
  roundRectPath(ctx, margin, margin, w, h, s.radius === 999 ? h / 2 : s.radius * (canvasH / 1080));
  ctx.fillStyle = s.bg;
  ctx.fill();
  ctx.restore();
  if (s.accent) {
    ctx.fillStyle = s.fg;
    ctx.fillRect(margin, margin, accentW, h);
  }
  ctx.fillStyle = s.fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, margin + accentW + padX, margin + h / 2 + fs * 0.04);

  const tag = { canvas, w, h, margin };
  tagCache.set(key, tag);
  if (tagCache.size > TAG_CACHE_LIMIT) tagCache.delete(tagCache.keys().next().value as string);
  return tag;
}

export function drawNameTag(ctx: CanvasRenderingContext2D, name: string, box: Box, brand: BrandConfig, canvasH: number) {
  const scale = brand.theme === 'bold' ? 1.2 : 1;
  const fs = Math.max(canvasH * 0.017, Math.min(canvasH * 0.03, box.h * 0.065)) * scale;
  const tag = renderTag(name, brand, fs, box.w * 0.8, canvasH);
  const inset = Math.max(canvasH * 0.012, box.h * 0.035);
  ctx.drawImage(tag.canvas, box.x + inset - tag.margin, box.y + box.h - tag.h - inset - tag.margin);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

export function drawBanner(ctx: CanvasRenderingContext2D, banner: Banner, brand: BrandConfig, W: number, H: number, now: number) {
  const s = tagStyle(brand.theme, brand.color);
  if (banner.ticker) {
    const h = H * 0.075;
    const y = H - h;
    const fs = h * 0.46;
    ctx.fillStyle = s.bg === 'rgba(15,23,42,0.62)' ? 'rgba(15,23,42,0.85)' : s.bg;
    ctx.fillRect(0, y, W, h);
    ctx.font = `${s.weight} ${fs}px ${fontFamily()}`;
    setStretch(ctx, 'expanded');
    ctx.fillStyle = s.fg;
    ctx.textBaseline = 'middle';
    const text = (s.upper ? banner.text.toUpperCase() : banner.text) + '     •     ';
    const tw = ctx.measureText(text).width;
    const speed = W * 0.09; // px/sn
    const offset = ((now / 1000) * speed) % tw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, h);
    ctx.clip();
    for (let x = -offset; x < W; x += tw) ctx.fillText(text, x, y + h / 2);
    ctx.restore();
    setStretch(ctx, 'normal');
    return;
  }

  const scale = brand.theme === 'bold' ? 1.15 : 1;
  const fs = H * 0.04 * scale;
  ctx.font = `${s.weight} ${fs}px ${fontFamily()}`;
  setStretch(ctx, 'expanded');
  const maxW = W * 0.84;
  const lines = wrapLines(ctx, s.upper ? banner.text.toUpperCase() : banner.text, maxW, 2);
  const lineH = fs * 1.25;
  const padX = fs * 0.8;
  const padY = fs * 0.55;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const accentW = s.accent ? fs * 0.35 : 0;
  const w = textW + padX * 2 + accentW;
  const h = lines.length * lineH + padY * 2;
  const x = W * 0.04;
  const y = H - h - H * 0.06;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = fs * 0.6;
  roundRectPath(ctx, x, y, w, h, s.radius === 999 ? Math.min(h / 2, fs) : s.radius * (H / 1080) * 1.3);
  ctx.fillStyle = s.bg;
  ctx.fill();
  ctx.restore();
  if (s.accent) {
    ctx.fillStyle = s.fg;
    ctx.fillRect(x, y, accentW, h);
  }
  ctx.fillStyle = s.fg;
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x + accentW + padX, y + padY + lineH * i + lineH / 2));
  setStretch(ctx, 'normal');
}

export function drawAvatarPlaceholder(ctx: CanvasRenderingContext2D, box: Box, name: string, color: string) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const r = Math.min(box.w, box.h) * 0.18;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${r * 0.8}px ${fontFamily()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials.toUpperCase(), cx, cy + r * 0.04);
  ctx.textAlign = 'left';
}

export function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, brand: BrandConfig, bg: HTMLImageElement | null) {
  if (bg) {
    drawMedia(ctx, bg, { x: 0, y: 0, w: W, h: H }, 'cover');
    return;
  }
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(brand.color, -0.55));
  g.addColorStop(1, '#0b1120');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, W: number, H: number) {
  const maxH = H * 0.11;
  const maxW = W * 0.18;
  const s = Math.min(maxH / logo.naturalHeight, maxW / logo.naturalWidth);
  const w = logo.naturalWidth * s;
  const h = logo.naturalHeight * s;
  const m = W * 0.025;
  ctx.drawImage(logo, W - w - m, m, w, h);
}
