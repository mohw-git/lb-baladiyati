import {
  ImageUploadCategory,
  isProcessableImageMime,
  processImageBuffer,
  resolveImageCategoryFromFolder,
} from './image-processing.util';

describe('image-processing.util', () => {
  describe('resolveImageCategoryFromFolder', () => {
    it('maps known folders', () => {
      expect(resolveImageCategoryFromFolder('complaints')).toBe(
        ImageUploadCategory.COMPLAINT,
      );
      expect(resolveImageCategoryFromFolder('avatars')).toBe(
        ImageUploadCategory.AVATAR,
      );
      expect(resolveImageCategoryFromFolder('news')).toBe(
        ImageUploadCategory.NEWS_COVER,
      );
      expect(resolveImageCategoryFromFolder('municipalities/logo')).toBe(
        ImageUploadCategory.BRANDING_LOGO,
      );
      expect(resolveImageCategoryFromFolder('platform/banner')).toBe(
        ImageUploadCategory.BRANDING_BANNER,
      );
    });

    it('returns null for unknown folders', () => {
      expect(resolveImageCategoryFromFolder('unknown')).toBeNull();
    });
  });

  describe('isProcessableImageMime', () => {
    it('accepts images and rejects pdf', () => {
      expect(isProcessableImageMime('image/jpeg')).toBe(true);
      expect(isProcessableImageMime('application/pdf')).toBe(false);
    });
  });

  describe('processImageBuffer', () => {
    /** Minimal valid 1x1 PNG */
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    it('compresses complaint images to jpeg', async () => {
      const result = await processImageBuffer(
        tinyPng,
        'image/png',
        ImageUploadCategory.COMPLAINT,
      );
      expect(result.mimetype).toBe('image/jpeg');
      expect(result.ext).toBe('.jpg');
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('compresses kyc images to jpeg', async () => {
      const result = await processImageBuffer(
        tinyPng,
        'image/png',
        ImageUploadCategory.KYC,
      );
      expect(result.mimetype).toBe('image/jpeg');
      expect(result.ext).toBe('.jpg');
    });

    it('passes through non-images unchanged', async () => {
      const pdf = Buffer.from('%PDF-1.4');
      const result = await processImageBuffer(
        pdf,
        'application/pdf',
        ImageUploadCategory.COMPLAINT,
      );
      expect(result.buffer).toBe(pdf);
      expect(result.mimetype).toBe('application/pdf');
    });
  });
});
