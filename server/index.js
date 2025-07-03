import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIProcessor } from './ai/processor.js';
import { OCRService } from './ai/ocr.js';
import { NERService } from './ai/ner.js';
import { ForgeryDetector } from './ai/forgery.js';
import { ValidationService } from './ai/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Initialize AI services
const ocrService = new OCRService();
const nerService = new NERService();
const forgeryDetector = new ForgeryDetector();
const validationService = new ValidationService();
const aiProcessor = new AIProcessor(ocrService, nerService, forgeryDetector, validationService);

// Routes
app.post('/api/validate-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const result = await aiProcessor.processDocument(filePath, req.file.originalname);
    
    res.json(result);
  } catch (error) {
    console.error('Document validation error:', error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Document Validator API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 AI Document Validator API running on port ${PORT}`);
});