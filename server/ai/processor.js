export class AIProcessor {
  constructor(ocrService, nerService, forgeryDetector, validationService) {
    this.ocrService = ocrService;
    this.nerService = nerService;
    this.forgeryDetector = forgeryDetector;
    this.validationService = validationService;
  }

  async processDocument(filePath, filename) {
    const startTime = Date.now();
    
    try {
      // Step 1: OCR - Extract text from image
      const extractedText = await this.ocrService.extractText(filePath);
      
      // Step 2: NER - Extract entities from text
      const entities = await this.nerService.extractEntities(extractedText);
      
      // Step 3: Document Classification
      const documentType = this.classifyDocument(extractedText, entities);
      
      // Step 4: Format Validation
      const formatValidation = this.validationService.validateFormat(entities, documentType);
      
      // Step 5: Forgery Detection
      const forgeryAnalysis = await this.forgeryDetector.analyzeImage(filePath);
      
      // Step 6: Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(
        extractedText,
        formatValidation,
        forgeryAnalysis,
        entities
      );
      
      // Step 7: Generate validation results
      const validationResults = this.generateValidationResults(
        entities,
        formatValidation,
        documentType
      );

      const processingTime = Date.now() - startTime;

      return {
        id: this.generateId(),
        filename,
        type: documentType,
        confidence: confidenceScore.overall,
        isValid: confidenceScore.overall >= 0.7 && !forgeryAnalysis.isForgery,
        fraudRisk: this.calculateFraudRisk(forgeryAnalysis, confidenceScore),
        extractedText,
        validationResults,
        entities,
        forgeryAnalysis,
        confidenceBreakdown: confidenceScore.breakdown,
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        processingTime
      };
    } catch (error) {
      console.error('AI Processing error:', error);
      throw new Error('Failed to process document with AI');
    }
  }

  classifyDocument(text, entities) {
    const textLower = text.toLowerCase();
    
    // Aadhaar Card Detection
    if (textLower.includes('aadhaar') || textLower.includes('aadhar') || 
        entities.some(e => e.type === 'AADHAAR_NUMBER')) {
      return 'aadhaar_card';
    }
    
    // PAN Card Detection
    if (textLower.includes('permanent account number') || textLower.includes('pan') ||
        entities.some(e => e.type === 'PAN_NUMBER')) {
      return 'pan_card';
    }
    
    // Invoice Detection
    if (textLower.includes('invoice') || textLower.includes('bill') || 
        textLower.includes('amount') || textLower.includes('total')) {
      return 'invoice';
    }
    
    // ID Card Detection
    if (textLower.includes('identity') || textLower.includes('id card') ||
        textLower.includes('identification')) {
      return 'id_card';
    }
    
    // Passport Detection
    if (textLower.includes('passport') || textLower.includes('republic of india')) {
      return 'passport';
    }
    
    return 'unknown';
  }

  calculateConfidenceScore(text, formatValidation, forgeryAnalysis, entities) {
    let score = 0;
    const breakdown = {};
    
    // OCR Quality Score (40 points)
    const ocrQuality = this.assessOCRQuality(text);
    score += ocrQuality * 0.4;
    breakdown.ocrQuality = ocrQuality;
    
    // Format Validation Score (30 points)
    const formatScore = formatValidation.isValid ? 1 : 0.3;
    score += formatScore * 0.3;
    breakdown.formatValidation = formatScore;
    
    // Forgery Detection Score (30 points)
    const forgeryScore = forgeryAnalysis.isForgery ? 0.1 : 0.9;
    score += forgeryScore * 0.3;
    breakdown.forgeryDetection = forgeryScore;
    
    return {
      overall: Math.min(score, 1),
      breakdown
    };
  }

  assessOCRQuality(text) {
    if (!text || text.length < 10) return 0.2;
    
    // Check for common OCR errors
    const errorPatterns = [/[^\w\s\-.,]/g, /\s{3,}/g, /[0-9]{10,}/g];
    let errorCount = 0;
    
    errorPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) errorCount += matches.length;
    });
    
    const errorRatio = errorCount / text.length;
    return Math.max(0.2, 1 - errorRatio * 10);
  }

  calculateFraudRisk(forgeryAnalysis, confidenceScore) {
    if (forgeryAnalysis.isForgery || confidenceScore.overall < 0.5) {
      return 'high';
    } else if (confidenceScore.overall < 0.7) {
      return 'medium';
    }
    return 'low';
  }

  generateValidationResults(entities, formatValidation, documentType) {
    const results = [];
    
    entities.forEach(entity => {
      const validation = formatValidation.fields[entity.type] || { isValid: true, issues: [] };
      
      results.push({
        field: this.getFieldDisplayName(entity.type),
        value: entity.value,
        isValid: validation.isValid,
        confidence: entity.confidence,
        issues: validation.issues || []
      });
    });
    
    return results;
  }

  getFieldDisplayName(entityType) {
    const displayNames = {
      'PERSON': 'Name',
      'DATE': 'Date',
      'AADHAAR_NUMBER': 'Aadhaar Number',
      'PAN_NUMBER': 'PAN Number',
      'PHONE': 'Phone Number',
      'ADDRESS': 'Address',
      'AMOUNT': 'Amount',
      'INVOICE_NUMBER': 'Invoice Number'
    };
    
    return displayNames[entityType] || entityType;
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}