import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import app from '../../index.js';

describe('Document Validation API Integration Tests', () => {
  const testFixturesDir = path.join(__dirname, '../fixtures');
  const testImagePath = path.join(testFixturesDir, 'test-aadhaar.jpg');
  const testPanPath = path.join(testFixturesDir, 'test-pan.jpg');
  const testInvoicePath = path.join(testFixturesDir, 'test-invoice.jpg');
  const invalidFilePath = path.join(testFixturesDir, 'test.txt');

  beforeAll(async () => {
    // Create test fixtures directory
    await fs.mkdir(testFixturesDir, { recursive: true });
    
    // Create mock image files
    const mockImageData = Buffer.from('fake-jpeg-data');
    await fs.writeFile(testImagePath, mockImageData);
    await fs.writeFile(testPanPath, mockImageData);
    await fs.writeFile(testInvoicePath, mockImageData);
    await fs.writeFile(invalidFilePath, 'This is not an image file');
  });

  afterAll(async () => {
    // Cleanup test fixtures
    try {
      await fs.rm(testFixturesDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test fixtures:', error);
    }
  });

  describe('POST /api/validate-document', () => {
    it('should validate Aadhaar document successfully', async () => {
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', testImagePath)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('isValid');
      expect(response.body).toHaveProperty('fraudRisk');
      expect(response.body).toHaveProperty('extractedText');
      expect(response.body).toHaveProperty('validationResults');
      expect(response.body).toHaveProperty('forgeryAnalysis');
      expect(response.body).toHaveProperty('metadata');

      // Validate metadata structure
      expect(response.body.metadata).toHaveProperty('processingTime');
      expect(response.body.metadata).toHaveProperty('fileSize');
      expect(response.body.metadata).toHaveProperty('mimeType');
      expect(response.body.metadata).toHaveProperty('apiVersion');
      
      // Validate confidence is a number between 0 and 1
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThanOrEqual(1);
      
      // Validate fraud risk is one of expected values
      expect(['low', 'medium', 'high']).toContain(response.body.fraudRisk);
    });

    it('should handle PAN card validation', async () => {
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', testPanPath)
        .field('documentType', 'pan_card')
        .expect(200);

      expect(response.body.type).toBeDefined();
      expect(response.body.validationResults).toBeInstanceOf(Array);
    });

    it('should handle invoice validation', async () => {
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', testInvoicePath)
        .field('documentType', 'invoice')
        .expect(200);

      expect(response.body.type).toBeDefined();
      expect(response.body.validationResults).toBeInstanceOf(Array);
    });

    it('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', invalidFilePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
    });

    it('should handle missing file', async () => {
      const response = await request(app)
        .post('/api/validate-document')
        .expect(400);

      expect(response.body.error).toBe('No document uploaded');
      expect(response.body.code).toBe('MISSING_FILE');
    });

    it('should validate request parameters', async () => {
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', testImagePath)
        .field('documentType', 'invalid_type')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should handle large files appropriately', async () => {
      // Create a large mock file (this would be rejected by multer)
      const largeFilePath = path.join(testFixturesDir, 'large-file.jpg');
      const largeData = Buffer.alloc(15 * 1024 * 1024); // 15MB
      await fs.writeFile(largeFilePath, largeData);

      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', largeFilePath)
        .expect(400);

      expect(response.body.code).toBe('FILE_TOO_LARGE');

      // Cleanup
      await fs.unlink(largeFilePath);
    });

    it('should return consistent response structure', async () => {
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', testImagePath)
        .expect(200);

      // Required fields
      const requiredFields = [
        'id', 'filename', 'type', 'confidence', 'isValid', 
        'fraudRisk', 'extractedText', 'validationResults', 
        'uploadedAt', 'metadata'
      ];

      requiredFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
      });

      // Validate array fields
      expect(response.body.validationResults).toBeInstanceOf(Array);
      
      // Validate date fields
      expect(new Date(response.body.uploadedAt)).toBeInstanceOf(Date);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(5).fill().map(() =>
        request(app)
          .post('/api/validate-document')
          .attach('document', testImagePath)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
      });

      // Ensure all responses have unique IDs
      const ids = responses.map(r => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('POST /api/validate-documents (Batch)', () => {
    it('should handle batch document validation', async () => {
      const response = await request(app)
        .post('/api/validate-documents')
        .attach('documents', testImagePath)
        .attach('documents', testPanPath)
        .attach('documents', testInvoicePath)
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.results).toHaveLength(3);
      expect(response.body.summary.total).toBe(3);
    });

    it('should handle mixed success/failure in batch', async () => {
      const response = await request(app)
        .post('/api/validate-documents')
        .attach('documents', testImagePath)
        .attach('documents', invalidFilePath)
        .expect(200);

      expect(response.body.results).toHaveLength(2);
      expect(response.body.summary.successful).toBe(1);
      expect(response.body.summary.failed).toBe(1);
    });

    it('should reject too many files in batch', async () => {
      const files = Array(10).fill(testImagePath);
      let request_builder = request(app).post('/api/validate-documents');
      
      files.forEach(file => {
        request_builder = request_builder.attach('documents', file);
      });

      const response = await request_builder.expect(400);
      expect(response.body.code).toBe('TOO_MANY_FILES');
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('version');
      
      expect(response.body.status).toBe('OK');
      expect(response.body.services).toHaveProperty('ocr');
      expect(response.body.services).toHaveProperty('forgeryDetection');
      expect(response.body.services).toHaveProperty('validation');
    });
  });

  describe('GET /api/stats', () => {
    it('should return system statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('timestamp');
      
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('heapUsed');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(25).fill().map(() =>
        request(app)
          .post('/api/validate-document')
          .attach('document', testImagePath)
      );

      const responses = await Promise.allSettled(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // This test would require mocking internal services to fail
      // For now, we'll test the error response structure
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', invalidFilePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.code).toBe('string');
    });

    it('should return proper error codes for different scenarios', async () => {
      // Test missing file
      const missingFileResponse = await request(app)
        .post('/api/validate-document')
        .expect(400);
      expect(missingFileResponse.body.code).toBe('MISSING_FILE');

      // Test invalid file type
      const invalidTypeResponse = await request(app)
        .post('/api/validate-document')
        .attach('document', invalidFilePath)
        .expect(400);
      expect(invalidTypeResponse.body.code).toBe('INVALID_FILE_TYPE');
    });
  });

  describe('Performance', () => {
    it('should process documents within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/validate-document')
        .attach('document', testImagePath)
        .expect(200);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within 30 seconds
      expect(totalTime).toBeLessThan(30000);
      
      // Response should include processing time
      expect(response.body.metadata.processingTime).toBeDefined();
      expect(typeof response.body.metadata.processingTime).toBe('number');
    }, 35000);
  });
});