import { useCallback, useRef, useState } from 'react';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const TR_MAP: Record<string, string> = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' };

/** Tarayıcılar ASCII dışı indirme adlarını yok sayabildiği için dosya adını sadeleştirir. */
function toFileSlug(text: string) {
  return text
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

/** Stüdyo çıktısını (canvas + karışık ses) tarayıcıda kaydeder ve bitince indirir. */
export function useLocalRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const start = useCallback((canvas: HTMLCanvasElement, audio: MediaStream | null, fps: number, fileBase: string) => {
    if (recorderRef.current) return;
    const mime = pickMime();
    const stream = canvas.captureStream(fps);
    audio?.getAudioTracks().forEach((t) => stream.addTrack(t.clone()));
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const safe = toFileSlug(fileBase) || 'kayit';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safe}-${stamp}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      chunksRef.current = [];
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setStartedAt(Date.now());
  }, []);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (!r) return;
    recorderRef.current = null;
    if (r.state !== 'inactive') r.stop();
    setStartedAt(null);
  }, []);

  return { isRecording: startedAt !== null, startedAt, start, stop, supported: typeof MediaRecorder !== 'undefined' };
}
