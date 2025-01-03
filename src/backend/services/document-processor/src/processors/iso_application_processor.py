"""
Enhanced ISO application document processor implementing advanced OCR and data extraction
with high accuracy requirements and PII data protection.

External Dependencies:
numpy==1.24.0
logging (built-in)
"""

import numpy as np
import logging
from typing import Dict, Tuple, Any, Optional
from datetime import datetime, timezone
from functools import wraps

from ..core.text_extractor import TextExtractor
from ..models.document import Document
from ..core.document_classifier import DocumentClassifier
from ..utils.validation import validate_document_data, sanitize_sensitive_data

# Function decorators for logging and validation
def log_execution(func):
    """Decorator for secure logging of function execution."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger = logging.getLogger(__name__)
        try:
            logger.info(f"Starting {func.__name__}")
            result = func(*args, **kwargs)
            logger.info(f"Completed {func.__name__}")
            return result
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}")
            raise
    return wrapper

def validate_input(func):
    """Decorator for input validation."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        if len(args) > 1 and not isinstance(args[1], np.ndarray):
            raise ValueError("Input image must be a numpy.ndarray")
        if len(args) > 2 and not isinstance(args[2], Document):
            raise ValueError("Input must be a Document instance")
        return func(*args, **kwargs)
    return wrapper

# Global constants for field patterns and validation
ISO_FIELD_PATTERNS = {
    'business_name': r'Business\s*Name[:\s]([\w\s&,\-\.]+)',
    'ein': r'EIN[:\s](\d{2}-\d{7})',
    'dba': r'DBA[:\s]([\w\s&,\-\.]+)',
    'owner_name': r'Owner\s*Name[:\s]([\w\s\.]+)',
    'ssn': r'SSN[:\s](\d{3}-\d{2}-\d{4})',
    'phone': r'Phone[:\s](\d{3}-\d{3}-\d{4})',
    'email': r'Email[:\s]([\w\.\-]+@[\w\.\-]+\.[\\w]{2,})',
    'address': r'Address[:\s]([\w\s,\-\.]+)',
    'tax_id': r'Tax\s*ID[:\s]([\w\-]+)',
    'business_type': r'Business\s*Type[:\s]([\w\s]+)'
}

CONFIDENCE_THRESHOLD = 0.9
MAX_RETRIES = 3
SENSITIVE_FIELDS = ['ssn', 'tax_id', 'ein']

class ISOApplicationProcessor:
    """
    Enhanced processor class for handling ISO application documents with specialized
    field extraction and PII protection.
    """
    
    def __init__(self, text_extractor: TextExtractor, classifier: DocumentClassifier, config: Dict):
        """
        Initialize ISO application processor with required dependencies.
        
        Args:
            text_extractor: TextExtractor instance for OCR processing
            classifier: DocumentClassifier instance for validation
            config: Configuration dictionary
        """
        self._text_extractor = text_extractor
        self._classifier = classifier
        self._logger = logging.getLogger(__name__)
        
        # Initialize field patterns and validation rules
        self._field_patterns = ISO_FIELD_PATTERNS
        self._confidence_threshold = config.get('confidence_threshold', CONFIDENCE_THRESHOLD)
        self._max_retries = config.get('max_retries', MAX_RETRIES)
        
        # Initialize extraction cache for optimization
        self._extraction_cache = {}
        
        # Configure secure logging
        self._logger.setLevel(logging.INFO)

    @log_execution
    @validate_input
    def process_document(self, image: np.ndarray, document: Document) -> Tuple[Dict[str, Any], float]:
        """
        Process ISO application document with enhanced validation and security.
        
        Args:
            image: Input document image as numpy array
            document: Document instance for metadata updates
            
        Returns:
            Tuple containing extracted data dictionary and confidence score
        """
        try:
            # Validate document type
            doc_type, confidence, metadata = self._classifier.classify_document(image, document)
            if doc_type != 'ISO_APPLICATION':
                raise ValueError(f"Invalid document type: {doc_type}")
            
            # Extract text with confidence scoring
            extracted_text, ocr_confidence, metrics = self._text_extractor.extract_text(
                image=image,
                enhance_preprocessing=True
            )
            
            # Extract merchant information
            merchant_info = self._text_extractor.extract_merchant_info(image)
            
            # Extract and validate owner information
            owner_info = self.extract_owner_info(merchant_info)
            
            # Combine all extracted data
            extracted_data = {
                'merchant_info': merchant_info,
                'owner_info': owner_info,
                'metadata': {
                    'ocr_confidence': ocr_confidence,
                    'classification_confidence': confidence,
                    'processing_metrics': metrics
                }
            }
            
            # Validate extracted data
            is_valid = self.validate_application_data(extracted_data, ocr_confidence)
            
            # Update document metadata
            document.update_metadata({
                'extraction_results': {
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'confidence_score': ocr_confidence,
                    'validation_status': is_valid,
                    'processing_metrics': metrics
                }
            })
            
            # Sanitize sensitive data before returning
            sanitized_data = sanitize_sensitive_data(
                data=extracted_data,
                encryption_key=document.security_context.get('encryption_key', '')
            )
            
            return sanitized_data, ocr_confidence
            
        except Exception as e:
            self._logger.error(f"Document processing error: {str(e)}")
            document.update_status('FAILED', f"Processing error: {str(e)}")
            raise

    def extract_owner_info(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Securely extract and validate owner information.
        
        Args:
            extracted_data: Dictionary containing extracted data
            
        Returns:
            Dictionary containing validated owner information
        """
        try:
            owner_info = {}
            
            # Extract and validate owner name
            if 'owner_name' in extracted_data:
                owner_info['name'] = extracted_data['owner_name']
            
            # Securely extract and mask SSN
            if 'ssn' in extracted_data:
                ssn = extracted_data['ssn']
                owner_info['ssn'] = f"XXX-XX-{ssn[-4:]}" if len(ssn) == 11 else None
            
            # Extract and validate contact information
            if 'phone' in extracted_data:
                owner_info['phone'] = extracted_data['phone']
            if 'email' in extracted_data:
                owner_info['email'] = extracted_data['email']
            
            # Validate owner information completeness
            required_fields = ['name', 'ssn']
            missing_fields = [field for field in required_fields if field not in owner_info]
            
            if missing_fields:
                self._logger.warning(f"Missing owner information fields: {missing_fields}")
                owner_info['_validation'] = {
                    'status': 'incomplete',
                    'missing_fields': missing_fields
                }
            else:
                owner_info['_validation'] = {
                    'status': 'complete',
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
            
            return owner_info
            
        except Exception as e:
            self._logger.error(f"Owner information extraction error: {str(e)}")
            raise

    def validate_application_data(self, data: Dict[str, Any], confidence_score: float) -> bool:
        """
        Validate extracted application data with business rules.
        
        Args:
            data: Dictionary containing extracted data
            confidence_score: OCR confidence score
            
        Returns:
            Boolean indicating validation success
        """
        try:
            # Check confidence threshold
            if confidence_score < self._confidence_threshold:
                self._logger.warning(f"Confidence score {confidence_score} below threshold")
                return False
            
            # Validate merchant information
            merchant_info = data.get('merchant_info', {})
            required_merchant_fields = ['business_name', 'ein', 'business_type']
            missing_merchant_fields = [
                field for field in required_merchant_fields 
                if field not in merchant_info
            ]
            
            if missing_merchant_fields:
                self._logger.warning(f"Missing merchant fields: {missing_merchant_fields}")
                return False
            
            # Validate owner information
            owner_info = data.get('owner_info', {})
            if owner_info.get('_validation', {}).get('status') != 'complete':
                self._logger.warning("Incomplete owner information")
                return False
            
            # Validate field formats
            for field, value in merchant_info.items():
                if field in self._field_patterns:
                    pattern = self._field_patterns[field]
                    if not value or not re.match(pattern, str(value)):
                        self._logger.warning(f"Invalid format for field: {field}")
                        return False
            
            return True
            
        except Exception as e:
            self._logger.error(f"Data validation error: {str(e)}")
            return False