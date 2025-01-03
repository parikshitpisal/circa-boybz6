"""
Advanced image preprocessing and optimization utilities for OCR processing.
Implements sophisticated techniques for document enhancement to achieve >95% OCR accuracy.

External Dependencies:
opencv-python==4.8.0
numpy==1.24.0
Pillow==9.5.0
"""

import cv2
import numpy as np
from PIL import Image
import logging
from functools import wraps
from typing import Tuple, Dict, List, Union

# Configure logging
logger = logging.getLogger(__name__)

# Global Constants
DEFAULT_DPI = 300
MIN_IMAGE_SIZE = (800, 600)
MAX_IMAGE_SIZE = (4096, 4096)
SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'tiff', 'bmp']

def validate_input(func):
    """Decorator for input validation and error handling."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            if len(args) > 1 and not isinstance(args[0], np.ndarray):
                raise ValueError("Input must be a numpy.ndarray")
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}")
            raise
    return wrapper

def validate_image(image: np.ndarray) -> Tuple[bool, str]:
    """
    Comprehensive image validation with quality checks.
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Tuple of (validation_result, detailed_message)
    """
    try:
        # Basic validation
        if not isinstance(image, np.ndarray):
            return False, "Invalid image type"
            
        # Dimension validation
        height, width = image.shape[:2]
        if (width < MIN_IMAGE_SIZE[0] or height < MIN_IMAGE_SIZE[1] or
            width > MAX_IMAGE_SIZE[0] or height > MAX_IMAGE_SIZE[1]):
            return False, f"Image dimensions ({width}x{height}) outside acceptable range"
            
        # Content validation
        if len(image.shape) not in [2, 3]:
            return False, "Invalid number of channels"
            
        # Quality metrics
        if len(image.shape) == 2:
            contrast = np.std(image)
            if contrast < 20:  # Minimum contrast threshold
                return False, "Insufficient contrast"
                
        return True, "Image validation successful"
        
    except Exception as e:
        logger.error(f"Image validation error: {str(e)}")
        return False, f"Validation error: {str(e)}"

@validate_input
def deskew(image: np.ndarray) -> np.ndarray:
    """
    Advanced document skew correction using multiple detection methods.
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Deskewed image as numpy array
    """
    try:
        # Convert to grayscale if needed
        gray = image if len(image.shape) == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Edge detection
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        
        # Line detection using probabilistic Hough transform
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
        
        if lines is None or len(lines) == 0:
            logger.warning("No lines detected for deskewing")
            return image
            
        # Calculate angles and find dominant angle
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if x2 - x1 != 0:  # Avoid division by zero
                angle = np.arctan2(y2 - y1, x2 - x1) * 180.0 / np.pi
                angles.append(angle)
                
        if not angles:
            return image
            
        # Get median angle for robustness
        median_angle = np.median(angles)
        
        # Rotate image
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        rotated = cv2.warpAffine(image, rotation_matrix, (w, h),
                                flags=cv2.INTER_CUBIC,
                                borderMode=cv2.BORDER_REPLICATE)
                                
        return rotated
        
    except Exception as e:
        logger.error(f"Deskewing error: {str(e)}")
        return image

@validate_input
def enhance_contrast(image: np.ndarray, clip_limit: float = 2.0) -> np.ndarray:
    """
    Region-adaptive contrast enhancement optimized for document images.
    
    Args:
        image: Input image as numpy array
        clip_limit: Contrast limit for CLAHE
        
    Returns:
        Contrast-enhanced image
    """
    try:
        # Convert to LAB color space for better enhancement
        if len(image.shape) == 3:
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
        else:
            l = image
            
        # Create CLAHE object
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
        
        # Apply CLAHE to luminance channel
        enhanced_l = clahe.apply(l)
        
        # Reconstruct image
        if len(image.shape) == 3:
            enhanced_lab = cv2.merge([enhanced_l, a, b])
            enhanced = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        else:
            enhanced = enhanced_l
            
        return enhanced
        
    except Exception as e:
        logger.error(f"Contrast enhancement error: {str(e)}")
        return image

@validate_input
def remove_noise(image: np.ndarray) -> np.ndarray:
    """
    Multi-stage noise reduction with text preservation.
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Noise-reduced image
    """
    try:
        # Initial denoising with edge preservation
        denoised = cv2.fastNlMeansDenoising(image) if len(image.shape) == 2 else \
                  cv2.fastNlMeansDenoisingColored(image)
                  
        # Bilateral filtering for edge preservation
        bilateral = cv2.bilateralFilter(denoised, d=9, sigmaColor=75, sigmaSpace=75)
        
        # Median filtering for remaining noise
        median = cv2.medianBlur(bilateral, 3)
        
        # Remove small artifacts
        kernel = np.ones((3,3), np.uint8)
        cleaned = cv2.morphologyEx(median, cv2.MORPH_OPEN, kernel)
        
        return cleaned
        
    except Exception as e:
        logger.error(f"Noise removal error: {str(e)}")
        return image

@validate_input
def optimize_for_ocr(image: np.ndarray, options: Dict = None) -> np.ndarray:
    """
    Advanced image optimization pipeline for OCR processing.
    
    Args:
        image: Input image as numpy array
        options: Dictionary of optimization parameters
        
    Returns:
        Optimized image ready for OCR processing
    """
    try:
        # Initialize options
        options = options or {}
        
        # Validate input image
        valid, message = validate_image(image)
        if not valid:
            raise ValueError(f"Invalid input image: {message}")
            
        # Convert to grayscale if needed
        gray = image if len(image.shape) == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply optimization pipeline
        # 1. Deskew document
        deskewed = deskew(gray)
        
        # 2. Remove noise
        denoised = remove_noise(deskewed)
        
        # 3. Enhance contrast
        enhanced = enhance_contrast(denoised, 
                                 clip_limit=options.get('clip_limit', 2.0))
        
        # 4. Apply adaptive thresholding
        binary = cv2.adaptiveThreshold(enhanced, 255,
                                     cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY,
                                     blockSize=11,
                                     C=2)
        
        # 5. Final cleanup
        kernel = np.ones((2,2), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        # Log optimization results
        logger.info("Image optimization completed successfully")
        
        return cleaned
        
    except Exception as e:
        logger.error(f"Image optimization error: {str(e)}")
        raise