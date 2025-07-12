# API Documentation

## Overview

The AI Document Validation System provides RESTful APIs for document processing, validation, and fraud detection. The system is built with a microservices architecture using Node.js for the main API and Python for AI services.

## Base URLs

- **Development**: `http://localhost:3001/api`
- **Production**: `https://api.docvalidation.ai`
- **AI Services**: `http://localhost:8000` (Python FastAPI)

## Authentication

All API endpoints require authentication using JWT tokens.

```bash
Authorization: Bearer <jwt_token>
```

## Core Endpoints

### Document Processing

#### Upload and Validate Document
```http
POST /api/documents/validate
Content-Type: multipart/form-data

Parameters:
- document (file): Document image file
- documentType (string, optional): Expected document type
- strictMode (boolean, optional): Enable strict validation
```

**Response:**
```json
{
  "id": "doc_123456",
  "filename": "aadhaar_card.jpg",
  "type": "aadhaar_card",
  "confidence": 0.95,
  "isValid": true,
  "fraudRisk": "low",
  "extractedText": "Government of India...",
  "validationResults": [
    {
      "field": "Name",
      "value": "RAJESH KUMAR",
      "isValid": true,
      "confidence": 0.97
    }
  ],
  "forgeryAnalysis": {
    "isForgery": false,
    "forgeryScore": 0.15,
    "suspiciousAreas": []
  },
  "metadata": {
    "processingTime": 2340,
    "fileSize": 1024000,
    "apiVersion": "2.0.0"
  }
}
```

#### Batch Document Processing
```http
POST /api/documents/validate-batch
Content-Type: multipart/form-data

Parameters:
- documents (files): Multiple document files (max 5)
```

#### Get Document Details
```http
GET /api/documents/{documentId}
```

#### List Documents
```http
GET /api/documents?page=1&limit=10&type=aadhaar_card
```

### AI Services (Python FastAPI)

#### OCR Text Extraction
```http
POST /ocr/extract
Content-Type: multipart/form-data

Parameters:
- file (file): Image file
- language (string): OCR language (default: "eng+hin")
```

#### Document Classification
```http
POST /classification/classify
Content-Type: multipart/form-data

Parameters:
- file (file): Image file
- text (string, optional): Pre-extracted text
```

#### Fraud Detection
```http
POST /fraud-detection/analyze
Content-Type: multipart/form-data

Parameters:
- file (file): Image file
- document_type (string, optional): Document type
```

#### Complete Processing Pipeline
```http
POST /process/complete
Content-Type: multipart/form-data

Parameters:
- file (file): Image file
- request (json): Processing configuration
```

### Analytics

#### Get Processing Statistics
```http
GET /api/analytics/stats?period=7d
```

#### Get Accuracy Metrics
```http
GET /api/analytics/accuracy?documentType=aadhaar_card
```

#### Get Performance Metrics
```http
GET /api/analytics/performance
```

### System

#### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "OK",
  "services": {
    "database": "connected",
    "aiServices": "ready",
    "cache": "connected"
  },
  "version": "2.0.0",
  "uptime": 86400
}
```

#### System Statistics
```http
GET /api/system/stats
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "message": "Document type not supported",
  "details": {
    "supportedTypes": ["aadhaar_card", "pan_card", "invoice"]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `FILE_TOO_LARGE` | File size exceeds limit |
| `INVALID_FILE_TYPE` | Unsupported file format |
| `PROCESSING_ERROR` | AI processing failed |
| `INTERNAL_ERROR` | Server error |

## Rate Limiting

API endpoints are rate limited to ensure fair usage:

- **General endpoints**: 100 requests per 15 minutes
- **Document processing**: 20 requests per 10 minutes
- **Batch processing**: 5 requests per 10 minutes

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

## SDKs and Libraries

### JavaScript/Node.js
```bash
npm install @docvalidation/sdk
```

```javascript
import { DocValidationClient } from '@docvalidation/sdk';

const client = new DocValidationClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.docvalidation.ai'
});

const result = await client.validateDocument(file, {
  documentType: 'aadhaar_card',
  strictMode: true
});
```

### Python
```bash
pip install docvalidation-python
```

```python
from docvalidation import DocValidationClient

client = DocValidationClient(
    api_key='your-api-key',
    base_url='https://api.docvalidation.ai'
)

result = client.validate_document(
    file_path='document.jpg',
    document_type='aadhaar_card'
)
```

## Webhooks

Configure webhooks to receive real-time notifications:

```http
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["document.validated", "fraud.detected"],
  "secret": "webhook-secret"
}
```

## Testing

### Postman Collection
Import our Postman collection for easy API testing:
[Download Collection](./postman/DocValidation-API.postman_collection.json)

### cURL Examples

**Validate Document:**
```bash
curl -X POST \
  http://localhost:3001/api/documents/validate \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: multipart/form-data' \
  -F 'document=@aadhaar_card.jpg' \
  -F 'documentType=aadhaar_card'
```

**Health Check:**
```bash
curl -X GET http://localhost:3001/api/health
```

## Support

For API support and questions:
- Email: api-support@docvalidation.ai
- Documentation: https://docs.docvalidation.ai
- Status Page: https://status.docvalidation.ai