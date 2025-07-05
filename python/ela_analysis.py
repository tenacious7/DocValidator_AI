#!/usr/bin/env python3
"""
Error Level Analysis (ELA) implementation for forgery detection
"""

import sys
import json
import numpy as np
from PIL import Image, ImageChops
import io
import base64

def perform_ela(image1_b64, image2_b64, quality=90):
    """
    Perform Error Level Analysis between two images
    """
    try:
        # Decode base64 images
        image1_data = base64.b64decode(image1_b64)
        image2_data = base64.b64decode(image2_b64)
        
        # Load images
        img1 = Image.open(io.BytesIO(image1_data))
        img2 = Image.open(io.BytesIO(image2_data))
        
        # Ensure same size
        if img1.size != img2.size:
            img2 = img2.resize(img1.size, Image.Resampling.LANCZOS)
        
        # Convert to RGB if necessary
        if img1.mode != 'RGB':
            img1 = img1.convert('RGB')
        if img2.mode != 'RGB':
            img2 = img2.convert('RGB')
        
        # Calculate difference
        diff = ImageChops.difference(img1, img2)
        
        # Enhance the difference
        extrema = diff.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        
        if max_diff == 0:
            # No difference found
            scale = 1
        else:
            scale = 255.0 / max_diff
        
        # Scale the difference
        ela_image = diff.point(lambda x: x * scale)
        
        # Convert to bytes
        output_buffer = io.BytesIO()
        ela_image.save(output_buffer, format='JPEG', quality=quality)
        ela_bytes = output_buffer.getvalue()
        
        return ela_bytes
        
    except Exception as e:
        raise Exception(f"ELA calculation failed: {str(e)}")

def analyze_ela_statistics(ela_image_data):
    """
    Analyze ELA image statistics
    """
    try:
        img = Image.open(io.BytesIO(ela_image_data))
        
        # Convert to numpy array
        img_array = np.array(img)
        
        # Calculate statistics
        mean = np.mean(img_array)
        std = np.std(img_array)
        max_val = np.max(img_array)
        min_val = np.min(img_array)
        
        # Calculate histogram
        hist, bins = np.histogram(img_array.flatten(), bins=256, range=(0, 256))
        
        # Find peaks in histogram (potential tampering indicators)
        peaks = []
        for i in range(1, len(hist) - 1):
            if hist[i] > hist[i-1] and hist[i] > hist[i+1] and hist[i] > mean:
                peaks.append(i)
        
        return {
            'mean': float(mean),
            'std': float(std),
            'max': int(max_val),
            'min': int(min_val),
            'peaks': peaks,
            'histogram': hist.tolist()
        }
        
    except Exception as e:
        raise Exception(f"ELA statistics analysis failed: {str(e)}")

def detect_tampering_regions(ela_image_data, threshold=50):
    """
    Detect potential tampering regions in ELA image
    """
    try:
        img = Image.open(io.BytesIO(ela_image_data))
        img_array = np.array(img.convert('L'))  # Convert to grayscale
        
        # Find regions with high ELA values
        high_ela_mask = img_array > threshold
        
        # Find connected components
        from scipy import ndimage
        labeled_array, num_features = ndimage.label(high_ela_mask)
        
        regions = []
        for i in range(1, num_features + 1):
            region_mask = labeled_array == i
            coords = np.where(region_mask)
            
            if len(coords[0]) > 100:  # Minimum region size
                y_min, y_max = np.min(coords[0]), np.max(coords[0])
                x_min, x_max = np.min(coords[1]), np.max(coords[1])
                
                regions.append({
                    'x': int(x_min),
                    'y': int(y_min),
                    'width': int(x_max - x_min),
                    'height': int(y_max - y_min),
                    'area': int(np.sum(region_mask)),
                    'avg_intensity': float(np.mean(img_array[region_mask]))
                })
        
        return regions
        
    except Exception as e:
        # Fallback without scipy
        img = Image.open(io.BytesIO(ela_image_data))
        img_array = np.array(img.convert('L'))
        
        # Simple thresholding approach
        high_ela_mask = img_array > threshold
        coords = np.where(high_ela_mask)
        
        if len(coords[0]) > 0:
            y_min, y_max = np.min(coords[0]), np.max(coords[0])
            x_min, x_max = np.min(coords[1]), np.max(coords[1])
            
            return [{
                'x': int(x_min),
                'y': int(y_min),
                'width': int(x_max - x_min),
                'height': int(y_max - y_min),
                'area': int(np.sum(high_ela_mask)),
                'avg_intensity': float(np.mean(img_array[high_ela_mask]))
            }]
        
        return []

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        image1_b64 = data['image1']
        image2_b64 = data['image2']
        quality = data.get('quality', 90)
        
        # Perform ELA
        ela_bytes = perform_ela(image1_b64, image2_b64, quality)
        
        # Analyze statistics
        stats = analyze_ela_statistics(ela_bytes)
        
        # Detect tampering regions
        regions = detect_tampering_regions(ela_bytes)
        
        # Output ELA image as bytes to stdout
        sys.stdout.buffer.write(ela_bytes)
        
        # Send statistics to stderr as JSON
        result = {
            'statistics': stats,
            'tampering_regions': regions,
            'success': True
        }
        
        sys.stderr.write(json.dumps(result) + '\n')
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'success': False
        }
        sys.stderr.write(json.dumps(error_result) + '\n')
        sys.exit(1)

if __name__ == '__main__':
    main()