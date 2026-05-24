/** KYC accepts JPEG/PNG only (see backend). */
const KYC_MIMES = new Set(['image/jpeg', 'image/png']);

const MAX_KYC_BYTES = 10 * 1024 * 1024;

export type CompressImagesOptions = {
  maxLongEdge?: number;
  quality?: number;
};

/**
 * Compress complaint attachment images before upload.
 * Returns originals for any file that cannot be compressed.
 */
export async function compressImages(
  files: File[],
  options: CompressImagesOptions = {},
): Promise<File[]> {
  const maxLongEdge = options.maxLongEdge ?? 1920;
  const quality = options.quality ?? 0.82;
  const results: File[] = [];
  for (const file of files) {
    try {
      results.push(await compressImageFile(file, maxLongEdge, quality));
    } catch {
      results.push(file);
    }
  }
  return results;
}

async function compressImageFile(
  file: File,
  maxLongEdge: number,
  quality: number,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 2 * 1024 * 1024) return file;

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxLongEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const mime =
    file.type === 'image/png' || file.type === 'image/webp' ? 'image/jpeg' : file.type;
  const blob = await canvasToBlob(canvas, mime, quality);
  if (!blob) return file;

  const ext = mime === 'image/jpeg' ? 'jpg' : 'bin';
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
}

/**
 * Downscale large photos before upload. Returns the original file when already small enough.
 */
export async function compressImageForKyc(file: File, maxEdge = 1920): Promise<File> {
  if (!KYC_MIMES.has(file.type)) {
    throw new Error('INVALID_TYPE');
  }
  if (file.size <= MAX_KYC_BYTES && file.size < 2 * 1024 * 1024) {
    return file;
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = mime === 'image/jpeg' ? 0.85 : undefined;

  const blob = await canvasToBlob(canvas, mime, quality);
  if (!blob || blob.size > MAX_KYC_BYTES) {
    if (file.size <= MAX_KYC_BYTES) return file;
    throw new Error('TOO_LARGE');
  }

  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '') || 'kyc';
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
}

export function validateKycImageFile(file: File): string | null {
  if (!KYC_MIMES.has(file.type)) return 'INVALID_TYPE';
  if (file.size > MAX_KYC_BYTES) return 'TOO_LARGE';
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}
