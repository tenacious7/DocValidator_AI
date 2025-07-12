"""
AI Services FastAPI Application
Main entry point for Python-based AI services including OCR, ML classification, and fraud detection.
"""

import os
import logging
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Import AI service modules
from services.ocr_service import OCRService
from services.classification_service import ClassificationService
from services.fraud_detection_service import FraudDetectionService
from services.text_validation_service import TextValidationService
from utils.image_processor import ImageProcessor
from utils.model_manager import ModelManager
from utils.cache_manager import CacheManager
from config.settings import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global service instances
services: Dict[str, Any] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting AI Services...")
    
    try:
        # Initialize services
        services['model_manager'] = ModelManager()
        services['cache_manager'] = CacheManager()
        services['image_processor'] = ImageProcessor()
        
        # Load ML models
        await services['model_manager'].load_models()
        
        # Initialize AI services
        services['ocr'] = OCRService()
        services['classification'] = ClassificationService(services['model_manager'])
        services['fraud_detection'] = FraudDetectionService(services['model_manager'])
        services['text_validation'] = TextValidationService(services['model_manager'])
        
        logger.info("AI Services initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize AI services: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Services...")
    # Cleanup resources if needed

# Create FastAPI app
app = FastAPI(
    title="AI Document Validation Services",
    description="Advanced AI services for document validation, OCR, and fraud detection",
    version="2.0.0",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Pydantic models for API
class DocumentProcessingRequest(BaseModel):
    document_type: Optional[str] = Field(None, description="Expected document type")
    enable_fraud_detection: bool = Field(True, description="Enable fraud detection")
    enable_text_validation: bool = Field(True, description="Enable text validation")
    language: str = Field("eng+hin", description="OCR language")

class OCRResult(BaseModel):
    text: str
    confidence: float
    words: List[Dict[str, Any]]
    lines: List[Dict[str, Any]]
    processing_time: float

class ClassificationResult(BaseModel):
    document_type: str
    confidence: float
    probabilities: Dict[str, float]
    processing_time: float

class FraudDetectionResult(BaseModel):
    is_fraudulent: bool
    fraud_score: float
    suspicious_areas: List[Dict[str, Any]]
    analysis_details: Dict[str, Any]
    processing_time: float

class TextValidationResult(BaseModel):
    is_valid: bool
    validation_score: float
    field_validations: List[Dict[str, Any]]
    missing_fields: List[str]
    processing_time: float

class DocumentProcessingResult(BaseModel):
    ocr_result: OCRResult
    classification_result: ClassificationResult
    fraud_detection_result: Optional[FraudDetectionResult] = None
    text_validation_result: Optional[TextValidationResult] = None
    overall_confidence: float
    processing_time: float

# API Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "services": {
            "ocr": "ready",
            "classification": "ready",
            "fraud_detection": "ready",
            "text_validation": "ready"
        },
        "version": "2.0.0"
    }

@app.post("/ocr/extract", response_model=OCRResult)
async def extract_text(
    file: UploadFile = File(...),
    language: str = "eng+hin"
):
    """Extract text from document image using OCR."""
    try:
        # Validate file
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read file content
        image_data = await file.read()
        
        # Process with OCR service
        result = await services['ocr'].extract_text(image_data, language)
        
        return OCRResult(**result)
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@app.post("/classification/classify", response_model=ClassificationResult)
async def classify_document(
    file: UploadFile = File(...),
    text: Optional[str] = None
):
    """Classify document type using ML model."""
    try:
        # Read file content
        image_data = await file.read()
        
        # Process with classification service
        result = await services['classification'].classify_document(image_data, text)
        
        return ClassificationResult(**result)
        
    except Exception as e:
        logger.error(f"Document classification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

@app.post("/fraud-detection/analyze", response_model=FraudDetectionResult)
async def detect_fraud(
    file: UploadFile = File(...),
    document_type: Optional[str] = None
):
    """Analyze document for fraud indicators."""
    try:
        # Read file content
        image_data = await file.read()
        
        # Process with fraud detection service
        result = await services['fraud_detection'].analyze_document(image_data, document_type)
        
        return FraudDetectionResult(**result)
        
    except Exception as e:
        logger.error(f"Fraud detection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Fraud detection failed: {str(e)}")

@app.post("/validation/validate", response_model=TextValidationResult)
async def validate_text(
    text: str,
    document_type: str,
    extracted_entities: Optional[List[Dict[str, Any]]] = None
):
    """Validate extracted text and entities."""
    try:
        # Process with text validation service
        result = await services['text_validation'].validate_text(
            text, document_type, extracted_entities
        )
        
        return TextValidationResult(**result)
        
    except Exception as e:
        logger.error(f"Text validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text validation failed: {str(e)}")

@app.post("/process/complete", response_model=DocumentProcessingResult)
async def process_document_complete(
    file: UploadFile = File(...),
    request: DocumentProcessingRequest = DocumentProcessingRequest()
):
    """Complete document processing pipeline."""
    try:
        # Read file content
        image_data = await file.read()
        
        start_time = asyncio.get_event_loop().time()
        
        # Step 1: OCR
        ocr_result = await services['ocr'].extract_text(image_data, request.language)
        
        # Step 2: Classification
        classification_result = await services['classification'].classify_document(
            image_data, ocr_result['text']
        )
        
        # Step 3: Fraud Detection (optional)
        fraud_result = None
        if request.enable_fraud_detection:
            fraud_result = await services['fraud_detection'].analyze_document(
                image_data, classification_result['document_type']
            )
        
        # Step 4: Text Validation (optional)
        validation_result = None
        if request.enable_text_validation:
            validation_result = await services['text_validation'].validate_text(
                ocr_result['text'], 
                classification_result['document_type']
            )
        
        # Calculate overall confidence
        overall_confidence = (
            ocr_result['confidence'] * 0.3 +
            classification_result['confidence'] * 0.3 +
            (1 - fraud_result['fraud_score'] if fraud_result else 0.8) * 0.2 +
            (validation_result['validation_score'] if validation_result else 0.8) * 0.2
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return DocumentProcessingResult(
            ocr_result=OCRResult(**ocr_result),
            classification_result=ClassificationResult(**classification_result),
            fraud_detection_result=FraudDetectionResult(**fraud_result) if fraud_result else None,
            text_validation_result=TextValidationResult(**validation_result) if validation_result else None,
            overall_confidence=overall_confidence,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Complete document processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

@app.get("/models/status")
async def get_model_status():
    """Get status of loaded ML models."""
    try:
        status = await services['model_manager'].get_model_status()
        return status
    except Exception as e:
        logger.error(f"Failed to get model status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model status")

@app.post("/models/reload")
async def reload_models():
    """Reload ML models."""
    try:
        await services['model_manager'].reload_models()
        return {"status": "success", "message": "Models reloaded successfully"}
    except Exception as e:
        logger.error(f"Failed to reload models: {e}")
        raise HTTPException(status_code=500, detail="Failed to reload models")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )