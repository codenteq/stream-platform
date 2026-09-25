/**
 * Yüklenen görseli canvas ile yeniden boyutlandırıp data URL'e çevirir.
 * Böylece harici bir depolama servisine gerek kalmadan yayına kaydedilebilir.
 */
export function fileToDataUrl(file: File, maxW: number, maxH: number, type: 'image/png' | 'image/jpeg' | 'image/webp', quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Lütfen bir görsel dosyası seçin'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
      const w = Math.round(img.naturalWidth * s);
      const h = Math.round(img.naturalHeight * s);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Görsel işlenemedi'));
        return;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(type, quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel okunamadı'));
    };
    img.src = url;
  });
}
