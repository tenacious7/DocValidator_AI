import React from 'react';
import { Loader2, Brain, Eye, FileSearch, CheckCircle, Zap, Shield } from 'lucide-react';
import { ProcessingStatus } from '../types/document';

interface ProcessingIndicatorProps {
  status: ProcessingStatus;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ status }) => {
  const getIcon = () => {
    switch (status.stage) {
      case 'uploading':
        return <Loader2 className="w-6 h-6 animate-spin" />;
      case 'ocr':
        return <Eye className="w-6 h-6" />;
      case 'classification':
        return <Brain className="w-6 h-6" />;
      case 'validation':
        return <FileSearch className="w-6 h-6" />;
      case 'complete':
        return <CheckCircle className="w-6 h-6" />;
      default:
        return <Loader2 className="w-6 h-6 animate-spin" />;
    }
  };

  const getStageColor = () => {
    if (status.stage === 'complete') return 'text-green-600';
    return 'text-blue-600';
  };

  const getStageDescription = () => {
    switch (status.stage) {
      case 'uploading':
        return 'Uploading document to AI processing pipeline...';
      case 'ocr':
        return 'Extracting text using advanced OCR technology...';
      case 'classification':
        return 'Classifying document type with machine learning...';
      case 'validation':
        return 'Validating content with NLP and fraud detection...';
      case 'complete':
        return 'AI processing completed successfully!';
      default:
        return status.message;
    }
  };

  const getAIFeatures = () => {
    switch (status.stage) {
      case 'ocr':
        return ['Tesseract OCR Engine', 'Text Recognition', 'Layout Analysis'];
      case 'classification':
        return ['Document Type Detection', 'ML Classification', 'Pattern Recognition'];
      case 'validation':
        return ['Named Entity Recognition', 'Format Validation', 'Fraud Detection'];
      default:
        return [];
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center mb-4">
        <div className={`${getStageColor()}`}>
          {getIcon()}
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            AI Document Processing
            <Zap className="w-4 h-4 ml-2 text-yellow-500" />
          </h3>
          <p className="text-gray-600">{getStageDescription()}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium text-gray-800">{status.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {['uploading', 'ocr', 'classification', 'validation'].map((stage, index) => (
          <div
            key={stage}
            className={`h-2 rounded-full transition-all duration-300 ${
              index < (['uploading', 'ocr', 'classification', 'validation'].indexOf(status.stage) + 1)
                ? 'bg-blue-500'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {getAIFeatures().length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Brain className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-sm font-medium text-blue-800">Active AI Features:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {getAIFeatures().map((feature, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center text-xs text-gray-500">
        <Shield className="w-3 h-3 mr-1" />
        <span>Secure AI processing with enterprise-grade encryption</span>
      </div>
    </div>
  );
};