import { useEffect, useRef } from 'react';

/** Canvas'a çizilecek görseli yükler. CORS'a izin vermeyen URL'ler canvas'ı kirletmesin diye yüklenmez. */
export function useImage(url: string | null | undefined) {
  const ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    ref.current = null;
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) ref.current = img;
    };
    img.onerror = () => console.warn('Görsel yüklenemedi (CORS izinli olmayabilir):', url.slice(0, 80));
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return ref;
}
