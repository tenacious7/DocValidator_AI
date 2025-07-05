import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIProcessor } from '../ai/processor.js';
import { EnhancedOCRService } from '../ai/enhanced-ocr.js';
import { NERService } from '../ai/ner.js';
import { EnhancedForgeryDetector } from '../ai/enhanced-forgery.js';
import { EnhancedValidationService } from '../ai/enhanced-validation.js';
import logger from '../utils/logger.js';
import { validateRequest, validateImageDimensions, validateFileIntegrity } from '../middleware/validation.js';
import { documentProcessingRateLimiter, failedRequestRateLimiter } from '../middleware/rateLimiter.js';
import { fileUploadSecurity } from '../middleware/security.js';
import { cacheManager } from '../utils/cache.js';
import { imageProcessor } from '../utils/imageProcessor.js';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for secure file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `doc-${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
    fields: 10
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${config.upload.allowedMimeTypes.join(', ')}`), false);
    }
  }
});

// Initialize AI services with error handling
let aiServices = null;
let initializationPromise = null;

const initializeAIServices = async () => {
  if (aiServices) return aiServices;
  
  if (initializationPromise) return initializationPromise;
  
  initializationPromise = (async () => {
    try {
      logger.info('Initializing AI services...');
      
      const ocrService = new EnhancedOCRService();
      await ocrService.initialize();
      
      const nerService = new NERService();
      const forgeryDetector = new EnhancedForgeryDetector();
      const validationService = new EnhancedValidationService();
      
      const aiProcessor = new AIProcessor(ocrService, nerService, forgeryDetector, validationService);
      
      aiServices = {
        ocrService,
        nerService,
        forgeryDetector,
        validationService,
        aiProcessor
      };
      
      logger.info('AI services initialized successfully');
      return aiServices;
    } catch (error) {
      logger.error('Failed to initialize AI services:', error);
      initializationPromise = null;
      throw error;
    }
  })();
  
  return initializationPromise;
};

// Document validation endpoint
router.post('/validate-document',
  documentProcessingRateLimiter,
  fileUploadSecurity,
  upload.single('document'),
  validateRequest,
  async (req, res) => {
    const startTime = Date.now();
    let tempFiles = [];
    
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No document uploaded',
          code: 'MISSING_FILE'
        });
      }

      logger.info(`Processing document: ${req.file.originalname} (${req.file.size} bytes)`);

      // Validate file integrity and dimensions
      const [fileIntegrity, imageDimensions] = await Promise.all([
        validateFileIntegrity(req.file.path),
        validateImageDimensions(req.file.path)
      ]);

      // Calculate image hash for caching
      const imageHash = await imageProcessor.calculateImageHash(req.file.path);
      
      // Check cache first
      const cacheKey = cacheManager.generateKey('document', imageHash, req.validatedData);
      let cachedResult = await cacheManager.get(cacheKey);
      
      if (cachedResult) {
        logger.info(`Cache hit for document: ${imageHash}`);
        return res.json({
          ...cachedResult,
          cached: true,
          processingTime: Date.now() - startTime
        });
      }

      // Initialize AI services
      const services = await initializeAIServices();

      // Process document with AI
      const result = await services.aiProcessor.processDocument(
        req.file.path, 
        req.file.originalname,
        req.validatedData
      );

      const processingTime = Date.now() - startTime;

      // Add processing metadata
      const enhancedResult = {
        ...result,
        metadata: {
          processingTime,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          dimensions: imageDimensions,
          integrity: fileIntegrity,
          apiVersion: '2.0.0',
          cached: false
        }
      };

      // Cache the result
      await cacheManager.set(cacheKey, enhancedResult, 3600); // 1 hour

      logger.info(`Document processed successfully in ${processingTime}ms`);
      res.json(enhancedResult);

    } catch (error) {
      logger.error('Document validation error:', error);

      // Determine error type and status code
      let statusCode = 500;
      let errorCode = 'PROCESSING_ERROR';

      if (error.message.includes('dimensions')) {
        statusCode = 400;
        errorCode = 'INVALID_DIMENSIONS';
      } else if (error.message.includes('integrity')) {
        statusCode = 400;
        errorCode = 'FILE_INTEGRITY_ERROR';
      } else if (error.message.includes('timeout')) {
        statusCode = 408;
        errorCode = 'PROCESSING_TIMEOUT';
      }

      res.status(statusCode).json({
        error: 'Failed to process document',
        code: errorCode,
        message: error.message,
        processingTime: Date.now() - startTime
      });
    } finally {
      // Cleanup temporary files
      for (const tempFile of tempFiles) {
        await imageProcessor.cleanupFile(tempFile).catch(() => {});
      }
      
      // Cleanup uploaded file after processing
      if (req.file) {
        setTimeout(() => {
          imageProcessor.cleanupFile(req.file.path).catch(() => {});
        }, 5000); // 5 second delay to ensure processing is complete
      }
    }
  }
);

// Batch document validation endpoint
router.post('/validate-documents',
  documentProcessingRateLimiter,
  fileUploadSecurity,
  upload.array('documents', 5), // Max 5 documents
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'No documents uploaded',
          code: 'MISSING_FILES'
        });
      }

      logger.info(`Processing ${req.files.length} documents in batch`);

      const services = await initializeAIServices();
      const results = [];

      // Process documents in parallel (with concurrency limit)
      const concurrencyLimit = 3;
      const chunks = [];
      
      for (let i = 0; i < req.files.length; i += concurrencyLimit) {
        chunks.push(req.files.slice(i, i + concurrencyLimit));
      }

      for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
          chunk.map(async (file) => {
            try {
              return await services.aiProcessor.processDocument(file.path, file.originalname);
            } catch (error) {
              return {
                error: error.message,
                filename: file.originalname
              };
            }
          })
        );
        
        results.push(...chunkResults.map(result => 
          result.status === 'fulfilled' ? result.value : result.reason
        ));
      }

      const processingTime = Date.now() - startTime;

      res.json({
        results,
        summary: {
          total: req.files.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length,
          processingTime
        }
      });

    } catch (error) {
      logger.error('Batch validation error:', error);
      res.status(500).json({
        error: 'Failed to process documents',
        code: 'BATCH_PROCESSING_ERROR',
        message: error.message
      });
    }
  }
);

// Health check endpoint with service status
router.get('/health', async (req, res) => {
  try {
    const services = await initializeAIServices();
    const cacheStats = cacheManager.getStats();
    
    res.json({
      status: 'OK',
      message: 'AI Document Validator API is running',
      timestamp: new Date().toISOString(),
      services: {
        ocr: services.ocrService.isInitialized,
        ner: true,
        forgeryDetection: true,
        validation: true,
        cache: true
      },
      cache: {
        keys: cacheStats.keys,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0
      },
      version: '2.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      message: 'Service unavailable',
      error: error.message
    });
  }
});

// Get processing statistics
router.get('/stats', async (req, res) => {
  try {
    const cacheStats = cacheManager.getStats();
    
    res.json({
      cache: cacheStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Stats endpoint error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      code: 'STATS_ERROR'
    });
  }
});

// Clear cache endpoint (admin only)
router.delete('/cache', async (req, res) => {
  try {
    await cacheManager.flush();
    logger.info('Cache cleared manually');
    
    res.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      code: 'CACHE_CLEAR_ERROR'
    });
  }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: config.upload.maxFileSize
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES'
      });
    }
  }
  
  logger.error('Router error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

export default router;