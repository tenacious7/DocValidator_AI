import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3001,
  
  // Database configuration
  database: {
    cosmosDb: {
      endpoint: process.env.COSMOS_DB_ENDPOINT,
      key: process.env.COSMOS_DB_KEY,
      databaseId: process.env.COSMOS_DB_DATABASE_ID || 'docvalidation',
      containerId: process.env.COSMOS_DB_CONTAINER_ID || 'documents'
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD
    }
  },

  // Azure services
  azure: {
    storageAccount: {
      name: process.env.AZURE_STORAGE_ACCOUNT_NAME,
      key: process.env.AZURE_STORAGE_ACCOUNT_KEY,
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents'
    },
    computerVision: {
      endpoint: process.env.AZURE_COMPUTER_VISION_ENDPOINT,
      key: process.env.AZURE_COMPUTER_VISION_KEY
    },
    textAnalytics: {
      endpoint: process.env.AZURE_TEXT_ANALYTICS_ENDPOINT,
      key: process.env.AZURE_TEXT_ANALYTICS_KEY
    }
  },

  // AI services configuration
  ai: {
    pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
    ocrConfig: {
      language: 'eng+hin',
      oem: 1,
      psm: 6
    },
    mlModels: {
      documentClassifier: process.env.DOCUMENT_CLASSIFIER_MODEL_PATH || './models/document_classifier.pkl',
      fraudDetector: process.env.FRAUD_DETECTOR_MODEL_PATH || './models/fraud_detector.pkl',
      textValidator: process.env.TEXT_VALIDATOR_MODEL_PATH || './models/text_validator.pkl'
    }
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100
  },

  // CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://docvalidation.netlify.app'
    ]
  },

  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf'
    ],
    uploadPath: process.env.UPLOAD_PATH || './uploads'
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  // Performance configuration
  performance: {
    cacheEnabled: process.env.CACHE_ENABLED === 'true',
    cacheTtl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
    maxConcurrentProcessing: parseInt(process.env.MAX_CONCURRENT_PROCESSING) || 10
  }
};