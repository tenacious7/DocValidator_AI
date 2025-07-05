import NodeCache from 'node-cache';
import crypto from 'crypto';
import logger from './logger.js';

export class CacheManager {
  constructor(options = {}) {
    this.cache = new NodeCache({
      stdTTL: options.stdTTL || 3600, // 1 hour default
      checkperiod: options.checkperiod || 600, // 10 minutes
      useClones: false, // Better performance
      deleteOnExpire: true,
      maxKeys: options.maxKeys || 1000
    });

    // Set up event listeners
    this.cache.on('set', (key, value) => {
      logger.debug(`Cache SET: ${key}`);
    });

    this.cache.on('del', (key, value) => {
      logger.debug(`Cache DEL: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache EXPIRED: ${key}`);
    });

    logger.info('Cache manager initialized');
  }

  generateKey(...args) {
    const data = args.join('|');
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async get(key) {
    try {
      const value = this.cache.get(key);
      if (value !== undefined) {
        logger.debug(`Cache HIT: ${key}`);
        return value;
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl) {
    try {
      const success = this.cache.set(key, value, ttl);
      if (success) {
        logger.debug(`Cache SET success: ${key}`);
      } else {
        logger.warn(`Cache SET failed: ${key}`);
      }
      return success;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      const count = this.cache.del(key);
      logger.debug(`Cache DEL: ${key}, deleted: ${count}`);
      return count > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async has(key) {
    try {
      return this.cache.has(key);
    } catch (error) {
      logger.error('Cache has error:', error);
      return false;
    }
  }

  async keys() {
    try {
      return this.cache.keys();
    } catch (error) {
      logger.error('Cache keys error:', error);
      return [];
    }
  }

  async flush() {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  getStats() {
    return this.cache.getStats();
  }

  // Specialized cache methods for document processing
  async cacheOCRResult(imageHash, result, ttl = 7200) { // 2 hours
    const key = `ocr:${imageHash}`;
    return this.set(key, result, ttl);
  }

  async getCachedOCRResult(imageHash) {
    const key = `ocr:${imageHash}`;
    return this.get(key);
  }

  async cacheForgeryAnalysis(imageHash, result, ttl = 7200) { // 2 hours
    const key = `forgery:${imageHash}`;
    return this.set(key, result, ttl);
  }

  async getCachedForgeryAnalysis(imageHash) {
    const key = `forgery:${imageHash}`;
    return this.get(key);
  }

  async cacheValidationResult(documentHash, result, ttl = 3600) { // 1 hour
    const key = `validation:${documentHash}`;
    return this.set(key, result, ttl);
  }

  async getCachedValidationResult(documentHash) {
    const key = `validation:${documentHash}`;
    return this.get(key);
  }

  // Cache warming for frequently accessed data
  async warmCache() {
    logger.info('Starting cache warming...');
    
    // Pre-load common validation patterns
    const commonPatterns = {
      aadhaar: /\d{4}\s\d{4}\s\d{4}/,
      pan: /[A-Z]{5}[0-9]{4}[A-Z]/,
      date: /\d{1,2}\/\d{1,2}\/\d{4}/
    };

    for (const [type, pattern] of Object.entries(commonPatterns)) {
      await this.set(`pattern:${type}`, pattern, 86400); // 24 hours
    }

    logger.info('Cache warming completed');
  }
}

// Create singleton instance
export const cacheManager = new CacheManager({
  stdTTL: 3600, // 1 hour
  checkperiod: 600, // 10 minutes
  maxKeys: 1000
});

// Initialize cache warming on startup
cacheManager.warmCache().catch(error => {
  logger.error('Cache warming failed:', error);
});