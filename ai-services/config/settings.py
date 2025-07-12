"""
Configuration settings for AI services
"""

import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings."""
    
    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "https://docvalidation.netlify.app"
    ]
    
    # Azure Configuration
    AZURE_COMPUTER_VISION_ENDPOINT: str = ""
    AZURE_COMPUTER_VISION_KEY: str = ""
    AZURE_TEXT_ANALYTICS_ENDPOINT: str = ""
    AZURE_TEXT_ANALYTICS_KEY: str = ""
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    
    # OCR Configuration
    TESSERACT_CMD: str = "/usr/bin/tesseract"
    OCR_LANGUAGES: str = "eng+hin"
    OCR_DPI: int = 300
    
    # ML Model Paths
    DOCUMENT_CLASSIFIER_MODEL_PATH: str = "./models/document_classifier.pkl"
    FRAUD_DETECTOR_MODEL_PATH: str = "./models/fraud_detector.pkl"
    TEXT_VALIDATOR_MODEL_PATH: str = "./models/text_validator.pkl"
    NER_MODEL_PATH: str = "./models/ner_model"
    
    # Cache Configuration
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL: int = 3600  # 1 hour
    
    # Processing Configuration
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    MAX_CONCURRENT_REQUESTS: int = 10
    PROCESSING_TIMEOUT: int = 300  # 5 minutes
    
    # Performance Configuration
    ENABLE_GPU: bool = False
    BATCH_SIZE: int = 1
    NUM_WORKERS: int = 4
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()