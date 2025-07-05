import logger from '../utils/logger.js';

export class EnhancedValidationService {
  constructor() {
    this.documentSchemas = this.initializeDocumentSchemas();
    logger.info('Enhanced Validation Service initialized');
  }

  initializeDocumentSchemas() {
    return {
      aadhaar_card: {
        requiredFields: [
          {
            name: 'Name',
            type: 'person',
            patterns: ['Name:', 'नाम:', 'Name'],
            validation: this.validatePersonName,
            required: true
          },
          {
            name: 'Aadhaar Number',
            type: 'aadhaar',
            patterns: ['\\d{4}\\s\\d{4}\\s\\d{4}', '\\d{12}'],
            validation: this.validateAadhaar,
            required: true
          },
          {
            name: 'Date of Birth',
            type: 'date',
            patterns: ['DOB:', 'Date of Birth:', 'जन्म तिथि:', '\\d{1,2}/\\d{1,2}/\\d{4}'],
            validation: this.validateDate,
            required: true
          },
          {
            name: 'Gender',
            type: 'gender',
            patterns: ['Male', 'Female', 'पुरुष', 'महिला'],
            validation: this.validateGender,
            required: true
          },
          {
            name: 'Address',
            type: 'address',
            patterns: ['Address:', 'पता:'],
            validation: this.validateAddress,
            required: true
          }
        ],
        documentIdentifiers: ['Government of India', 'Aadhaar', 'UIDAI', 'भारत सरकार']
      },

      pan_card: {
        requiredFields: [
          {
            name: 'Name',
            type: 'person',
            patterns: ['Name:', 'नाम:'],
            validation: this.validatePersonName,
            required: true
          },
          {
            name: 'PAN Number',
            type: 'pan',
            patterns: ['[A-Z]{5}[0-9]{4}[A-Z]'],
            validation: this.validatePAN,
            required: true
          },
          {
            name: 'Date of Birth',
            type: 'date',
            patterns: ['Date of Birth:', 'DOB:', '\\d{1,2}/\\d{1,2}/\\d{4}'],
            validation: this.validateDate,
            required: true
          },
          {
            name: "Father's Name",
            type: 'person',
            patterns: ["Father's Name:", 'पिता का नाम:'],
            validation: this.validatePersonName,
            required: true
          }
        ],
        documentIdentifiers: ['INCOME TAX DEPARTMENT', 'Permanent Account Number', 'PAN']
      },

      invoice: {
        requiredFields: [
          {
            name: 'Invoice Number',
            type: 'invoice_number',
            patterns: ['Invoice Number:', 'Invoice No:', 'Bill No:'],
            validation: this.validateInvoiceNumber,
            required: true
          },
          {
            name: 'Date',
            type: 'date',
            patterns: ['Date:', 'Invoice Date:', '\\d{1,2}/\\d{1,2}/\\d{4}'],
            validation: this.validateDate,
            required: true
          },
          {
            name: 'Amount',
            type: 'amount',
            patterns: ['Total:', 'Amount:', 'Rs\\.?\\s*\\d+', '₹\\s*\\d+'],
            validation: this.validateAmount,
            required: true
          },
          {
            name: 'GST Number',
            type: 'gst',
            patterns: ['GSTIN:', 'GST No:', '\\d{2}[A-Z]{5}\\d{4}[A-Z]\\d[Z][A-Z\\d]'],
            validation: this.validateGST,
            required: false
          }
        ],
        documentIdentifiers: ['INVOICE', 'BILL', 'TAX INVOICE', 'GST']
      }
    };
  }

  async validateDocument(entities, documentType, extractedText, ocrResult) {
    try {
      logger.info(`Validating ${documentType} document`);
      
      const schema = this.documentSchemas[documentType];
      if (!schema) {
        throw new Error(`Unknown document type: ${documentType}`);
      }

      // Validate document authenticity first
      const authenticityCheck = this.validateDocumentAuthenticity(extractedText, schema);
      
      // Validate individual fields
      const fieldValidations = await this.validateFields(entities, schema, extractedText);
      
      // Check for missing required fields
      const missingFields = this.findMissingFields(entities, schema, extractedText);
      
      // Generate field highlighting data
      const fieldHighlights = this.generateFieldHighlights(ocrResult, schema, fieldValidations);
      
      // Calculate overall validation score
      const validationScore = this.calculateValidationScore(fieldValidations, missingFields, authenticityCheck);

      const result = {
        isValid: validationScore.overall >= 0.7 && missingFields.length === 0,
        score: validationScore,
        fieldValidations,
        missingFields,
        fieldHighlights,
        authenticityCheck,
        errors: this.collectValidationErrors(fieldValidations, missingFields, authenticityCheck)
      };

      logger.info(`Validation completed. Score: ${validationScore.overall}`);
      return result;
    } catch (error) {
      logger.error('Document validation failed:', error);
      throw new Error('Failed to validate document');
    }
  }

  validateDocumentAuthenticity(text, schema) {
    const identifierCount = schema.documentIdentifiers.filter(identifier => 
      text.toLowerCase().includes(identifier.toLowerCase())
    ).length;

    const authenticityScore = identifierCount / schema.documentIdentifiers.length;
    
    return {
      isAuthentic: authenticityScore >= 0.5,
      score: authenticityScore,
      foundIdentifiers: schema.documentIdentifiers.filter(identifier => 
        text.toLowerCase().includes(identifier.toLowerCase())
      ),
      missingIdentifiers: schema.documentIdentifiers.filter(identifier => 
        !text.toLowerCase().includes(identifier.toLowerCase())
      )
    };
  }

  async validateFields(entities, schema, extractedText) {
    const validations = [];

    for (const field of schema.requiredFields) {
      const entity = entities.find(e => 
        e.type.toLowerCase().includes(field.type.toLowerCase()) ||
        field.patterns.some(pattern => new RegExp(pattern, 'i').test(e.value))
      );

      if (entity) {
        const validation = await field.validation.call(this, entity.value, extractedText);
        validations.push({
          field: field.name,
          value: entity.value,
          type: field.type,
          required: field.required,
          ...validation,
          entity
        });
      } else {
        // Try to find field value in text using patterns
        const foundValue = this.findFieldValueInText(extractedText, field);
        if (foundValue) {
          const validation = await field.validation.call(this, foundValue, extractedText);
          validations.push({
            field: field.name,
            value: foundValue,
            type: field.type,
            required: field.required,
            ...validation,
            foundInText: true
          });
        }
      }
    }

    return validations;
  }

  findFieldValueInText(text, field) {
    for (const pattern of field.patterns) {
      const regex = new RegExp(pattern + '\\s*:?\\s*([^\\n\\r]+)', 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  findMissingFields(entities, schema, extractedText) {
    const missingFields = [];
    
    for (const field of schema.requiredFields) {
      if (!field.required) continue;

      const hasEntity = entities.some(e => 
        e.type.toLowerCase().includes(field.type.toLowerCase())
      );

      const hasInText = field.patterns.some(pattern => 
        new RegExp(pattern, 'i').test(extractedText)
      );

      if (!hasEntity && !hasInText) {
        missingFields.push({
          field: field.name,
          type: field.type,
          required: field.required,
          suggestions: this.generateFieldSuggestions(field, extractedText),
          patterns: field.patterns
        });
      }
    }

    return missingFields;
  }

  generateFieldHighlights(ocrResult, schema, fieldValidations) {
    if (!ocrResult || !ocrResult.words) {
      return [];
    }

    const highlights = [];

    // Highlight found fields
    fieldValidations.forEach(validation => {
      if (validation.entity && validation.entity.bbox) {
        highlights.push({
          type: 'found_field',
          field: validation.field,
          bbox: validation.entity.bbox,
          status: validation.isValid ? 'valid' : 'invalid',
          confidence: validation.entity.confidence
        });
      } else if (validation.foundInText) {
        // Try to find the text position
        const position = this.findTextPosition(ocrResult.words, validation.value);
        if (position) {
          highlights.push({
            type: 'found_field',
            field: validation.field,
            bbox: position,
            status: validation.isValid ? 'valid' : 'invalid',
            confidence: 0.8
          });
        }
      }
    });

    // Highlight potential missing field areas
    schema.requiredFields.forEach(field => {
      const hasValidation = fieldValidations.some(v => v.field === field.name);
      if (!hasValidation && field.required) {
        // Look for field labels without values
        const labelPosition = this.findFieldLabel(ocrResult.words, field.patterns);
        if (labelPosition) {
          highlights.push({
            type: 'missing_field',
            field: field.name,
            bbox: labelPosition,
            status: 'missing',
            confidence: 0.6
          });
        }
      }
    });

    return highlights;
  }

  findTextPosition(words, searchText) {
    for (const word of words) {
      if (word.text.toLowerCase().includes(searchText.toLowerCase())) {
        return word.bbox;
      }
    }
    return null;
  }

  findFieldLabel(words, patterns) {
    for (const pattern of patterns) {
      for (const word of words) {
        if (new RegExp(pattern, 'i').test(word.text)) {
          return word.bbox;
        }
      }
    }
    return null;
  }

  generateFieldSuggestions(field, text) {
    const suggestions = [];
    
    switch (field.type) {
      case 'person':
        suggestions.push('Ensure the name is clearly visible and properly formatted');
        suggestions.push('Check if the name field label is present');
        break;
      case 'aadhaar':
        suggestions.push('Aadhaar number should be in format: XXXX XXXX XXXX');
        suggestions.push('Ensure all 12 digits are clearly visible');
        break;
      case 'pan':
        suggestions.push('PAN should be in format: ABCDE1234F');
        suggestions.push('Ensure all 10 characters are clearly visible');
        break;
      case 'date':
        suggestions.push('Date should be in DD/MM/YYYY or DD-MM-YYYY format');
        suggestions.push('Ensure the date is clearly readable');
        break;
      case 'amount':
        suggestions.push('Amount should include currency symbol (₹ or Rs.)');
        suggestions.push('Ensure the total amount is clearly visible');
        break;
      default:
        suggestions.push(`Ensure the ${field.name} field is clearly visible`);
    }

    return suggestions;
  }

  calculateValidationScore(fieldValidations, missingFields, authenticityCheck) {
    const totalFields = fieldValidations.length + missingFields.length;
    const validFields = fieldValidations.filter(v => v.isValid).length;
    const requiredMissingFields = missingFields.filter(f => f.required).length;

    const fieldScore = totalFields > 0 ? validFields / totalFields : 0;
    const completenessScore = requiredMissingFields === 0 ? 1 : 0.5;
    const authenticityScore = authenticityCheck.score;

    const overall = (fieldScore * 0.5) + (completenessScore * 0.3) + (authenticityScore * 0.2);

    return {
      overall,
      fieldAccuracy: fieldScore,
      completeness: completenessScore,
      authenticity: authenticityScore,
      breakdown: {
        validFields,
        totalFields,
        missingRequiredFields: requiredMissingFields
      }
    };
  }

  collectValidationErrors(fieldValidations, missingFields, authenticityCheck) {
    const errors = [];

    // Field validation errors
    fieldValidations.forEach(validation => {
      if (!validation.isValid && validation.issues) {
        validation.issues.forEach(issue => {
          errors.push(`${validation.field}: ${issue}`);
        });
      }
    });

    // Missing field errors
    missingFields.forEach(field => {
      if (field.required) {
        errors.push(`Missing required field: ${field.field}`);
      }
    });

    // Authenticity errors
    if (!authenticityCheck.isAuthentic) {
      errors.push('Document authenticity could not be verified');
      authenticityCheck.missingIdentifiers.forEach(identifier => {
        errors.push(`Missing document identifier: ${identifier}`);
      });
    }

    return errors;
  }

  // Field-specific validation methods
  async validatePersonName(name, context) {
    const issues = [];
    let isValid = true;

    // Basic validation
    if (!name || name.length < 2) {
      isValid = false;
      issues.push('Name is too short');
    }

    if (name.length > 100) {
      isValid = false;
      issues.push('Name is too long');
    }

    // Character validation
    if (!/^[A-Za-z\s\.\-']+$/.test(name)) {
      // Allow Hindi characters as well
      if (!/^[\u0900-\u097FA-Za-z\s\.\-']+$/.test(name)) {
        isValid = false;
        issues.push('Name contains invalid characters');
      }
    }

    // Check for common OCR errors
    const ocrErrors = ['1', '0', '@', '#', '$', '%'];
    if (ocrErrors.some(char => name.includes(char))) {
      issues.push('Possible OCR error in name');
    }

    return { isValid, issues, confidence: isValid ? 0.9 : 0.3 };
  }

  async validateAadhaar(aadhaarNumber, context) {
    const issues = [];
    let isValid = true;

    // Clean the number
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');

    // Length check
    if (cleanAadhaar.length !== 12) {
      isValid = false;
      issues.push('Aadhaar number must be exactly 12 digits');
    }

    // Digit check
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      isValid = false;
      issues.push('Aadhaar number must contain only digits');
    }

    // Invalid patterns
    if (/^(\d)\1{11}$/.test(cleanAadhaar)) {
      isValid = false;
      issues.push('Aadhaar number cannot have all same digits');
    }

    // Verhoeff algorithm check
    if (isValid && !this.verhoeffCheck(cleanAadhaar)) {
      isValid = false;
      issues.push('Invalid Aadhaar number checksum');
    }

    // Check if it appears in context appropriately
    if (!context.toLowerCase().includes('aadhaar') && !context.toLowerCase().includes('aadhar')) {
      issues.push('Aadhaar number found but document type unclear');
    }

    return { isValid, issues, confidence: isValid ? 0.95 : 0.2 };
  }

  async validatePAN(panNumber, context) {
    const issues = [];
    let isValid = true;

    // Format check
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      isValid = false;
      issues.push('Invalid PAN format. Should be ABCDE1234F');
    }

    if (isValid) {
      // Structure validation
      const panStructure = {
        0: ['A', 'B', 'C', 'F', 'G', 'H', 'L', 'J', 'P', 'T'], // First letter
        3: ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'], // Fourth letter
      };

      if (!panStructure[0].includes(panNumber[0])) {
        issues.push('Invalid first character in PAN');
        isValid = false;
      }

      if (!panStructure[3].includes(panNumber[3])) {
        issues.push('Invalid fourth character in PAN');
        isValid = false;
      }
    }

    // Context check
    if (!context.toLowerCase().includes('pan') && !context.toLowerCase().includes('permanent account')) {
      issues.push('PAN number found but document type unclear');
    }

    return { isValid, issues, confidence: isValid ? 0.92 : 0.3 };
  }

  async validateDate(dateString, context) {
    const issues = [];
    let isValid = true;

    // Try multiple date formats
    const dateFormats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
    ];

    let parsedDate = null;
    let matchedFormat = null;

    for (const format of dateFormats) {
      const match = dateString.match(format);
      if (match) {
        let day, month, year;
        
        if (format === dateFormats[2]) { // YYYY-MM-DD format
          [, year, month, day] = match;
        } else {
          [, day, month, year] = match;
        }

        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        matchedFormat = format;
        break;
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      isValid = false;
      issues.push('Invalid date format');
    } else {
      // Validate date ranges
      const now = new Date();
      const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
      const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

      if (parsedDate > tenYearsFromNow) {
        issues.push('Date cannot be too far in the future');
        isValid = false;
      }

      if (parsedDate < hundredYearsAgo) {
        issues.push('Date seems too old to be valid');
        isValid = false;
      }

      // Context-specific validation
      if (context.toLowerCase().includes('birth') || context.toLowerCase().includes('dob')) {
        if (parsedDate > now) {
          issues.push('Birth date cannot be in the future');
          isValid = false;
        }
      }
    }

    return { isValid, issues, confidence: isValid ? 0.88 : 0.4 };
  }

  async validateGender(gender, context) {
    const issues = [];
    const validGenders = ['male', 'female', 'पुरुष', 'महिला', 'm', 'f'];
    const isValid = validGenders.some(valid => 
      gender.toLowerCase().includes(valid.toLowerCase())
    );

    if (!isValid) {
      issues.push('Invalid gender value');
    }

    return { isValid, issues, confidence: isValid ? 0.9 : 0.3 };
  }

  async validateAddress(address, context) {
    const issues = [];
    let isValid = true;

    if (!address || address.length < 10) {
      isValid = false;
      issues.push('Address is too short');
    }

    if (address.length > 500) {
      isValid = false;
      issues.push('Address is too long');
    }

    // Check for common address components
    const addressComponents = ['street', 'road', 'colony', 'city', 'state', 'pin', 'pincode'];
    const hasComponents = addressComponents.some(component => 
      address.toLowerCase().includes(component)
    );

    if (!hasComponents && address.length < 50) {
      issues.push('Address may be incomplete');
    }

    return { isValid, issues, confidence: isValid ? 0.8 : 0.4 };
  }

  async validateAmount(amountString, context) {
    const issues = [];
    let isValid = true;

    // Extract numeric value
    const numericValue = amountString.replace(/[^\d.]/g, '');
    const amount = parseFloat(numericValue);

    if (isNaN(amount)) {
      isValid = false;
      issues.push('Invalid amount format');
    } else {
      if (amount < 0) {
        isValid = false;
        issues.push('Amount cannot be negative');
      }

      if (amount > 10000000) { // 1 crore
        issues.push('Amount seems unusually high');
      }

      if (amount === 0) {
        issues.push('Amount cannot be zero');
        isValid = false;
      }
    }

    // Check for currency symbols
    if (!amountString.includes('₹') && !amountString.toLowerCase().includes('rs')) {
      issues.push('Currency symbol missing');
    }

    return { isValid, issues, confidence: isValid ? 0.85 : 0.3 };
  }

  async validateInvoiceNumber(invoiceNumber, context) {
    const issues = [];
    let isValid = true;

    if (!invoiceNumber || invoiceNumber.length < 3) {
      isValid = false;
      issues.push('Invoice number is too short');
    }

    if (invoiceNumber.length > 50) {
      isValid = false;
      issues.push('Invoice number is too long');
    }

    // Check for valid invoice number pattern
    if (!/^[A-Z0-9\-\/]+$/i.test(invoiceNumber)) {
      issues.push('Invoice number contains invalid characters');
    }

    return { isValid, issues, confidence: isValid ? 0.9 : 0.4 };
  }

  async validateGST(gstNumber, context) {
    const issues = [];
    let isValid = true;

    // GST format: 22AAAAA0000A1Z5
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(gstNumber)) {
      isValid = false;
      issues.push('Invalid GST number format');
    }

    return { isValid, issues, confidence: isValid ? 0.9 : 0.3 };
  }

  // Verhoeff algorithm implementation for Aadhaar validation
  verhoeffCheck(aadhaar) {
    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];

    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];

    let c = 0;
    const myArray = aadhaar.split('').reverse();

    for (let i = 0; i < myArray.length; i++) {
      c = d[c][p[((i + 1) % 8)][parseInt(myArray[i])]];
    }

    return c === 0;
  }
}