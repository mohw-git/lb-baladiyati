import { BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';

const logger = new Logger('ImageProcessing');

/** Upload categories with distinct resize/compression rules. */
export enum ImageUploadCategory {
  COMPLAINT = 'complaint',
  KYC = 'kyc',
  AVATAR = 'avatar',
  NEWS_COVER = 'news_cover',
  BRANDING_LOGO = 'branding_logo',
  BRANDING_BANNER = 'branding_banner',
}

export interface ProcessedImage {
  buffer: Buffer;
  mimetype: string;
  ext: string;
}

const JPEG_MIME = 'image/jpeg';
const PNG_MIME = 'image/png';
const WEBP_MIME = 'image/webp';

/** True when the file is a raster image we may optimize (not PDF). */
export function isProcessableImageMime(mimetype: string): boolean {
  if (!mimetype?.startsWith('image/')) return false;
  if (mimetype === 'application/pdf') return false;
  return true;
}

/**
 * Map storage folder paths (passed to saveFile) to processing category.
 * Returns null for unknown folders — file is stored unchanged.
 */
export function resolveImageCategoryFromFolder(
  folder: string,
): ImageUploadCategory | null {
  const f = folder.replace(/\\/g, '/').toLowerCase().replace(/^\/+|\/+$/g, '');

  if (f === 'complaints' || f.startsWith('complaints/')) {
    return ImageUploadCategory.COMPLAINT;
  }
  if (f === 'avatars' || f.startsWith('avatars/')) {
    return ImageUploadCategory.AVATAR;
  }
  if (f === 'news' || f.startsWith('news/')) {
    return ImageUploadCategory.NEWS_COVER;
  }
  if (f.includes('platform/announcements')) {
    return ImageUploadCategory.NEWS_COVER;
  }
  if (f.includes('municipalities/logo') || f.includes('platform/logo')) {
    return ImageUploadCategory.BRANDING_LOGO;
  }
  if (
    f.includes('municipalities/banner') ||
    f.includes('platform/banner') ||
    f.includes('platform/auth-background')
  ) {
    return ImageUploadCategory.BRANDING_BANNER;
  }

  return null;
}

/**
 * Optimize image buffer for storage. Throws BadRequestException on failure.
 */
export async function processImageBuffer(
  buffer: Buffer,
  mimetype: string,
  category: ImageUploadCategory,
): Promise<ProcessedImage> {
  if (!isProcessableImageMime(mimetype)) {
    return { buffer, mimetype, ext: mimeToExt(mimetype) };
  }

  try {
    const input = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await input.metadata();

    switch (category) {
      case ImageUploadCategory.COMPLAINT:
        return await toJpegResize(input, meta, 1920, 85);
      case ImageUploadCategory.KYC:
        return await toJpegResize(input, meta, 2560, 90);
      case ImageUploadCategory.AVATAR:
        return await toJpegAvatar(input, 512, 85);
      case ImageUploadCategory.NEWS_COVER:
        return await toJpegResize(input, meta, 1920, 85);
      case ImageUploadCategory.BRANDING_LOGO:
        return await toBrandingLogo(input, meta);
      case ImageUploadCategory.BRANDING_BANNER:
        return await toJpegResize(input, meta, 1920, 85);
      default:
        return { buffer, mimetype, ext: mimeToExt(mimetype) };
    }
  } catch (err) {
    logger.warn(
      `Image processing failed (${category}, ${mimetype}): ${err instanceof Error ? err.message : err}`,
    );
    throw new BadRequestException(
      'Unable to process image. Please try a different photo.',
    );
  }
}

async function toJpegResize(
  pipeline: sharp.Sharp,
  meta: sharp.Metadata,
  maxLongEdge: number,
  quality: number,
): Promise<ProcessedImage> {
  const width = meta.width ?? maxLongEdge;
  const height = meta.height ?? maxLongEdge;
  const longEdge = Math.max(width, height);

  let resized = pipeline;
  if (longEdge > maxLongEdge) {
    resized = pipeline.resize({
      width: maxLongEdge,
      height: maxLongEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const buffer = await resized
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  return { buffer, mimetype: JPEG_MIME, ext: '.jpg' };
}

async function toJpegAvatar(
  pipeline: sharp.Sharp,
  size: number,
  quality: number,
): Promise<ProcessedImage> {
  const buffer = await pipeline
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  return { buffer, mimetype: JPEG_MIME, ext: '.jpg' };
}

/** Preserve PNG when source has alpha; otherwise JPEG for smaller size. */
async function toBrandingLogo(
  pipeline: sharp.Sharp,
  meta: sharp.Metadata,
): Promise<ProcessedImage> {
  const maxEdge = 1024;
  const width = meta.width ?? maxEdge;
  const height = meta.height ?? maxEdge;
  const longEdge = Math.max(width, height);

  let resized = pipeline;
  if (longEdge > maxEdge) {
    resized = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const hasAlpha = meta.hasAlpha === true;

  if (hasAlpha) {
    const buffer = await resized
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    return { buffer, mimetype: PNG_MIME, ext: '.png' };
  }

  const buffer = await resized
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return { buffer, mimetype: JPEG_MIME, ext: '.jpg' };
}

function mimeToExt(mimetype: string): string {
  switch (mimetype) {
    case JPEG_MIME:
      return '.jpg';
    case PNG_MIME:
      return '.png';
    case WEBP_MIME:
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.bin';
  }
}
