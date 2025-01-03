"""
Advanced text extraction module implementing pattern matching, field identification,
and structured data extraction from OCR results with enhanced validation and security.

External Dependencies:
numpy==1.24.0
re (built-in)
logging (built-in)
"""

import re
import numpy as np
import logging
from typing import Dict, Tuple, Any, Optional

from .ocr_engine import OCREngine
from ..models.document import Document
from ..utils.validation import validate_document_data, sanitize_sensitive_data

# Field patterns for different document types with comprehensive regex patterns
FIELD_PATTERNS = {
    'BANK_STATEMENT': {
        'account_number': r'Account\s*#?\s*[:\-]?\s*(\d{8,12})',
        'routing_number': r'Routing\s*#?\s*[:\-]?\s*(\d{9})',
        'balance': r'Balance[:\s]\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})',
        'monthly_revenue': r'Monthly\s+Revenue[:\s]\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})',
        'statement_date': r'(?:Statement|Date)[:\s](\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        'business_name': r'(?:Business|Company)[:\s]([A-Za-z0-9\s,\.]{3,100})'
    },
    'ISO_APPLICATION': {
        'business_name': r'(?:Business|DBA)[:\s]([A-Za-z0-9\s,\.]{3,100})',
        'ein': r'(?:EIN|Tax\s+ID)[:\s](\d{2}-\d{7})',
        'owner_name': r'(?:Owner|Principal)[:\s]([A-Za-z\s,\.]{3,100})',
        'ssn': r'(?:SSN|Social)[:\s](\d{3}-\d{2}-\d{4})',
        'phone': r'(?:Phone|Tel)[:\s]([\d\-\(\)\s]{10,})',
        'email': r'(?:Email|E-mail)[:\s]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
    },
    'VOIDED_CHECK': {
        'account_number': r'(?:Account|Acct)[:\s](\d{8,17})',
        'routing_number': r'(?:Routing|ABA)[:\s](\d{9})',
        'bank_name': r'([A-Za-z\s]{2,50})\s+BANK',
        'check_number': r'Check\s*#?\s*(\d{4,})'
    }
}

# Confidence thresholds for different document types
CONFIDENCE_THRESHOLDS = {
    'BANK_STATEMENT': 0.95,
    'ISO_APPLICATION': 0.90,
    'VOIDED_CHECK': 0.95
}

class TextExtractor:
    """
    Advanced text extraction class that processes OCR results with enhanced validation,
    confidence scoring, and secure data handling.
    """
    
    def __init__(self, ocr_engine: OCREngine):
        """
        Initialize text extractor with OCR engine and configuration.
        
        Args:
            ocr_engine: Configured OCR engine instance
        """
        self._ocr_engine = ocr_engine
        self._field_patterns = FIELD_PATTERNS
        self._confidence_thresholds = CONFIDENCE_THRESHOLDS
        self._logger = logging.getLogger(__name__)
        
        # Verify OCR engine configuration
        if not isinstance(ocr_engine, OCREngine):
            raise ValueError("Invalid OCR engine instance")

    def extract_structured_data(self, image: np.ndarray, document_type: str) -> Tuple[Dict[str, Any], float]:
        """
        Extracts structured data with enhanced validation and confidence scoring.
        
        Args:
            image: Input document image as numpy array
            document_type: Type of document being processed
            
        Returns:
            Tuple containing extracted data dictionary and confidence score
        """
        try:
            # Extract raw text with confidence scoring
            raw_text, confidence, metrics = self._ocr_engine.extract_text(
                image=image,
                enhance_preprocessing=True
            )
            
            # Get document-specific patterns
            patterns = self._field_patterns.get(document_type)
            if not patterns:
                raise ValueError(f"Unsupported document type: {document_type}")
            
            # Extract fields using patterns
            extracted_data = {}
            field_confidences = []
            
            for field_name, pattern in patterns.items():
                matches = re.finditer(pattern, raw_text)
                field_matches = [match.group(1) for match in matches if match.group(1)]
                
                if field_matches:
                    # Get field-specific confidence from OCR engine
                    field_confidence = metrics.get('confidence_score', confidence)
                    field_confidences.append(field_confidence)
                    
                    extracted_data[field_name] = {
                        'value': field_matches[0],
                        'confidence': field_confidence,
                        'alternatives': field_matches[1:] if len(field_matches) > 1 else []
                    }
            
            # Calculate overall confidence score
            overall_confidence = np.mean(field_confidences) if field_confidences else 0.0
            
            # Validate extracted data
            is_valid, errors, validation_metadata = validate_document_data(
                extracted_data=extracted_data,
                document_type=document_type
            )
            
            if not is_valid:
                self._logger.warning(f"Validation errors: {errors}")
                extracted_data['_validation_errors'] = errors
            
            # Add metadata
            extracted_data['_metadata'] = {
                'confidence_score': overall_confidence,
                'validation_result': is_valid,
                'processing_metrics': metrics,
                'validation_metadata': validation_metadata
            }
            
            return extracted_data, overall_confidence
            
        except Exception as e:
            self._logger.error(f"Structured data extraction error: {str(e)}")
            raise

    def extract_merchant_info(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Extracts merchant information with enhanced validation.
        
        Args:
            image: Input document image
            
        Returns:
            Dictionary containing validated merchant information
        """
        try:
            # Extract data using ISO application patterns
            extracted_data, confidence = self.extract_structured_data(
                image=image,
                document_type='ISO_APPLICATION'
            )
            
            # Validate confidence threshold
            if confidence < self._confidence_thresholds['ISO_APPLICATION']:
                self._logger.warning(f"Low confidence merchant extraction: {confidence}")
            
            # Extract merchant-specific fields
            merchant_info = {
                'business_name': extracted_data.get('business_name', {}).get('value'),
                'ein': extracted_data.get('ein', {}).get('value'),
                'owner_name': extracted_data.get('owner_name', {}).get('value'),
                'contact': {
                    'phone': extracted_data.get('phone', {}).get('value'),
                    'email': extracted_data.get('email', {}).get('value')
                }
            }
            
            # Sanitize sensitive data
            merchant_info = sanitize_sensitive_data(
                data=merchant_info,
                encryption_key=self._get_encryption_key()
            )
            
            return merchant_info
            
        except Exception as e:
            self._logger.error(f"Merchant info extraction error: {str(e)}")
            raise

    def extract_financial_data(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Extracts financial information with enhanced security.
        
        Args:
            image: Input document image
            
        Returns:
            Dictionary containing validated financial information
        """
        try:
            # Extract data using bank statement patterns
            extracted_data, confidence = self.extract_structured_data(
                image=image,
                document_type='BANK_STATEMENT'
            )
            
            # Validate confidence threshold
            if confidence < self._confidence_thresholds['BANK_STATEMENT']:
                self._logger.warning(f"Low confidence financial extraction: {confidence}")
            
            # Extract financial fields
            financial_info = {
                'account_number': extracted_data.get('account_number', {}).get('value'),
                'routing_number': extracted_data.get('routing_number', {}).get('value'),
                'balance': self._parse_amount(
                    extracted_data.get('balance', {}).get('value', '0')
                ),
                'monthly_revenue': self._parse_amount(
                    extracted_data.get('monthly_revenue', {}).get('value', '0')
                ),
                'statement_date': extracted_data.get('statement_date', {}).get('value')
            }
            
            # Sanitize sensitive financial data
            financial_info = sanitize_sensitive_data(
                data=financial_info,
                encryption_key=self._get_encryption_key()
            )
            
            return financial_info
            
        except Exception as e:
            self._logger.error(f"Financial data extraction error: {str(e)}")
            raise

    def validate_extraction(self, extracted_data: Dict[str, Any], 
                          confidence_score: float, 
                          document_type: str) -> Tuple[bool, str]:
        """
        Validates extracted data with enhanced confidence scoring.
        
        Args:
            extracted_data: Dictionary of extracted data
            confidence_score: Overall confidence score
            document_type: Type of document
            
        Returns:
            Tuple containing validation status and message
        """
        try:
            # Check confidence threshold
            threshold = self._confidence_thresholds.get(document_type, 0.9)
            if confidence_score < threshold:
                return False, f"Confidence score {confidence_score} below threshold {threshold}"
            
            # Validate required fields
            patterns = self._field_patterns.get(document_type, {})
            missing_fields = [
                field for field in patterns.keys()
                if field not in extracted_data or not extracted_data[field].get('value')
            ]
            
            if missing_fields:
                return False, f"Missing required fields: {', '.join(missing_fields)}"
            
            # Validate field formats
            for field, data in extracted_data.items():
                if field.startswith('_'):  # Skip metadata fields
                    continue
                    
                value = data.get('value')
                if not value:
                    continue
                    
                # Check field-specific patterns
                pattern = patterns.get(field)
                if pattern and not re.match(pattern, value):
                    return False, f"Invalid format for field: {field}"
            
            return True, "Validation successful"
            
        except Exception as e:
            self._logger.error(f"Validation error: {str(e)}")
            return False, f"Validation error: {str(e)}"

    def _parse_amount(self, amount_str: str) -> float:
        """Parses financial amount strings to float values."""
        try:
            # Remove currency symbols and commas
            cleaned = re.sub(r'[$,]', '', amount_str)
            return float(cleaned)
        except (ValueError, TypeError):
            return 0.0

    def _get_encryption_key(self) -> str:
        """Retrieves encryption key for sensitive data handling."""
        # In a production environment, this would retrieve from secure storage
        return "YOUR_ENCRYPTION_KEY"  # Placeholder for demo