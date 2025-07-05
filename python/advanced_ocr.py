#!/usr/bin/env python3
"""
Advanced OCR processing using multiple engines and preprocessing techniques
"""

import sys
import json
import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedOCR:
    def __init__(self):
        self.config = {
            'tesseract_config': '--oem 1 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:-/()',
            'languages': 'eng+hin',
            'dpi': 300
        }
    
    def preprocess_image(self, image_path):
        """Advanced image preprocessing for better OCR accuracy"""
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image: {image_path}")
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply multiple preprocessing techniques
            processed_images = []
            
            # 1. Original grayscale
            processed_images.append(('original', gray))
            
            # 2. Gaussian blur + threshold
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            _, thresh1 = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            processed_images.append(('otsu_threshold', thresh1))
            
            # 3. Adaptive threshold
            adaptive_thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            processed_images.append(('adaptive_threshold', adaptive_thresh))
            
            # 4. Morphological operations
            kernel = np.ones((2, 2), np.uint8)
            morph = cv2.morphologyEx(thresh1, cv2.MORPH_CLOSE, kernel)
            processed_images.append(('morphological', morph))
            
            # 5. Noise removal
            denoised = cv2.medianBlur(gray, 3)
            processed_images.append(('denoised', denoised))
            
            return processed_images
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            raise
    
    def extract_text_multiple_methods(self, image_path):
        """Extract text using multiple preprocessing methods and return best result"""
        try:
            processed_images = self.preprocess_image(image_path)
            results = []
            
            for method_name, processed_image in processed_images:
                try:
                    # Convert numpy array to PIL Image
                    pil_image = Image.fromarray(processed_image)
                    
                    # Extract text with confidence scores
                    data = pytesseract.image_to_data(
                        pil_image,
                        lang=self.config['languages'],
                        config=self.config['tesseract_config'],
                        output_type=pytesseract.Output.DICT
                    )
                    
                    # Extract text
                    text = pytesseract.image_to_string(
                        pil_image,
                        lang=self.config['languages'],
                        config=self.config['tesseract_config']
                    )
                    
                    # Calculate average confidence
                    confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                    
                    results.append({
                        'method': method_name,
                        'text': text.strip(),
                        'confidence': avg_confidence,
                        'word_count': len([word for word in data['text'] if word.strip()]),
                        'data': data
                    })
                    
                except Exception as e:
                    logger.warning(f"OCR failed for method {method_name}: {e}")
                    continue
            
            # Select best result based on confidence and word count
            if results:
                best_result = max(results, key=lambda x: (x['confidence'], x['word_count']))
                return best_result
            else:
                raise Exception("All OCR methods failed")
                
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            raise
    
    def enhance_image_quality(self, image_path):
        """Enhance image quality using PIL"""
        try:
            with Image.open(image_path) as img:
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Enhance contrast
                enhancer = ImageEnhance.Contrast(img)
                img = enhancer.enhance(1.5)
                
                # Enhance sharpness
                enhancer = ImageEnhance.Sharpness(img)
                img = enhancer.enhance(2.0)
                
                # Apply unsharp mask
                img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
                
                return img
                
        except Exception as e:
            logger.error(f"Image enhancement failed: {e}")
            raise
    
    def detect_text_regions(self, image_path):
        """Detect text regions using EAST text detector or contours"""
        try:
            image = cv2.imread(image_path)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Use contour detection to find text regions
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # Find contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            text_regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter based on size (likely text regions)
                if w > 20 and h > 10 and w < image.shape[1] * 0.8:
                    text_regions.append({
                        'x': int(x),
                        'y': int(y),
                        'width': int(w),
                        'height': int(h),
                        'area': int(w * h)
                    })
            
            # Sort by area (largest first)
            text_regions.sort(key=lambda x: x['area'], reverse=True)
            
            return text_regions[:10]  # Return top 10 regions
            
        except Exception as e:
            logger.error(f"Text region detection failed: {e}")
            return []
    
    def process_document(self, image_path):
        """Main processing function"""
        try:
            logger.info(f"Processing document: {image_path}")
            
            # Extract text using multiple methods
            ocr_result = self.extract_text_multiple_methods(image_path)
            
            # Detect text regions
            text_regions = self.detect_text_regions(image_path)
            
            # Post-process text
            cleaned_text = self.post_process_text(ocr_result['text'])
            
            result = {
                'text': cleaned_text,
                'confidence': ocr_result['confidence'],
                'method_used': ocr_result['method'],
                'word_count': ocr_result['word_count'],
                'text_regions': text_regions,
                'raw_data': ocr_result['data'],
                'success': True
            }
            
            logger.info(f"OCR completed successfully. Confidence: {ocr_result['confidence']:.2f}%")
            return result
            
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            return {
                'text': '',
                'confidence': 0,
                'error': str(e),
                'success': False
            }
    
    def post_process_text(self, text):
        """Clean and post-process extracted text"""
        if not text:
            return text
        
        # Common OCR corrections for Indian documents
        corrections = {
            'Govemment': 'Government',
            'lndia': 'India',
            'Aadhar': 'Aadhaar',
            'Adhaar': 'Aadhaar',
            'DOB:': 'DOB:',
            'Name:': 'Name:',
            'Address:': 'Address:',
            'Father\'s Name:': 'Father\'s Name:',
            'PAN:': 'PAN:',
            'GSTIN:': 'GSTIN:',
            'Invoice No:': 'Invoice No:',
            'Date:': 'Date:',
            'Amount:': 'Amount:',
            'Total:': 'Total:'
        }
        
        # Apply corrections
        for wrong, correct in corrections.items():
            text = text.replace(wrong, correct)
        
        # Clean up whitespace
        text = ' '.join(text.split())
        
        return text

def main():
    parser = argparse.ArgumentParser(description='Advanced OCR processing')
    parser.add_argument('image_path', help='Path to the image file')
    parser.add_argument('--output', '-o', help='Output file path (optional)')
    
    args = parser.parse_args()
    
    try:
        ocr = AdvancedOCR()
        result = ocr.process_document(args.image_path)
        
        # Output result as JSON
        output = json.dumps(result, indent=2, ensure_ascii=False)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output)
        else:
            print(output)
            
    except Exception as e:
        error_result = {
            'text': '',
            'confidence': 0,
            'error': str(e),
            'success': False
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()