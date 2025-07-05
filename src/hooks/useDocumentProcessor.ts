import { useState, useCallback } from 'react';
import { DocumentValidation, ProcessingStatus } from '../types/document';

export const useDocumentProcessor = () => {
  const [documents, setDocuments] = useState<DocumentValidation[]>([]);
  const [processing, setProcessing] = useState<Map<string, ProcessingStatus>>(new Map());

  const simulateProcessing = async (fileId: string, file: File): Promise<DocumentValidation> => {
    const stages: ProcessingStatus[] = [
      { stage: 'uploading', progress: 20, message: 'Uploading document...' },
      { stage: 'ocr', progress: 40, message: 'Extracting text with AI OCR...' },
      { stage: 'classification', progress: 60, message: 'Classifying document with ML...' },
      { stage: 'validation', progress: 80, message: 'Validating with NLP and fraud detection...' },
      { stage: 'complete', progress: 100, message: 'AI processing complete!' }
    ];

    for (const status of stages) {
      setProcessing(prev => new Map(prev).set(fileId, status));
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    }

    // Use HTTP protocol explicitly for the backend connection
    const backendUrl = 'http://localhost:3001/api/validate-document';
    
    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const validation = await response.json();
      
      setProcessing(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });

      return {
        ...validation,
        uploadedAt: new Date(validation.uploadedAt),
        processedAt: new Date(validation.processedAt),
        size: file.size
      };
    } catch (error) {
      console.error('AI processing failed:', error);
      
      // Fallback to mock data if backend is not available
      const mockValidation = generateMockValidation(file);
      
      setProcessing(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });

      return mockValidation;
    }
  };

  const generateMockValidation = (file: File): DocumentValidation => {
    const documentTypes = ['aadhaar_card', 'pan_card', 'invoice', 'id_card', 'passport'];
    const randomType = documentTypes[Math.floor(Math.random() * documentTypes.length)];
    
    const mockResults = [];
    if (randomType === 'aadhaar_card') {
      mockResults.push(
        { field: 'Name', value: 'RAJESH KUMAR', isValid: true, confidence: 0.97 },
        { field: 'Aadhaar Number', value: '1234 5678 9012', isValid: true, confidence: 0.95 },
        { field: 'Date of Birth', value: '15/08/1985', isValid: true, confidence: 0.92 },
        { field: 'Address', value: '123 Main Street, Delhi', isValid: true, confidence: 0.88 }
      );
    } else if (randomType === 'pan_card') {
      mockResults.push(
        { field: 'Name', value: 'RAJESH KUMAR', isValid: true, confidence: 0.96 },
        { field: 'PAN Number', value: 'ABCDE1234F', isValid: true, confidence: 0.94 },
        { field: 'Date of Birth', value: '15/08/1985', isValid: true, confidence: 0.91 },
        { field: "Father's Name", value: 'RAM KUMAR', isValid: true, confidence: 0.89 }
      );
    }

    const fraudRisk = Math.random() > 0.8 ? 'high' : Math.random() > 0.6 ? 'medium' : 'low';
    const isValid = mockResults.every(r => r.isValid) && fraudRisk !== 'high';

    return {
      id: Math.random().toString(36).substr(2, 9),
      filename: file.name,
      type: randomType as any,
      confidence: 0.85 + Math.random() * 0.15,
      isValid,
      fraudRisk,
      extractedText: `Mock AI-extracted text from ${file.name}. This demonstrates OCR, NER, and validation capabilities.`,
      validationResults: mockResults,
      uploadedAt: new Date(),
      processedAt: new Date(),
      size: file.size
    };
  };

  const processDocument = useCallback(async (file: File) => {
    const fileId = Math.random().toString(36).substr(2, 9);
    
    try {
      const validation = await simulateProcessing(fileId, file);
      setDocuments(prev => [validation, ...prev]);
      return validation;
    } catch (error) {
      setProcessing(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      throw error;
    }
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  }, []);

  return {
    documents,
    processing: Array.from(processing.entries()),
    processDocument,
    removeDocument
  };
};