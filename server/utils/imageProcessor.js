import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import config from '../config/config.js';

export class ImageProcessor {
  constructor() {
    this.tempDir = config.upload.tempDir || './temp';
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory:', error);
    }
  }

  async calculateImageHash(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      return crypto.createHash('sha256').update(imageBuffer).digest('hex');
    } catch (error) {
      logger.error('Failed to calculate image hash:', error);
      throw error;
    }
  }

  async optimizeForOCR(inputPath, options = {}) {
    try {
      const startTime = Date.now();
      const outputPath = path.join(
        this.tempDir, 
        `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`
      );

      const {
        targetHeight = 1200,
        quality = 100,
        sharpen = { sigma: 1, flat: 1, jagged: 2 },
        normalize = true,
        threshold = null
      } = options;

      let pipeline = sharp(inputPath)
        .resize(null, targetHeight, {
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3
        });

      if (normalize) {
        pipeline = pipeline.normalize();
      }

      if (sharpen) {
        pipeline = pipeline.sharpen(sharpen);
      }

      if (threshold) {
        pipeline = pipeline.threshold(threshold);
      }

      await pipeline
        .png({ quality, compressionLevel: 0 })
        .toFile(outputPath);

      const processingTime = Date.now() - startTime;
      logger.info(`Image optimized for OCR in ${processingTime}ms: ${outputPath}`);

      return {
        path: outputPath,
        processingTime,
        cleanup: () => this.cleanupFile(outputPath)
      };
    } catch (error) {
      logger.error('OCR optimization failed:', error);
      throw new Error('Failed to optimize image for OCR');
    }
  }

  async generateThumbnail(inputPath, size = 300, quality = 80) {
    try {
      const outputPath = path.join(
        this.tempDir,
        `thumb_${Date.now()}_${size}.jpg`
      );

      await sharp(inputPath)
        .resize(size, size, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toFile(outputPath);

      logger.debug(`Thumbnail generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Thumbnail generation failed:', error);
      throw error;
    }
  }

  async getImageMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      const stats = await fs.stat(imagePath);

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasProfile: !!metadata.icc,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        fileSize: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      logger.error('Failed to get image metadata:', error);
      throw error;
    }
  }

  async preprocessForForgeryDetection(imagePath) {
    try {
      const outputPath = path.join(
        this.tempDir,
        `forgery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      );

      // Create a standardized version for forgery analysis
      await sharp(imagePath)
        .resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 90, progressive: false })
        .toFile(outputPath);

      logger.debug(`Image preprocessed for forgery detection: ${outputPath}`);
      return {
        path: outputPath,
        cleanup: () => this.cleanupFile(outputPath)
      };
    } catch (error) {
      logger.error('Forgery preprocessing failed:', error);
      throw error;
    }
  }

  async createELAImage(originalPath, quality = 90) {
    try {
      const tempPath1 = path.join(
        this.tempDir,
        `ela_temp1_${Date.now()}.jpg`
      );
      const tempPath2 = path.join(
        this.tempDir,
        `ela_temp2_${Date.now()}.jpg`
      );
      const outputPath = path.join(
        this.tempDir,
        `ela_result_${Date.now()}.jpg`
      );

      // First compression
      await sharp(originalPath)
        .jpeg({ quality })
        .toFile(tempPath1);

      // Second compression
      await sharp(tempPath1)
        .jpeg({ quality })
        .toFile(tempPath2);

      // Calculate difference using composite
      await sharp(tempPath1)
        .composite([{
          input: tempPath2,
          blend: 'difference'
        }])
        .jpeg({ quality: 100 })
        .toFile(outputPath);

      // Cleanup temp files
      await Promise.all([
        this.cleanupFile(tempPath1),
        this.cleanupFile(tempPath2)
      ]);

      logger.debug(`ELA image created: ${outputPath}`);
      return {
        path: outputPath,
        cleanup: () => this.cleanupFile(outputPath)
      };
    } catch (error) {
      logger.error('ELA image creation failed:', error);
      throw error;
    }
  }

  async enhanceContrast(imagePath, factor = 1.5) {
    try {
      const outputPath = path.join(
        this.tempDir,
        `enhanced_${Date.now()}.png`
      );

      await sharp(imagePath)
        .modulate({
          brightness: 1.0,
          saturation: 1.0,
          hue: 0
        })
        .linear(factor, -(128 * factor) + 128)
        .png()
        .toFile(outputPath);

      return {
        path: outputPath,
        cleanup: () => this.cleanupFile(outputPath)
      };
    } catch (error) {
      logger.error('Contrast enhancement failed:', error);
      throw error;
    }
  }

  async detectBlankAreas(imagePath, threshold = 240) {
    try {
      const { data, info } = await sharp(imagePath)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8Array(data);
      const blankAreas = [];
      const blockSize = 32;

      for (let y = 0; y < info.height; y += blockSize) {
        for (let x = 0; x < info.width; x += blockSize) {
          const blockPixels = [];
          
          for (let by = y; by < Math.min(y + blockSize, info.height); by++) {
            for (let bx = x; bx < Math.min(x + blockSize, info.width); bx++) {
              const pixelIndex = by * info.width + bx;
              if (pixelIndex < pixels.length) {
                blockPixels.push(pixels[pixelIndex]);
              }
            }
          }

          if (blockPixels.length > 0) {
            const avgIntensity = blockPixels.reduce((sum, p) => sum + p, 0) / blockPixels.length;
            
            if (avgIntensity > threshold) {
              blankAreas.push({
                x,
                y,
                width: Math.min(blockSize, info.width - x),
                height: Math.min(blockSize, info.height - y),
                intensity: avgIntensity,
                confidence: (avgIntensity - threshold) / (255 - threshold)
              });
            }
          }
        }
      }

      logger.debug(`Detected ${blankAreas.length} potential blank areas`);
      return blankAreas;
    } catch (error) {
      logger.error('Blank area detection failed:', error);
      throw error;
    }
  }

  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.debug(`Cleaned up file: ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }

  async cleanupOldFiles(maxAge = 3600000) { // 1 hour default
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await this.cleanupFile(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old temporary files`);
      }
    } catch (error) {
      logger.error('Failed to cleanup old files:', error);
    }
  }
}

// Create singleton instance
export const imageProcessor = new ImageProcessor();

// Schedule periodic cleanup
setInterval(() => {
  imageProcessor.cleanupOldFiles().catch(error => {
    logger.error('Scheduled cleanup failed:', error);
  });
}, 30 * 60 * 1000); // Every 30 minutes