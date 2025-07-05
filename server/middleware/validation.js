import Joi from 'joi';
import sanitizeHtml from 'sanitize-html';
import logger from '../utils/logger.js';

const documentValidationSchema = Joi.object({
  documentType: Joi.string().valid('aadhaar_card', 'pan_card', 'invoice', 'id_card', 'passport').optional(),
  strictMode: Joi.boolean().optional(),
  enableHighlighting: Joi.boolean().optional()
});

export const validateRequest = (req, res, next) => {
  try {
    // Validate file presence
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        code: 'MISSING_FILE'
      });
    }

    // Validate file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ 
        error: 'File size exceeds 10MB limit',
        code: 'FILE_TOO_LARGE',
        maxSize: '10MB'
      });
    }

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only JPEG, PNG, WebP, and HEIC are allowed.',
        code: 'INVALID_FILE_TYPE',
        allowedTypes
      });
    }

    // Validate file extension matches MIME type
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    const mimeTypeMap = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'image/heic': ['heic', 'heif']
    };

    const allowedExtensions = mimeTypeMap[req.file.mimetype] || [];
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: 'File extension does not match MIME type',
        code: 'EXTENSION_MISMATCH'
      });
    }

    // Validate request body
    const { error, value } = documentValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    // Sanitize validated data
    req.validatedData = {
      documentType: value.documentType,
      strictMode: value.strictMode || false,
      enableHighlighting: value.enableHighlighting !== false
    };

    logger.info(`File validation passed: ${req.file.originalname}`);
    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    res.status(500).json({
      error: 'Internal validation error',
      code: 'VALIDATION_INTERNAL_ERROR'
    });
  }
};

export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard'
    }).trim();
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

export const validateImageDimensions = async (imagePath) => {
  try {
    const sharp = await import('sharp');
    const metadata = await sharp.default(imagePath).metadata();
    
    // Minimum dimensions for reliable OCR
    const minWidth = 200;
    const minHeight = 200;
    
    if (metadata.width < minWidth || metadata.height < minHeight) {
      throw new Error(`Image dimensions too small. Minimum: ${minWidth}x${minHeight}px`);
    }
    
    // Maximum dimensions to prevent memory issues
    const maxWidth = 4000;
    const maxHeight = 4000;
    
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      throw new Error(`Image dimensions too large. Maximum: ${maxWidth}x${maxHeight}px`);
    }
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      valid: true
    };
  } catch (error) {
    logger.error('Image dimension validation failed:', error);
    throw error;
  }
};

export const validateFileIntegrity = async (filePath) => {
  try {
    const fs = await import('fs/promises');
    const crypto = await import('crypto');
    
    // Check if file exists and is readable
    await fs.access(filePath, fs.constants.R_OK);
    
    // Calculate file hash for integrity
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    // Basic file header validation
    const fileSignatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46]
    };
    
    return {
      hash,
      size: fileBuffer.length,
      valid: true
    };
  } catch (error) {
    logger.error('File integrity validation failed:', error);
    throw error;
  }
};