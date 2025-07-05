import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import config from '../config/config.js';
import logger from '../utils/logger.js';

export class EnhancedOCRService {
  constructor() {
    this.workers = new Map();
    this.isInitialized = false;
    logger.info('Enhanced OCR Service initializing...');
  }

  async initialize() {
    try {
      // Pre-process and optimize Tesseract worker
      const worker = await Tesseract.createWorker({
        logger: m => logger.debug(`Tesseract: ${m.status} - ${m.progress}`)
      });

      await worker.loadLanguage(config.ai.ocr.language);
      await worker.initialize(config.ai.ocr.language);
      
      // Configure Tesseract parameters for better accuracy
      await worker.setParameters({
        tessedit_ocr_engine_mode: config.ai.ocr.oem,
        tessedit_pageseg_mode: config.ai.ocr.psm,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:-/()[]',
        preserve_interword_spaces: '1'
      });

      this.workers.set('primary', worker);
      this.isInitialized = true;
      logger.info('Enhanced OCR Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OCR Service:', error);
      throw new Error('OCR Service initialization failed');
    }
  }

  async preprocessImage(imagePath) {
    try {
      const outputPath = imagePath.replace(/\.(jpg|jpeg|png|webp)$/i, '_processed.png');
      
      // Advanced image preprocessing for better OCR accuracy
      await sharp(imagePath)
        .resize(null, 1200, { 
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3 
        })
        .normalize() // Normalize contrast
        .sharpen({ sigma: 1, flat: 1, jagged: 2 }) // Sharpen text
        .threshold(128) // Convert to binary for better text recognition
        .png({ quality: 100, compressionLevel: 0 })
        .toFile(outputPath);

      logger.info(`Image preprocessed: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Image preprocessing failed:', error);
      throw new Error('Failed to preprocess image for OCR');
    }
  }

  async extractText(imagePath) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info(`Starting OCR extraction for: ${imagePath}`);
      
      // Preprocess image for better OCR accuracy
      const processedImagePath = await this.preprocessImage(imagePath);
      
      const worker = this.workers.get('primary');
      const { data } = await worker.recognize(processedImagePath);
      
      // Clean up processed image
      await fs.unlink(processedImagePath).catch(() => {});
      
      // Post-process extracted text
      const cleanedText = this.postProcessText(data.text);
      
      logger.info(`OCR extraction completed. Confidence: ${data.confidence}%`);
      
      return {
        text: cleanedText,
        confidence: data.confidence / 100,
        words: data.words.map(word => ({
          text: word.text,
          confidence: word.confidence / 100,
          bbox: word.bbox
        })),
        lines: data.lines.map(line => ({
          text: line.text,
          confidence: line.confidence / 100,
          bbox: line.bbox
        })),
        blocks: data.blocks.map(block => ({
          text: block.text,
          confidence: block.confidence / 100,
          bbox: block.bbox
        }))
      };
    } catch (error) {
      logger.error('OCR extraction failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  postProcessText(rawText) {
    // Clean and normalize extracted text
    let cleanedText = rawText
      .replace(/[^\w\s\-.,:/()[\]]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Fix common OCR errors for Indian documents
    const corrections = {
      'Govemment': 'Government',
      'lndia': 'India',
      'Aadhar': 'Aadhaar',
      'Adhaar': 'Aadhaar',
      'Permanent Account Number': 'Permanent Account Number',
      'Date of Birth': 'Date of Birth',
      'DOB': 'DOB',
      'Father\'s Name': 'Father\'s Name',
      'Address': 'Address'
    };

    Object.entries(corrections).forEach(([wrong, correct]) => {
      cleanedText = cleanedText.replace(new RegExp(wrong, 'gi'), correct);
    });

    return cleanedText;
  }

  async extractTextWithPython(imagePath) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(config.python.scriptPath, 'advanced_ocr.py');
      const process = spawn('python3', [pythonScript, imagePath]);
      
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (parseError) {
            reject(new Error('Failed to parse Python OCR output'));
          }
        } else {
          reject(new Error(`Python OCR failed: ${error}`));
        }
      });

      // Set timeout
      setTimeout(() => {
        process.kill();
        reject(new Error('Python OCR timeout'));
      }, config.python.timeout);
    });
  }

  async detectMissingFields(imagePath, expectedFields) {
    try {
      const ocrResult = await this.extractText(imagePath);
      const missingFields = [];
      const fieldPositions = new Map();

      // Analyze each expected field
      for (const field of expectedFields) {
        const fieldFound = this.findFieldInText(ocrResult, field);
        
        if (!fieldFound.found) {
          missingFields.push({
            field: field.name,
            type: field.type,
            required: field.required,
            suggestions: this.generateFieldSuggestions(field, ocrResult.text)
          });
        } else {
          fieldPositions.set(field.name, fieldFound.position);
        }
      }

      return {
        missingFields,
        fieldPositions: Object.fromEntries(fieldPositions),
        ocrResult
      };
    } catch (error) {
      logger.error('Missing field detection failed:', error);
      throw new Error('Failed to detect missing fields');
    }
  }

  findFieldInText(ocrResult, field) {
    const patterns = field.patterns || [field.name];
    
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      const match = ocrResult.text.match(regex);
      
      if (match) {
        // Find the position in the original image
        const position = this.findTextPosition(ocrResult.words, match[0]);
        return {
          found: true,
          value: match[0],
          position
        };
      }
    }

    return { found: false };
  }

  findTextPosition(words, searchText) {
    for (const word of words) {
      if (word.text.toLowerCase().includes(searchText.toLowerCase())) {
        return word.bbox;
      }
    }
    return null;
  }

  generateFieldSuggestions(field, text) {
    // Generate suggestions for missing fields based on context
    const suggestions = [];
    
    if (field.type === 'name' && !text.includes('Name')) {
      suggestions.push('Add "Name:" label before the person\'s name');
    }
    
    if (field.type === 'date' && !text.includes('Date')) {
      suggestions.push('Ensure date format is DD/MM/YYYY or DD-MM-YYYY');
    }
    
    if (field.type === 'number' && field.name.includes('Aadhaar')) {
      suggestions.push('Aadhaar number should be in format: XXXX XXXX XXXX');
    }

    return suggestions;
  }

  async cleanup() {
    try {
      for (const [name, worker] of this.workers) {
        await worker.terminate();
        logger.info(`OCR worker ${name} terminated`);
      }
      this.workers.clear();
      this.isInitialized = false;
    } catch (error) {
      logger.error('OCR cleanup failed:', error);
    }
  }
}