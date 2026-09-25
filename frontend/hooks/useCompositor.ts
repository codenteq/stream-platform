import { useEffect, useRef } from 'react';
import { Track, type Participant, type Room } from 'livekit-client';
import {
  computeLayout,
  drawAvatarPlaceholder,
  drawBackground,
  drawBanner,
  drawLogo,
  drawMedia,
  drawNameTag,
  layoutCapacity,
  roundRectPath,
} from '@/lib/studio/compositor';
import { stageKey, type Banner, type BrandConfig, type LayoutId, type StageItem } from '@/lib/studio/types';
import { colorFor } from '@/components/app/UserAvatar';
import { useImage } from '@/hooks/useImage';

export interface CompositorInput {
  room: Room;
  stage: StageItem[];
  layout: LayoutId;
  brand: BrandConfig;
  banner: Banner | null;
}

function findParticipant(room: Room, identity: string): Participant | undefined {
  if (room.localParticipant.identity === identity) return room.localParticipant;
  return room.remoteParticipants.get(identity);
}

function tileRadius(brand: BrandConfig, H: number) {
  switch (brand.theme) {
    case 'bubble':
      return H * 0.035;
    case 'minimal':
      return H * 0.01;
    case 'block':
      return 0;
    case 'bold':
      return H * 0.006;
    default:
      return H * 0.016;
  }
}

/**
 * Sahneyi (katılımcılar, düzen, marka, banner) tek bir canvas'a çizer.
 * Çizim döngüsü arka plan sekmesinde de çalışsın diye Web Worker zamanlayıcısı kullanır.
 */
export function useCompositor(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  videoEls: React.MutableRefObject<Map<string, HTMLVideoElement>>,
  input: CompositorInput,
  width: number,
  height: number,
  fps: number
) {
  const inputRef = useRef(input);
  inputRef.current = input;

  const logoRef = useImage(input.brand.showLogo ? input.brand.logoUrl : '');
  const overlayRef = useImage(input.brand.showOverlay ? input.brand.overlayUrl : '');
  const bgRef = useImage(input.brand.backgroundUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const W = width;
    const H = height;

    // Arka plan (degrade ya da görsel) yalnızca marka/görsel değişince yeniden çizilir
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = W;
    bgCanvas.height = H;
    const bgCtx = bgCanvas.getContext('2d', { alpha: false });
    let bgKey = '';

    const draw = () => {
      const { room, stage, layout, brand, banner } = inputRef.current;
      const key = `${brand.color}|${bgRef.current?.src ?? ''}`;
      if (bgCtx && key !== bgKey) {
        drawBackground(bgCtx, W, H, brand, bgRef.current);
        bgKey = key;
      }
      ctx.drawImage(bgCanvas, 0, 0);

      const items = stage.slice(0, layoutCapacity(layout));
      const { boxes, fullBleedMain } = computeLayout(layout, items.length, W, H);
      const radius = tileRadius(brand, H);

      items.forEach((item, i) => {
        const box = boxes[i];
        const p = findParticipant(room, item.identity);
        if (!box || !p) return;
        const name = p.name || p.identity;
        const source = item.source === 'screen' ? Track.Source.ScreenShare : Track.Source.Camera;
        const pub = p.getTrackPublication(source);
        const video = videoEls.current.get(stageKey(item));
        const hasVideo = !!pub?.track && !pub.isMuted && !!video && video.readyState >= 2 && video.videoWidth > 0;
        const isMainFull = i === 0 && fullBleedMain;
        const r = isMainFull ? 0 : radius;

        ctx.save();
        roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
        ctx.clip();
        if (hasVideo && video) {
          if (item.source === 'screen') {
            ctx.fillStyle = '#000';
            ctx.fillRect(box.x, box.y, box.w, box.h);
            drawMedia(ctx, video, box, 'contain');
          } else {
            drawMedia(ctx, video, box, 'cover');
          }
        } else if (item.source === 'screen') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(box.x, box.y, box.w, box.h);
        } else {
          drawAvatarPlaceholder(ctx, box, name, colorFor(name));
        }
        ctx.restore();

        // Tam ekran ana görüntünün üstündeki küçük pencerelere ince çerçeve
        if (fullBleedMain && i > 0) {
          ctx.save();
          roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
          ctx.lineWidth = Math.max(2, H * 0.003);
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.stroke();
          ctx.restore();
        }

        if (brand.showNames && item.source === 'camera') drawNameTag(ctx, name, box, brand, H);
      });

      if (banner) drawBanner(ctx, banner, brand, W, H, performance.now());
      if (brand.showLogo && logoRef.current) drawLogo(ctx, logoRef.current, W, H);
      if (brand.showOverlay && overlayRef.current) ctx.drawImage(overlayRef.current, 0, 0, W, H);
    };

    const interval = 1000 / fps;
    let lastDraw = 0;
    const tick = () => {
      // Ana iş parçacığı meşgulken biriken tikler art arda çizim yapmasın (geri basınç)
      const now = performance.now();
      if (now - lastDraw < interval * 0.5) return;
      lastDraw = now;
      draw();
    };

    const worker = new Worker('/timer-worker.js');
    worker.onmessage = tick;
    worker.postMessage({ type: 'start', interval });
    draw();

    return () => {
      worker.postMessage({ type: 'stop' });
      worker.terminate();
    };
  }, [canvasRef, videoEls, width, height, fps, logoRef, overlayRef, bgRef]);
}
