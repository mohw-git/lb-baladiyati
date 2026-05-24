import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private uploadPath: string;

  constructor(private config: ConfigService) {
    this.uploadPath = this.config.get('UPLOAD_PATH', './uploads');
    this.ensureDirectory(this.uploadPath);
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.logger.log(`Created upload directory: ${dirPath}`);
    }
  }

  async saveFile(
    file: Express.Multer.File,
    folder: string = '',
  ): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuid()}${ext}`;
    const relativePath = path.join(folder, filename);
    const fullPath = path.join(this.uploadPath, relativePath);

    // Ensure subdirectory exists
    const dir = path.dirname(fullPath);
    this.ensureDirectory(dir);

    // Write file
    fs.writeFileSync(fullPath, file.buffer);
    this.logger.debug(`Saved file: ${fullPath}`);

    // Return URL path (forward slashes for URL)
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const relativePath = url.replace('/uploads/', '');
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
