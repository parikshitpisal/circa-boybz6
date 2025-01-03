"""
Advanced OCR engine module for document text extraction with field-level validation.
Implements high-accuracy OCR processing for both printed and handwritten text.

External Dependencies:
pytesseract==0.3.10
numpy==1.24.0
"""

import pytesseract
import numpy as np
import logging
from typing import Dict, Tuple, List, Optional
import re

from ..utils.image_utils import optimize_for_ocr, validate_image
from ..models.document import Document

# Configure logging
logger = logging.getLogger(__name__)

# Global OCR configuration
OCR_CONFIG = '--oem 3 --psm 3 -l eng --dpi 300'
CONFIDENCE_THRESHOLD = 95.0
MAX_RETRIES = 3
SUPPORTED_LANGUAGES = ['eng']

# Field validation patterns
FIELD_PATTERNS = {
    'business_name': r'^[A-Za-z0-9\s,.-]+$',
    'ein': r'^\d{2}-\d{7}$',
    'ssn': r'^\d{3}-\d{2}-\d{4}$'
}

# Common OCR error patterns for correction
ERROR_PATTERNS = {
    'O0': {'pattern': r'[oO]', 'replacement': '0'},
    'I1': {'pattern': r'[iIl]', 'replacement': '1'},
    'S5': {'pattern': r'[sS]', 'replacement': '5'}
}

class OCREngine:
    """
    Advanced OCR engine class that handles document text extraction with 
    field-level confidence scoring and pattern-based validation.
    """
    
    def __init__(self, 
                config: str = OCR_CONFIG,
                confidence_threshold: float = CONFIDENCE_THRESHOLD,
                supported_languages: List[str] = SUPPORTED_LANGUAGES,
                field_patterns: Dict[str, str] = FIELD_PATTERNS,
                error_patterns: Dict[str, Dict] = ERROR_PATTERNS):
        """
        Initialize OCR engine with enhanced configuration and validation patterns.
        
        Args:
            config: Tesseract OCR configuration string
            confidence_threshold: Minimum confidence score for validation
            supported_languages: List of supported OCR languages
            field_patterns: Dictionary of field validation patterns
            error_patterns: Dictionary of common OCR error patterns
        """
        self._config = config
        self._confidence_threshold = confidence_threshold
        self._supported_languages = supported_languages
        self._field_patterns = field_patterns
        self._error_patterns = error_patterns
        self._logger = logging.getLogger(__name__)
        
        # Verify Tesseract installation
        try:
            pytesseract.get_tesseract_version()
        except Exception as e:
            self._logger.error(f"Tesseract initialization error: {str(e)}")
            raise RuntimeError("Failed to initialize Tesseract OCR engine")

    def extract_text(self, 
                    image: np.ndarray,
                    language: str = 'eng',
                    enhance_preprocessing: bool = True) -> Tuple[str, float, Dict]:
        """
        Extracts text from document image using OCR with enhanced preprocessing.
        
        Args:
            image: Input image as numpy array
            language: OCR language
            enhance_preprocessing: Whether to apply advanced preprocessing
            
        Returns:
            Tuple containing (extracted_text, confidence_score, metrics)
        """
        try:
            # Validate image
            valid, message = validate_image(image)
            if not valid:
                raise ValueError(f"Invalid image: {message}")
            
            # Validate language
            if language not in self._supported_languages:
                raise ValueError(f"Unsupported language: {language}")
            
            # Apply preprocessing if enabled
            if enhance_preprocessing:
                processed_image = optimize_for_ocr(image)
            else:
                processed_image = image
            
            # Perform OCR with retries
            for attempt in range(MAX_RETRIES):
                try:
                    # Extract text with detailed data
                    ocr_data = pytesseract.image_to_data(
                        processed_image,
                        config=self._config,
                        output_type=pytesseract.Output.DICT
                    )
                    
                    # Calculate confidence score
                    confidences = [float(conf) for conf in ocr_data['conf'] if conf != '-1']
                    avg_confidence = np.mean(confidences) if confidences else 0.0
                    
                    # Extract text
                    text = ' '.join([word for word in ocr_data['text'] if word.strip()])
                    
                    # Apply error pattern correction
                    for error in self._error_patterns.values():
                        text = re.sub(error['pattern'], error['replacement'], text)
                    
                    # Generate metrics
                    metrics = {
                        'confidence_score': avg_confidence,
                        'word_count': len(ocr_data['text']),
                        'processing_attempts': attempt + 1,
                        'enhancement_applied': enhance_preprocessing
                    }
                    
                    return text, avg_confidence, metrics
                    
                except Exception as e:
                    if attempt == MAX_RETRIES - 1:
                        raise
                    self._logger.warning(f"OCR attempt {attempt + 1} failed: {str(e)}")
                    
        except Exception as e:
            self._logger.error(f"Text extraction error: {str(e)}")
            raise

    def extract_structured_fields(self,
                                image: np.ndarray,
                                field_patterns: Optional[Dict[str, str]] = None,
                                strict_validation: bool = True) -> Dict:
        """
        Extracts structured fields from document using pattern matching and validation.
        
        Args:
            image: Input image as numpy array
            field_patterns: Optional custom field patterns
            strict_validation: Whether to apply strict validation rules
            
        Returns:
            Dictionary of extracted fields with confidence scores
        """
        try:
            # Use provided patterns or defaults
            patterns = field_patterns or self._field_patterns
            
            # Extract full text
            text, confidence, metrics = self.extract_text(image, enhance_preprocessing=True)
            
            # Initialize results
            results = {}
            
            # Extract and validate each field
            for field_name, pattern in patterns.items():
                matches = re.finditer(pattern, text)
                field_matches = [match.group() for match in matches]
                
                if field_matches:
                    # Get field-specific confidence
                    field_confidence = self._calculate_field_confidence(
                        field_matches[0], confidence, strict_validation
                    )
                    
                    # Apply error correction
                    corrected_value = self._apply_error_correction(field_matches[0])
                    
                    results[field_name] = {
                        'value': corrected_value,
                        'confidence': field_confidence,
                        'validated': field_confidence >= self._confidence_threshold
                    }
                else:
                    results[field_name] = {
                        'value': None,
                        'confidence': 0.0,
                        'validated': False
                    }
            
            return results
            
        except Exception as e:
            self._logger.error(f"Field extraction error: {str(e)}")
            raise

    def validate_results(self,
                        text: str,
                        confidence: float,
                        field_validations: Dict) -> Tuple[bool, str, Dict]:
        """
        Validates OCR results with enhanced pattern matching and error detection.
        
        Args:
            text: Extracted text
            confidence: Overall confidence score
            field_validations: Field-specific validation results
            
        Returns:
            Tuple of (is_valid, validation_message, validation_metrics)
        """
        try:
            validation_metrics = {
                'overall_confidence': confidence,
                'fields_validated': 0,
                'fields_failed': 0,
                'validation_details': {}
            }
            
            # Check overall confidence
            if confidence < self._confidence_threshold:
                return False, f"Confidence below threshold: {confidence}", validation_metrics
            
            # Validate each field
            for field_name, validation in field_validations.items():
                field_valid = validation.get('validated', False)
                field_confidence = validation.get('confidence', 0.0)
                
                validation_metrics['validation_details'][field_name] = {
                    'valid': field_valid,
                    'confidence': field_confidence
                }
                
                if field_valid:
                    validation_metrics['fields_validated'] += 1
                else:
                    validation_metrics['fields_failed'] += 1
            
            # Determine overall validation status
            is_valid = (validation_metrics['fields_failed'] == 0 and 
                       confidence >= self._confidence_threshold)
            
            message = ("Validation successful" if is_valid else 
                      f"Validation failed: {validation_metrics['fields_failed']} fields failed")
            
            return is_valid, message, validation_metrics
            
        except Exception as e:
            self._logger.error(f"Validation error: {str(e)}")
            raise

    def _calculate_field_confidence(self,
                                  field_value: str,
                                  overall_confidence: float,
                                  strict: bool) -> float:
        """Calculate confidence score for a specific field."""
        base_confidence = overall_confidence
        
        # Apply stricter confidence calculation if enabled
        if strict:
            # Reduce confidence for potential error patterns
            for error in self._error_patterns.values():
                if re.search(error['pattern'], field_value):
                    base_confidence *= 0.9
            
            # Reduce confidence for unusual patterns
            if re.search(r'[^A-Za-z0-9\s\-\.]', field_value):
                base_confidence *= 0.85
        
        return round(base_confidence, 2)

    def _apply_error_correction(self, text: str) -> str:
        """Apply error correction patterns to extracted text."""
        corrected = text
        for error in self._error_patterns.values():
            corrected = re.sub(error['pattern'], error['replacement'], corrected)
        return corrected