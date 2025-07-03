export interface DocumentValidation {
  id: string;
  filename: string;
  type: DocumentType;
  confidence: number;
  isValid: boolean;
  fraudRisk: 'low' | 'medium' | 'high';
  extractedText: string;
  validationResults: ValidationResult[];
  uploadedAt: Date;
  processedAt?: Date;
  size: number;
  // AI-specific fields
  entities?: AIEntity[];
  forgeryAnalysis?: ForgeryAnalysis;
  confidenceBreakdown?: ConfidenceBreakdown;
  processingTime?: number;
}

export interface ValidationResult {
  field: string;
  value: string;
  isValid: boolean;
  confidence: number;
  issues?: string[];
}

export interface AIEntity {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
}

export interface ForgeryAnalysis {
  isForgery: boolean;
  forgeryScore: number;
  suspiciousAreas: SuspiciousArea[];
  compressionAnalysis: CompressionAnalysis;
  metadataAnalysis: MetadataAnalysis;
  elaImagePath: string;
  analysis: string;
}

export interface SuspiciousArea {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  type: 'text_modification' | 'image_splice' | 'copy_move';
}

export interface CompressionAnalysis {
  hasInconsistentCompression: boolean;
  compressionRatio: number;
  qualityFactors: QualityFactor[];
}

export interface QualityFactor {
  region: string;
  quality: number;
}

export interface MetadataAnalysis {
  hasInconsistentMetadata: boolean;
  creationDate: Date;
  modificationDate: Date;
  software: string;
  gpsData?: {
    latitude: number;
    longitude: number;
  };
}

export interface ConfidenceBreakdown {
  ocrQuality: number;
  formatValidation: number;
  forgeryDetection: number;
}

export type DocumentType = 
  | 'aadhaar_card'
  | 'pan_card'
  | 'invoice' 
  | 'id_card' 
  | 'passport' 
  | 'contract' 
  | 'certificate' 
  | 'receipt' 
  | 'unknown';

export interface ProcessingStatus {
  stage: 'uploading' | 'ocr' | 'classification' | 'validation' | 'complete';
  progress: number;
  message: string;
}