"""
Advanced processor for voided check documents with enhanced validation, security,
and monitoring features.

External Dependencies:
numpy==1.24.0
logging (built-in)
re (built-in)
"""

import numpy as np
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional

from ...core.ocr_engine import OCREngine
from ...core.text_extractor import TextExtractor
from ...models.document import Document
from ...utils.validation import validate_document_data, sanitize_sensitive_data

# Field validation patterns for voided checks
FIELD_PATTERNS = {
    'routing_number': r'^[0-9]{9}$',
    'account_number': r'^[0-9]{8,17}$',
    'bank_name': r"[A-Za-z\s&-']+(?:Bank|Credit Union|Financial|N\.A\.|National Association)",
    'check_number': r'^[0-9]{4,6}$',
    'micr_line': r'^[A-Z0-9\s⑈⑆]+$'
}

# Confidence threshold for voided check processing
CONFIDENCE_THRESHOLD = 0.95

# Required fields for voided check validation
REQUIRED_FIELDS = ['routing_number', 'account_number', 'bank_name']

# Processing configuration
MAX_RETRIES = 3
PROCESSING_TIMEOUT = 300  # seconds

class VoidedCheckProcessor:
    """
    Advanced processor class for handling voided check documents with enhanced validation,
    security, and monitoring features.
    """

    def __init__(self, ocr_engine: OCREngine, text_extractor: TextExtractor, config: Dict[str, Any]):
        """
        Initialize voided check processor with enhanced configuration.

        Args:
            ocr_engine: Configured OCR engine instance
            text_extractor: Text extraction instance
            config: Configuration dictionary
        """
        self._ocr_engine = ocr_engine
        self._text_extractor = text_extractor
        self._logger = logging.getLogger(__name__)
        
        # Initialize validation rules
        self._validation_rules = {
            'patterns': FIELD_PATTERNS,
            'confidence_threshold': config.get('confidence_threshold', CONFIDENCE_THRESHOLD),
            'required_fields': REQUIRED_FIELDS,
            'max_retries': config.get('max_retries', MAX_RETRIES)
        }
        
        # Initialize processing metrics
        self._processing_metrics = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'average_confidence': 0.0,
            'processing_times': []
        }

    def process(self, document: Document, image: np.ndarray) -> Dict[str, Any]:
        """
        Processes a voided check document with enhanced validation and security.

        Args:
            document: Document instance to process
            image: Input image as numpy array

        Returns:
            Dictionary containing extracted banking information with confidence scores
        """
        start_time = datetime.now(timezone.utc)
        self._logger.info(f"Starting voided check processing for document {document.id}")

        try:
            # Update document status
            document.update_status('PROCESSING')

            # Validate input image
            preprocessed_image = self._ocr_engine.preprocess_image(image)

            # Extract text with confidence scoring
            text, confidence, metrics = self._ocr_engine.extract_text(
                preprocessed_image,
                enhance_preprocessing=True
            )

            # Extract banking information
            banking_info = self.extract_banking_info(text, self._validation_rules['confidence_threshold'])

            # Validate extracted fields
            is_valid, validation_message, validation_results = self.validate_fields(banking_info)

            # Update document metadata
            document.update_metadata({
                'processing_metrics': metrics,
                'validation_results': validation_results,
                'confidence_score': confidence,
                'processing_duration': (datetime.now(timezone.utc) - start_time).total_seconds()
            })

            # Update document status based on validation
            if is_valid:
                document.update_status('COMPLETED')
                self._processing_metrics['successful'] += 1
            else:
                document.update_status('FAILED', validation_message)
                self._processing_metrics['failed'] += 1

            # Update processing metrics
            self._update_metrics(confidence, start_time)

            # Sanitize sensitive data before returning
            return sanitize_sensitive_data(banking_info, document.security_context['encryption_key'])

        except Exception as e:
            self._logger.error(f"Error processing voided check: {str(e)}")
            document.update_status('FAILED', str(e))
            self._processing_metrics['failed'] += 1
            raise

    def validate_fields(self, extracted_data: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Enhanced field validation with business rules and security checks.

        Args:
            extracted_data: Dictionary of extracted field data

        Returns:
            Tuple containing validation status, message, and validation details
        """
        validation_results = {
            'timestamp': datetime.now(timezone.utc),
            'fields_validated': [],
            'validation_errors': []
        }

        # Check required fields
        missing_fields = [field for field in self._validation_rules['required_fields'] 
                         if field not in extracted_data]
        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}", validation_results

        # Validate routing number
        if 'routing_number' in extracted_data:
            routing_number = extracted_data['routing_number']
            if not re.match(self._validation_rules['patterns']['routing_number'], routing_number):
                validation_results['validation_errors'].append("Invalid routing number format")
            else:
                # Validate routing number checksum
                if not self._validate_routing_number(routing_number):
                    validation_results['validation_errors'].append("Invalid routing number checksum")
            validation_results['fields_validated'].append('routing_number')

        # Validate account number
        if 'account_number' in extracted_data:
            account_number = extracted_data['account_number']
            if not re.match(self._validation_rules['patterns']['account_number'], account_number):
                validation_results['validation_errors'].append("Invalid account number format")
            validation_results['fields_validated'].append('account_number')

        # Validate bank name
        if 'bank_name' in extracted_data:
            bank_name = extracted_data['bank_name']
            if not re.match(self._validation_rules['patterns']['bank_name'], bank_name):
                validation_results['validation_errors'].append("Invalid bank name format")
            validation_results['fields_validated'].append('bank_name')

        is_valid = len(validation_results['validation_errors']) == 0
        message = "Validation successful" if is_valid else f"Validation failed: {validation_results['validation_errors']}"

        return is_valid, message, validation_results

    def extract_banking_info(self, text: str, confidence_threshold: float) -> Dict[str, Any]:
        """
        Extracts banking information with enhanced security and validation.

        Args:
            text: Extracted text from document
            confidence_threshold: Minimum confidence threshold

        Returns:
            Dictionary containing secured banking information
        """
        banking_info = {}
        
        try:
            # Extract MICR line data
            micr_matches = re.finditer(self._validation_rules['patterns']['micr_line'], text)
            micr_data = next(micr_matches, None)
            
            if micr_data:
                micr_text = micr_data.group()
                
                # Extract routing number
                routing_matches = re.search(r'⑆(\d{9})⑆', micr_text)
                if routing_matches:
                    banking_info['routing_number'] = routing_matches.group(1)
                
                # Extract account number
                account_matches = re.search(r'⑆\d{9}⑆\s*(\d{8,17})', micr_text)
                if account_matches:
                    banking_info['account_number'] = account_matches.group(1)

            # Extract bank name using pattern
            bank_matches = re.finditer(self._validation_rules['patterns']['bank_name'], text)
            bank_names = [match.group() for match in bank_matches]
            if bank_names:
                banking_info['bank_name'] = bank_names[0]

            # Extract check number if available
            check_matches = re.search(self._validation_rules['patterns']['check_number'], text)
            if check_matches:
                banking_info['check_number'] = check_matches.group()

            # Add confidence scores
            banking_info['confidence_scores'] = {
                field: self._calculate_field_confidence(value)
                for field, value in banking_info.items()
            }

            return banking_info

        except Exception as e:
            self._logger.error(f"Error extracting banking information: {str(e)}")
            raise

    def _validate_routing_number(self, routing_number: str) -> bool:
        """
        Validates routing number using ABA routing number checksum algorithm.
        """
        try:
            digits = [int(d) for d in routing_number]
            checksum = (
                3 * (digits[0] + digits[3] + digits[6]) +
                7 * (digits[1] + digits[4] + digits[7]) +
                (digits[2] + digits[5] + digits[8])
            )
            return checksum % 10 == 0
        except (IndexError, ValueError):
            return False

    def _calculate_field_confidence(self, value: str) -> float:
        """
        Calculates confidence score for extracted field value.
        """
        if not value:
            return 0.0
        
        # Base confidence calculation
        base_confidence = 1.0
        
        # Reduce confidence for potential error patterns
        if re.search(r'[^A-Za-z0-9\s\-\.]', value):
            base_confidence *= 0.8
            
        # Adjust confidence based on length
        if len(value) < 4:
            base_confidence *= 0.9
            
        return round(base_confidence, 2)

    def _update_metrics(self, confidence: float, start_time: datetime) -> None:
        """
        Updates processing metrics with latest results.
        """
        processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        self._processing_metrics['total_processed'] += 1
        self._processing_metrics['processing_times'].append(processing_time)
        
        # Update average confidence
        total_confidence = (self._processing_metrics['average_confidence'] * 
                          (self._processing_metrics['total_processed'] - 1) + confidence)
        self._processing_metrics['average_confidence'] = total_confidence / self._processing_metrics['total_processed']