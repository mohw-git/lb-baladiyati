'use client';

import { useState, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useTranslate } from '@/lib/i18n';
import { toast } from 'sonner';
import { Upload, X, ZoomIn, ZoomOut, Check, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileUrl } from '@/lib/api/client';

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export interface ImageUploadCropperProps {
  /** Current image URL (relative `/uploads/...` or absolute). */
  value?: string | null;
  /** Called with the cropped Blob ready to upload. Caller is responsible for the network call. */
  onCropped: (file: File) => Promise<void> | void;
  /** Called when the user clicks the trash button (clear current image). */
  onRemove?: () => Promise<void> | void;
  /** Crop aspect ratio width/height. Defaults to 1 (square). Use 16/6 for banners. */
  aspect?: number;
  /** Render output as a circle (avatars). The actual file is square; only preview is round. */
  circular?: boolean;
  /** Suggested label, e.g. "Logo", "Banner", "Profile photo". */
  label?: string;
  /** Help text shown beneath the field. */
  hint?: string;
  /** Total size of the preview thumbnail (px). */
  previewSize?: number;
  /** Disabled state. */
  disabled?: boolean;
}

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string));
    reader.addEventListener('error', () => reject(new Error('read_failed')));
    reader.readAsDataURL(file);
  });
}

async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area,
  outputName: string,
  outputType: string,
): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image_load_failed'));
    i.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas');

  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('blob_failed'));
        const ext = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
        resolve(new File([blob], `${outputName}.${ext}`, { type: outputType }));
      },
      outputType,
      0.92,
    );
  });
}

export function ImageUploadCropper({
  value,
  onCropped,
  onRemove,
  aspect = 1,
  circular = false,
  label,
  hint,
  previewSize = 96,
  disabled,
}: ImageUploadCropperProps) {
  const t = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [outputType, setOutputType] = useState('image/jpeg');

  const onCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset to allow re-picking the same file
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error(t('upload.error.invalidType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('upload.error.tooLarge'));
      return;
    }
    try {
      const dataUrl = await readFile(file);
      setImageSrc(dataUrl);
      setOutputType(file.type === 'image/png' ? 'image/png' : 'image/jpeg');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch {
      toast.error(t('upload.error.readFailed'));
    }
  };

  const close = () => {
    setImageSrc(null);
    setCroppedAreaPixels(null);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const file = await getCroppedFile(imageSrc, croppedAreaPixels, `cropped-${Date.now()}`, outputType);
      await onCropped(file);
      close();
    } catch {
      toast.error(t('upload.error.cropFailed'));
    } finally {
      setUploading(false);
    }
  };

  const previewSrc = value ? getFileUrl(value) : null;

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-semibold text-gray-700">{label}</label>}

      <div className="flex items-center gap-3">
        {/* Preview */}
        <div
          className={cn(
            'relative shrink-0 overflow-hidden border border-gray-200 bg-gray-50',
            circular ? 'rounded-full' : 'rounded',
            aspect > 1.5 && !circular ? 'aspect-[16/6]' : '',
          )}
          style={
            circular || aspect <= 1.5
              ? { width: previewSize, height: aspect === 1 ? previewSize : Math.round(previewSize / aspect) }
              : { width: previewSize * 2, height: Math.round((previewSize * 2) / aspect) }
          }
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED.join(',')}
            className="hidden"
            onChange={handlePick}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="btn-gov-secondary text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            {value ? t('upload.replace') : t('upload.choose')}
          </button>
          {value && onRemove && (
            <button
              type="button"
              onClick={() => onRemove()}
              disabled={disabled || uploading}
              className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('upload.remove')}
            </button>
          )}
        </div>
      </div>

      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}

      {/* Crop modal */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="flex h-full w-full max-w-2xl flex-col rounded border border-gray-300 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">{t('upload.cropTitle')}</p>
              <button
                type="button"
                onClick={close}
                disabled={uploading}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cropper area */}
            <div className="relative h-72 w-full bg-gray-900 sm:h-96">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape={circular ? 'round' : 'rect'}
                showGrid={!circular}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <ZoomOut className="h-4 w-4 text-gray-500" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-brand-600"
              />
              <ZoomIn className="h-4 w-4 text-gray-500" />
              <span className="w-10 text-right text-xs font-medium text-gray-600">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3">
              <button
                type="button"
                onClick={close}
                disabled={uploading}
                className="btn-gov-secondary text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={uploading || !croppedAreaPixels}
                className="btn-gov-primary text-xs"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {t('upload.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
