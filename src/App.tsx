import React from 'react';
import { FileText } from 'lucide-react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { DocumentUploader } from './components/DocumentUploader';
import { ProcessingIndicator } from './components/ProcessingIndicator';
import { DocumentCard } from './components/DocumentCard';
import { useDocumentProcessor } from './hooks/useDocumentProcessor';

function App() {
  const { documents, processing, processDocument, removeDocument } = useDocumentProcessor();

  const handleUpload = async (file: File) => {
    await processDocument(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            AI-Powered Document Validation
          </h1>
          <p className="text-gray-600">
            Upload documents for intelligent validation, fraud detection, and content analysis using advanced AI technologies.
          </p>
        </div>

        <Dashboard documents={documents} />

        <div className="mb-8">
          <DocumentUploader 
            onUpload={handleUpload} 
            isProcessing={processing.length > 0} 
          />
        </div>

        {processing.length > 0 && (
          <div className="mb-8 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Processing</h2>
            {processing.map(([fileId, status]) => (
              <ProcessingIndicator key={fileId} status={status} />
            ))}
          </div>
        )}

        {documents.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Validation Results</h2>
            <div className="grid gap-6">
              {documents.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onRemove={removeDocument}
                />
              ))}
            </div>
          </div>
        )}

        {documents.length === 0 && processing.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <div className="mx-auto w-24 h-24 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <FileText className="w-12 h-12 text-blue-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Documents Yet</h3>
              <p className="text-gray-600">
                Upload your first document to see AI-powered validation in action. Our system supports invoices, ID cards, contracts, and more.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p className="mb-2">
              <strong>Note:</strong> This is a frontend demonstration with simulated AI processing.
            </p>
            <p className="text-sm">
              In production, this would connect to a backend API with real OCR, ML classification, and NLP validation services.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;