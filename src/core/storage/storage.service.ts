import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import {
  ensureUploadDir,
  resolveUploadFilePath,
  resolveUploadRoot,
  toUploadUrlPath,
  UPLOAD_URL_PREFIX,
} from './upload-path.util';
import {
  isProcessableImageMime,
  processImageBuffer,
  resolveImageCategoryFromFolder,
} from './image-processing.util';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadPath: string;

  constructor(private config: ConfigService) {
    this.uploadPath = resolveUploadRoot(
      this.config.get<string>('UPLOAD_PATH'),
    );
    ensureUploadDir(this.uploadPath);
    this.logger.log(`Upload root: ${this.uploadPath}`);
  }

  /** Absolute path to the upload root directory. */
  getUploadRoot(): string {
    return this.uploadPath;
  }

  /** Absolute path for a DB storage key (e.g. kyc/<submissionId>/file.jpg). */
  resolveDiskPath(storageKey: string): string {
    return resolveUploadFilePath(this.uploadPath, storageKey);
  }

  /** Directory for a KYC submission's files on disk. */
  getKycSubmissionDir(submissionId: string): string {
    return ensureUploadDir(this.uploadPath, path.join('kyc', submissionId));
  }

  async saveFile(
    file: Express.Multer.File,
    folder: string = '',
  ): Promise<string> {
    let buffer = file.buffer;
    let ext = path.extname(file.originalname).toLowerCase();

    if (isProcessableImageMime(file.mimetype)) {
      const category = resolveImageCategoryFromFolder(folder);
      if (category) {
        const processed = await processImageBuffer(
          file.buffer,
          file.mimetype,
          category,
        );
        buffer = processed.buffer;
        ext = processed.ext;
      }
    }

    if (!ext) {
      ext = file.mimetype === 'application/pdf' ? '.pdf' : '.bin';
    }

    const filename = `${uuid()}${ext}`;
    const relativePath = path.join(folder, filename);
    const fullPath = path.join(this.uploadPath, relativePath);

    ensureUploadDir(path.dirname(fullPath));

    fs.writeFileSync(fullPath, buffer);
    this.logger.debug(`Saved file: ${fullPath} (${buffer.length} bytes)`);

    return toUploadUrlPath(relativePath.replace(/\\/g, '/'));
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const relativePath = url.replace(`${UPLOAD_URL_PREFIX}/`, '');
      const fullPath = path.join(this.uploadPath, relativePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.debug(`Deleted file: ${fullPath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${url}`, error);
    }
  }

  getFileType(mimetype: string): 'IMAGE' | 'DOCUMENT' {
    if (mimetype.startsWith('image/')) {
      return 'IMAGE';
    }
    return 'DOCUMENT';
  }
}
