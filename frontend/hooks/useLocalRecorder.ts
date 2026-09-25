import { useCallback, useEffect, useRef, useState } from 'react';

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

interface RecordingSink {
  write: (chunk: Blob) => Promise<void>;
  finish: () => Promise<Blob>;
  cleanup: () => void;
}

/**
 * Kayıt parçalarını mümkünse tarayıcının özel dosya sistemine (OPFS) yazar;
 * saatlerce süren bir kayıt belleği doldurmaz. Desteklenmiyorsa bellekte tutar.
 */
async function openSink(): Promise<RecordingSink> {
  try {
    const root = await navigator.storage?.getDirectory?.();
    if (root) {
      const name = `kayit-${Date.now()}.tmp`;
      const handle = await root.getFileHandle(name, { create: true });
      if ('createWritable' in handle) {
        const writable = await (handle as FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
        return {
          write: (chunk) => writable.write(chunk),
          finish: async () => {
            await writable.close();
            return handle.getFile();
          },
          cleanup: () => {
            root.removeEntry(name).catch(() => undefined);
          },
        };
      }
      root.removeEntry(name).catch(() => undefined);
    }
  } catch {
    /* OPFS yok ya da izin verilmedi: belleğe düş */
  }
  const chunks: Blob[] = [];
  return {
    write: async (chunk) => {
      chunks.push(chunk);
    },
    finish: async () => new Blob(chunks),
    cleanup: () => {
      chunks.length = 0;
    },
  };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return url;
}

/** Stüdyo çıktısını (canvas + karışık ses) tarayıcıda kaydeder ve bitince indirir. */
export function useLocalRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const start = useCallback(async (canvas: HTMLCanvasElement, audio: MediaStream | null, fps: number, fileBase: string) => {
    if (recorderRef.current || startingRef.current) return;
    startingRef.current = true;
    const mime = pickMime();
    const sink = await openSink();
    const stream = canvas.captureStream(fps);
    audio?.getAudioTracks().forEach((t) => stream.addTrack(t.clone()));
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    });
    // Parçalar sırayla yazılsın
    let queue: Promise<void> = Promise.resolve();
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) queue = queue.then(() => sink.write(e.data)).catch((err) => console.error('Kayıt parçası yazılamadı', err));
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (streamRef.current === stream) streamRef.current = null;
      await queue;
      const type = recorder.mimeType || mime || 'video/webm';
      const data = await sink.finish();
      const blob = data.type === type ? data : new Blob([data], { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const url = download(blob, `${toFileSlug(fileBase) || 'kayit'}-${stamp}.${ext}`);
      setTimeout(() => {
        URL.revokeObjectURL(url);
        sink.cleanup();
      }, 60_000);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    startingRef.current = false;
    setStartedAt(Date.now());
  }, []);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (!r) return;
    recorderRef.current = null;
    if (r.state !== 'inactive') r.stop();
    setStartedAt(null);
  }, []);

  // Stüdyo kapanırsa (çıkış, bağlantı kopması) kayıt yarım kalmasın: bitir ve indir
  useEffect(() => stop, [stop]);

  return { isRecording: startedAt !== null, startedAt, start, stop, supported: typeof MediaRecorder !== 'undefined' };
}
