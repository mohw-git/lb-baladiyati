/**
 * Client-side image compression for complaint photos.
 *
 * Goal: shrink camera photos (often 5–12 MB) before they leave the
 * browser so we hit the backend's 10 MB ceiling, save bandwidth, and
 * preserve a good visual quality for triage. EXIF metadata is dropped
 * by virtue of canvas re-encoding.
 *
 * - Skips files smaller than `skipBelowBytes` (no point compressing).
 * - Caps the output to `maxLongEdge` pixels on the longest side.
 * - Re-encodes as WebP if the browser supports it, otherwise JPEG.
 *
 * Errors surface as the original file unchanged — never throw.
 */
export interface CompressOptions {
  /** Hard ceiling for the longer side of the image (px). */
  maxLongEdge?: number;
  /** Output JPEG/WebP quality 0–1. */
  quality?: number;
  /** Files smaller than this are returned untouched. */
  skipBelowBytes?: number;
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml') return file;

  const maxLongEdge = opts.maxLongEdge ?? 1920;
  const quality = opts.quality ?? 0.82;
  const skipBelowBytes = opts.skipBelowBytes ?? 600 * 1024; // 600 KB

  if (file.size < skipBelowBytes) return file;

  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('read_failed'));
      r.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image_failed'));
      i.src = dataUrl;
    });

    const { width, height } = scaleSize(img.width, img.height, maxLongEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const supportsWebp = await canvasSupportsWebp();
    const outType = supportsWebp ? 'image/webp' : 'image/jpeg';
    const ext = supportsWebp ? 'webp' : 'jpg';

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), outType, quality);
    });
    if (!blob) return file;
    if (blob.size >= file.size) return file; // No win — keep original.

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function compressImages(
  files: File[],
  opts: CompressOptions = {},
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts)));
}

function scaleSize(w: number, h: number, maxLong: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= maxLong) return { width: w, height: h };
  const r = maxLong / long;
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

let webpProbe: Promise<boolean> | null = null;
function canvasSupportsWebp(): Promise<boolean> {
  if (!webpProbe) {
    webpProbe = new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      try {
        c.toBlob(
          (b) => resolve(!!b && b.type === 'image/webp'),
          'image/webp',
          0.5,
        );
      } catch {
        resolve(false);
      }
    });
  }
  return webpProbe;
}
