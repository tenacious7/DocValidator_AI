export class ValidationService {
  constructor() {
    console.log('Validation Service initialized');
  }

  validateFormat(entities, documentType) {
    const results = {
      isValid: true,
      fields: {},
      errors: []
    };

    entities.forEach(entity => {
      const validation = this.validateEntity(entity, documentType);
      results.fields[entity.type] = validation;
      
      if (!validation.isValid) {
        results.isValid = false;
        results.errors.push(...validation.issues);
      }
    });

    return results;
  }

  validateEntity(entity, documentType) {
    switch (entity.type) {
      case 'AADHAAR_NUMBER':
        return this.validateAadhaar(entity.value);
      case 'PAN_NUMBER':
        return this.validatePAN(entity.value);
      case 'DATE':
        return this.validateDate(entity.value);
      case 'PERSON':
        return this.validatePersonName(entity.value);
      case 'AMOUNT':
        return this.validateAmount(entity.value);
      default:
        return { isValid: true, issues: [] };
    }
  }

  validateAadhaar(aadhaarNumber) {
    const issues = [];
    let isValid = true;

    // Remove spaces and check format
    const cleanAadhaar = aadhaarNumber.replace(/\s/g, '');
    
    // Check if it's 12 digits
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      isValid = false;
      issues.push('Aadhaar number must be exactly 12 digits');
    }

    // Check for invalid patterns (all same digits, sequential)
    if (/^(\d)\1{11}$/.test(cleanAadhaar)) {
      isValid = false;
      issues.push('Aadhaar number cannot have all same digits');
    }

    // Verhoeff algorithm check (simplified)
    if (!this.verhoeffCheck(cleanAadhaar)) {
      isValid = false;
      issues.push('Invalid Aadhaar number checksum');
    }

    return { isValid, issues };
  }

  validatePAN(panNumber) {
    const issues = [];
    let isValid = true;

    // PAN format: ABCDE1234F
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      isValid = false;
      issues.push('Invalid PAN format. Should be ABCDE1234F');
    }

    // Check for valid PAN structure
    const panStructure = {
      1: ['A', 'B', 'C', 'F', 'G', 'H', 'L', 'J', 'P', 'T'], // First letter
      4: ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'], // Fourth letter
      5: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] // Fifth letter
    };

    if (panNumber.length === 10) {
      if (!panStructure[1].includes(panNumber[0])) {
        issues.push('Invalid first character in PAN');
        isValid = false;
      }
      if (!panStructure[4].includes(panNumber[3])) {
        issues.push('Invalid fourth character in PAN');
        isValid = false;
      }
    }

    return { isValid, issues };
  }

  validateDate(dateString) {
    const issues = [];
    let isValid = true;

    // Try to parse the date
    const dateFormats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    ];

    let parsedDate = null;
    for (const format of dateFormats) {
      const match = dateString.match(format);
      if (match) {
        const [, day, month, year] = match;
        parsedDate = new Date(year, month - 1, day);
        break;
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      isValid = false;
      issues.push('Invalid date format');
    } else {
      // Check if date is reasonable (not in future, not too old)
      const now = new Date();
      const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());

      if (parsedDate > now) {
        issues.push('Date cannot be in the future');
        isValid = false;
      }

      if (parsedDate < hundredYearsAgo) {
        issues.push('Date seems too old to be valid');
        isValid = false;
      }
    }

    return { isValid, issues };
  }

  validatePersonName(name) {
    const issues = [];
    let isValid = true;

    // Check minimum length
    if (name.length < 2) {
      isValid = false;
      issues.push('Name too short');
    }

    // Check for valid characters (letters, spaces, common punctuation)
    if (!/^[A-Za-z\s\.\-']+$/.test(name)) {
      isValid = false;
      issues.push('Name contains invalid characters');
    }

    // Check for reasonable length
    if (name.length > 100) {
      isValid = false;
      issues.push('Name too long');
    }

    return { isValid, issues };
  }

  validateAmount(amountString) {
    const issues = [];
    let isValid = true;

    // Extract numeric value
    const numericValue = amountString.replace(/[^\d.]/g, '');
    const amount = parseFloat(numericValue);

    if (isNaN(amount)) {
      isValid = false;
      issues.push('Invalid amount format');
    } else {
      // Check for reasonable amount ranges
      if (amount < 0) {
        isValid = false;
        issues.push('Amount cannot be negative');
      }

      if (amount > 10000000) { // 1 crore
        issues.push('Amount seems unusually high');
      }
    }

    return { isValid, issues };
  }

  // Simplified Verhoeff algorithm for Aadhaar validation
  verhoeffCheck(aadhaar) {
    // This is a simplified version - real implementation would use full Verhoeff tables
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