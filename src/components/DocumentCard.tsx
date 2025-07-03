import React, { useState } from 'react';
import { 
  FileText, 
  Shield, 
  ShieldAlert, 
  ShieldX, 
  CheckCircle, 
  XCircle, 
  Eye,
  Trash2,
  Calendar,
  HardDrive,
  Brain,
  AlertTriangle,
  Zap,
  Target
} from 'lucide-react';
import { DocumentValidation } from '../types/document';

interface DocumentCardProps {
  document: DocumentValidation;
  onRemove: (id: string) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ document, onRemove }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'validation' | 'ai' | 'forgery'>('validation');

  const getDocumentTypeIcon = (type: string) => {
    return <FileText className="w-6 h-6" />;
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'aadhaar_card': 'Aadhaar Card',
      'pan_card': 'PAN Card',
      'invoice': 'Invoice',
      'id_card': 'ID Card',
      'passport': 'Passport',
      'contract': 'Contract',
      'certificate': 'Certificate',
      'receipt': 'Receipt',
      'unknown': 'Unknown Document'
    };
    return labels[type] || type;
  };

  const getFraudRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Shield className="w-5 h-5 text-green-500" />;
      case 'medium':
        return <ShieldAlert className="w-5 h-5 text-yellow-500" />;
      case 'high':
        return <ShieldX className="w-5 h-5 text-red-500" />;
      default:
        return <Shield className="w-5 h-5 text-gray-500" />;
    }
  };

  const getFraudRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderAIAnalysis = () => {
    if (!document.entities && !document.confidenceBreakdown) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>AI analysis data not available</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {document.confidenceBreakdown && (
          <div>
            <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
              <Target className="w-4 h-4 mr-2" />
              AI Confidence Breakdown
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">OCR Quality</span>
                  <span className="text-lg font-bold text-blue-600">
                    {Math.round(document.confidenceBreakdown.ocrQuality * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${document.confidenceBreakdown.ocrQuality * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Format Validation</span>
                  <span className="text-lg font-bold text-green-600">
                    {Math.round(document.confidenceBreakdown.formatValidation * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${document.confidenceBreakdown.formatValidation * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Forgery Detection</span>
                  <span className="text-lg font-bold text-purple-600">
                    {Math.round(document.confidenceBreakdown.forgeryDetection * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${document.confidenceBreakdown.forgeryDetection * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {document.entities && document.entities.length > 0 && (
          <div>
            <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
              <Brain className="w-4 h-4 mr-2" />
              Named Entity Recognition (NER)
            </h5>
            <div className="space-y-2">
              {document.entities.map((entity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {entity.type}
                      </span>
                      <span className="text-gray-700">{entity.value}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{Math.round(entity.confidence * 100)}%</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${entity.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {document.processingTime && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Zap className="w-5 h-5 text-blue-500 mr-2" />
              <span className="font-medium text-blue-800">
                AI Processing completed in {document.processingTime}ms
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderForgeryAnalysis = () => {
    if (!document.forgeryAnalysis) {
      return (
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Forgery analysis data not available</p>
        </div>
      );
    }

    const { forgeryAnalysis } = document;

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border">
          <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Forgery Detection Results
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Forgery Score:</span>
              <span className={`font-bold ${forgeryAnalysis.forgeryScore > 0.6 ? 'text-red-600' : 'text-green-600'}`}>
                {Math.round(forgeryAnalysis.forgeryScore * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-bold ${forgeryAnalysis.isForgery ? 'text-red-600' : 'text-green-600'}`}>
                {forgeryAnalysis.isForgery ? 'Suspicious' : 'Authentic'}
              </span>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full ${forgeryAnalysis.forgeryScore > 0.6 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${forgeryAnalysis.forgeryScore * 100}%` }}
            />
          </div>

          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            {forgeryAnalysis.analysis}
          </p>
        </div>

        {forgeryAnalysis.suspiciousAreas && forgeryAnalysis.suspiciousAreas.length > 0 && (
          <div>
            <h5 className="font-semibold text-gray-800 mb-3">Suspicious Areas Detected</h5>
            <div className="space-y-2">
              {forgeryAnalysis.suspiciousAreas.map((area, index) => (
                <div key={index} className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-red-800 capitalize">
                      {area.type.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-red-600">
                      {Math.round(area.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-red-700">
                    Location: ({area.x}, {area.y}) - {area.width}×{area.height}px
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {forgeryAnalysis.compressionAnalysis && (
          <div>
            <h5 className="font-semibold text-gray-800 mb-3">Compression Analysis</h5>
            <div className="bg-white p-4 rounded-lg border">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-gray-600">Compression Ratio:</span>
                  <span className="ml-2 font-medium">
                    {Math.round(forgeryAnalysis.compressionAnalysis.compressionRatio * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Inconsistent:</span>
                  <span className={`ml-2 font-medium ${
                    forgeryAnalysis.compressionAnalysis.hasInconsistentCompression ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {forgeryAnalysis.compressionAnalysis.hasInconsistentCompression ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {forgeryAnalysis.compressionAnalysis.qualityFactors.map((factor, index) => (
                  <div key={index} className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600 capitalize">
                      {factor.region.replace('_', ' ')}
                    </div>
                    <div className="font-medium">{factor.quality}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              {getDocumentTypeIcon(document.type)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 truncate max-w-xs" title={document.filename}>
                {document.filename}
              </h3>
              <p className="text-sm text-gray-600">
                {getDocumentTypeLabel(document.type)} • {Math.round(document.confidence * 100)}% confidence
              </p>
            </div>
          </div>
          <button
            onClick={() => onRemove(document.id)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            {document.isValid ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={`font-medium ${document.isValid ? 'text-green-700' : 'text-red-700'}`}>
              {document.isValid ? 'Valid' : 'Invalid'}
            </span>
          </div>
          
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-sm font-medium ${getFraudRiskColor(document.fraudRisk)}`}>
            {getFraudRiskIcon(document.fraudRisk)}
            <span>{document.fraudRisk.charAt(0).toUpperCase() + document.fraudRisk.slice(1)} Risk</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>{document.uploadedAt.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <HardDrive className="w-4 h-4" />
              <span>{formatFileSize(document.size)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <Eye className="w-4 h-4" />
          <span>{showDetails ? 'Hide Details' : 'View AI Analysis'}</span>
        </button>
      </div>

      {showDetails && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="p-6">
            <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1">
              <button
                onClick={() => setActiveTab('validation')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'validation'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Validation Results
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'ai'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                AI Analysis
              </button>
              <button
                onClick={() => setActiveTab('forgery')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'forgery'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Forgery Detection
              </button>
            </div>

            {activeTab === 'validation' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Validation Results</h4>
                  <div className="space-y-2">
                    {document.validationResults.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-700">{result.field}:</span>
                            <span className="text-gray-600">{result.value}</span>
                          </div>
                          {result.issues && result.issues.length > 0 && (
                            <div className="mt-1">
                              {result.issues.map((issue, issueIndex) => (
                                <p key={issueIndex} className="text-sm text-red-600">• {issue}</p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{Math.round(result.confidence * 100)}%</span>
                          {result.isValid ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Extracted Text Preview</h4>
                  <div className="p-4 bg-white rounded-lg border">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {document.extractedText}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && renderAIAnalysis()}
            {activeTab === 'forgery' && renderForgeryAnalysis()}
          </div>
        </div>
      )}
    </div>
  );
};