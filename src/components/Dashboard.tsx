import React from 'react';
import { FileText, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { DocumentValidation } from '../types/document';

interface DashboardProps {
  documents: DocumentValidation[];
}

export const Dashboard: React.FC<DashboardProps> = ({ documents }) => {
  const totalDocuments = documents.length;
  const validDocuments = documents.filter(doc => doc.isValid).length;
  const invalidDocuments = totalDocuments - validDocuments;
  const averageConfidence = documents.length > 0 
    ? documents.reduce((sum, doc) => sum + doc.confidence, 0) / documents.length 
    : 0;

  const stats = [
    {
      label: 'Total Documents',
      value: totalDocuments,
      icon: FileText,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      label: 'Valid Documents',
      value: validDocuments,
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      label: 'Invalid Documents',
      value: invalidDocuments,
      icon: XCircle,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    },
    {
      label: 'Avg. Confidence',
      value: `${Math.round(averageConfidence * 100)}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    }
  ];

  if (totalDocuments === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Validation Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.textColor} mt-2`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 ${stat.color} rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};