// Configuration management for the AI Document Validator
export const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true
    }
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/heic',
      'application/pdf'
    ],
    uploadDir: './uploads',
    tempDir: './temp'
  },

  // AI Processing Configuration
  ai: {
    // OCR Settings
    ocr: {
      language: 'eng+hin', // English + Hindi
      oem: 1, // LSTM OCR Engine Mode
      psm: 6, // Uniform block of text
      dpi: 300,
      timeout: 30000 // 30 seconds
    },

    // Forgery Detection Settings
    forgery: {
      elaQuality: 90,
      compressionThreshold: 0.15,
      suspiciousAreaThreshold: 0.7,
      metadataCheckEnabled: true
    },

    // Document Validation Settings
    validation: {
      confidenceThreshold: 0.7,
      strictMode: false,
      enableFieldHighlighting: true
    }
  },

  // Python Integration
  python: {
    scriptPath: './python',
    timeout: 60000, // 1 minute
    maxRetries: 3
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: './logs/app.log',
    maxSize: '10m',
    maxFiles: 5
  },

  // Security Configuration
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    helmet: {
      contentSecurityPolicy: false // Disable for development
    }
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
  config.logging.level = 'warn';
  config.security.helmet.contentSecurityPolicy = true;
}

export default config;