import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// Create different rate limiters for different endpoints
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 15 * 60,
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// Stricter rate limiter for document processing
export const documentProcessingRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // limit each IP to 20 document processing requests per windowMs
  message: {
    error: 'Too many document processing requests. Please wait before uploading more documents.',
    retryAfter: 10 * 60,
    code: 'PROCESSING_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Document processing rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many document processing requests. Please wait before uploading more documents.',
      retryAfter: 10 * 60,
      code: 'PROCESSING_RATE_LIMIT_EXCEEDED'
    });
  },
  // Skip rate limiting for certain conditions
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

// Very strict rate limiter for failed requests
export const failedRequestRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 failed requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    error: 'Too many failed requests. Please check your input and try again later.',
    retryAfter: 5 * 60,
    code: 'FAILED_REQUEST_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Failed request rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many failed requests. Please check your input and try again later.',
      retryAfter: 5 * 60,
      code: 'FAILED_REQUEST_RATE_LIMIT_EXCEEDED'
    });
  }
});

// Create a custom rate limiter that can be configured per route
export const createCustomRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  };

  return rateLimit({
    ...defaultOptions,
    ...options,
    handler: (req, res) => {
      logger.warn(`Custom rate limit exceeded for IP: ${req.ip}, route: ${req.path}`);
      res.status(429).json(options.message || defaultOptions.message);
    }
  });
};

// Export the main rate limiter for general use
export const rateLimiter = generalRateLimiter;