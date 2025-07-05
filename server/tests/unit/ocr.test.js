import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedOCRService } from '../../ai/enhanced-ocr.js';
import path from 'path';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() => ({
    loadLanguage: vi.fn(),
    initialize: vi.fn(),
    setParameters: vi.fn(),
    recognize: vi.fn(() => ({
      data: {
        text: 'Government of India\nAadhaar\nName: RAJESH KUMAR\nDOB: 15/08/1985',
        confidence: 85,
        words: [
          { text: 'Government', confidence: 90, bbox: { x0: 10, y0: 10, x1: 100, y1: 30 } },
          { text: 'of', confidence: 95, bbox: { x0: 105, y0: 10, x1: 120, y1: 30 } },
          { text: 'India', confidence: 88, bbox: { x0: 125, y0: 10, x1: 160, y1: 30 } }
        ],
        lines: [
          { text: 'Government of India', confidence: 91, bbox: { x0: 10, y0: 10, x1: 160, y1: 30 } }
        ],
        blocks: [
          { text: 'Government of India\nAadhaar', confidence: 89, bbox: { x0: 10, y0: 10, x1: 160, y1: 60 } }
        ]
      }
    })),
    terminate: vi.fn()
  }))
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    sharpen: vi.fn().mockReturnThis(),
    threshold: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Enhanced OCR Service', () => {
  let ocrService;
  const testImagePath = path.join(__dirname, '../fixtures/test-aadhaar.jpg');

  beforeEach(async () => {
    ocrService = new EnhancedOCRService();
    
    // Create test fixture directory and file
    await fs.mkdir(path.dirname(testImagePath), { recursive: true });
    await fs.writeFile(testImagePath, 'fake image data');
  });

  afterEach(async () => {
    if (ocrService) {
      await ocrService.cleanup();
    }
    
    // Cleanup test files
    try {
      await fs.unlink(testImagePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await ocrService.initialize();
      expect(ocrService.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Mock initialization failure
      const mockWorker = {
        loadLanguage: vi.fn().mockRejectedValue(new Error('Language load failed')),
        initialize: vi.fn(),
        setParameters: vi.fn(),
        terminate: vi.fn()
      };
      
      vi.mocked(require('tesseract.js').createWorker).mockResolvedValue(mockWorker);
      
      await expect(ocrService.initialize()).rejects.toThrow('OCR Service initialization failed');
    });
  });

  describe('Text Extraction', () => {
    beforeEach(async () => {
      await ocrService.initialize();
    });

    it('should extract text from Aadhaar card image', async () => {
      const result = await ocrService.extractText(testImagePath);
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('words');
      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('blocks');
      
      expect(result.text).toContain('Government of India');
      expect(result.text).toContain('Aadhaar');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.words).toBeInstanceOf(Array);
      expect(result.words.length).toBeGreaterThan(0);
    });

    it('should handle non-existent files gracefully', async () => {
      const invalidPath = 'non-existent-file.jpg';
      
      await expect(ocrService.extractText(invalidPath))
        .rejects
        .toThrow('Failed to extract text from image');
    });

    it('should normalize confidence values', async () => {
      const result = await ocrService.extractText(testImagePath);
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      
      result.words.forEach(word => {
        expect(word.confidence).toBeGreaterThanOrEqual(0);
        expect(word.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Text Post-processing', () => {
    it('should correct common OCR errors', () => {
      const rawText = 'Govemment of lndia\nAadhar Card\nName: RAJESH KUMAR';
      const processed = ocrService.postProcessText(rawText);
      
      expect(processed).toBe('Government of India Aadhaar Card Name: RAJESH KUMAR');
    });

    it('should normalize whitespace', () => {
      const rawText = 'Government   of\n\nIndia\t\tAadhaar';
      const processed = ocrService.postProcessText(rawText);
      
      expect(processed).toBe('Government of India Aadhaar');
    });

    it('should remove special characters', () => {
      const rawText = 'Government@#$ of India!!! Aadhaar***';
      const processed = ocrService.postProcessText(rawText);
      
      expect(processed).toBe('Government of India Aadhaar');
    });

    it('should handle empty or null input', () => {
      expect(ocrService.postProcessText('')).toBe('');
      expect(ocrService.postProcessText(null)).toBe('');
      expect(ocrService.postProcessText(undefined)).toBe('');
    });
  });

  describe('Image Preprocessing', () => {
    beforeEach(async () => {
      await ocrService.initialize();
    });

    it('should preprocess image successfully', async () => {
      const processedPath = await ocrService.preprocessImage(testImagePath);
      
      expect(processedPath).toBeDefined();
      expect(processedPath).toMatch(/_processed\.png$/);
    });

    it('should handle preprocessing errors', async () => {
      const invalidPath = 'invalid-image.txt';
      
      await expect(ocrService.preprocessImage(invalidPath))
        .rejects
        .toThrow('Failed to preprocess image for OCR');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup workers properly', async () => {
      await ocrService.initialize();
      expect(ocrService.isInitialized).toBe(true);
      
      await ocrService.cleanup();
      expect(ocrService.isInitialized).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      await ocrService.initialize();
      
      // Mock terminate to throw error
      const worker = ocrService.workers.get('primary');
      worker.terminate = vi.fn().mockRejectedValue(new Error('Terminate failed'));
      
      // Should not throw
      await expect(ocrService.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await ocrService.initialize();
    });

    it('should complete OCR within reasonable time', async () => {
      const startTime = Date.now();
      await ocrService.extractText(testImagePath);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10000); // 10 seconds max
    }, 15000);

    it('should handle multiple concurrent requests', async () => {
      const promises = Array(3).fill().map(() => 
        ocrService.extractText(testImagePath)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
      });
    });
  });
});