from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timezone
import re
from pydantic import BaseModel, ValidationError
from cryptography.fernet import Fernet

from ..models.document import Document
from ..models.application import Application

# Constants for validation rules
REQUIRED_MERCHANT_FIELDS = ['business_name', 'ein', 'address', 'owner_info']
REQUIRED_FINANCIAL_FIELDS = ['monthly_revenue', 'bank_account', 'routing_number']
MIN_OCR_CONFIDENCE = 0.85
SENSITIVE_FIELD_PATTERNS = {
    'ssn': r'^\d{3}-\d{2}-\d{4}$',
    'ein': r'^\d{2}-\d{7}$',
    'bank_account': r'^\d{8,17}$'
}
VALIDATION_THRESHOLDS = {
    'min_revenue': 1000.00,
    'max_revenue': 10000000.00,
    'min_confidence': 0.85,
    'max_field_length': 256
}

@staticmethod
def validate_document_data(extracted_data: Dict[str, Any], 
                         document_type: str,
                         document_subtype: Optional[str] = None) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validates extracted document data against expected schema with enhanced subtype validation.
    
    Args:
        extracted_data: Dictionary containing extracted document data
        document_type: Type of document being validated
        document_subtype: Optional subtype for specialized validation
        
    Returns:
        Tuple containing:
        - bool: Validation success
        - list[str]: List of error messages
        - dict: Validation metadata
    """
    errors = []
    metadata = {
        'timestamp': datetime.now(timezone.utc),
        'document_type': document_type,
        'document_subtype': document_subtype,
        'validation_version': '1.0'
    }

    # Validate document type and subtype
    doc = Document()
    if not doc.validate_type(document_type, document_subtype):
        errors.append(f"Invalid document type/subtype combination: {document_type}/{document_subtype}")
        return False, errors, metadata

    # Check if data is empty
    if not extracted_data:
        errors.append("Extracted data is empty")
        return False, errors, metadata

    # Validate OCR confidence
    if 'ocr_confidence' in extracted_data:
        if extracted_data['ocr_confidence'] < MIN_OCR_CONFIDENCE:
            errors.append(f"OCR confidence below threshold: {extracted_data['ocr_confidence']}")

    # Document type-specific validation
    if document_type == 'BANK_STATEMENT':
        if not all(field in extracted_data for field in ['account_number', 'routing_number', 'statement_date']):
            errors.append("Missing required fields for bank statement")
        
        # Validate account numbers
        if 'account_number' in extracted_data:
            if not re.match(SENSITIVE_FIELD_PATTERNS['bank_account'], extracted_data['account_number']):
                errors.append("Invalid bank account number format")

    metadata['field_count'] = len(extracted_data)
    metadata['validation_complete'] = True

    return len(errors) == 0, errors, metadata

@staticmethod
def validate_merchant_info(merchant_data: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validates merchant information fields with enhanced business rules.
    
    Args:
        merchant_data: Dictionary containing merchant information
        
    Returns:
        Tuple containing validation result, errors, and metadata
    """
    errors = []
    metadata = {
        'timestamp': datetime.now(timezone.utc),
        'validation_type': 'merchant_info',
        'fields_validated': []
    }

    # Check required fields
    missing_fields = [field for field in REQUIRED_MERCHANT_FIELDS if field not in merchant_data]
    if missing_fields:
        errors.append(f"Missing required fields: {', '.join(missing_fields)}")

    # Validate business name
    if 'business_name' in merchant_data:
        if len(merchant_data['business_name']) > VALIDATION_THRESHOLDS['max_field_length']:
            errors.append("Business name exceeds maximum length")
        metadata['fields_validated'].append('business_name')

    # Validate EIN
    if 'ein' in merchant_data:
        if not re.match(SENSITIVE_FIELD_PATTERNS['ein'], merchant_data['ein']):
            errors.append("Invalid EIN format")
        metadata['fields_validated'].append('ein')

    # Validate address
    if 'address' in merchant_data:
        if not all(key in merchant_data['address'] for key in ['street', 'city', 'state', 'zip']):
            errors.append("Incomplete address information")
        metadata['fields_validated'].append('address')

    metadata['validation_complete'] = True
    return len(errors) == 0, errors, metadata

@staticmethod
def validate_financial_data(financial_data: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validates financial information with fraud detection.
    
    Args:
        financial_data: Dictionary containing financial information
        
    Returns:
        Tuple containing validation result, errors, and risk assessment
    """
    errors = []
    risk_assessment = {
        'timestamp': datetime.now(timezone.utc),
        'risk_level': 'low',
        'flags': []
    }

    # Check required fields
    missing_fields = [field for field in REQUIRED_FINANCIAL_FIELDS if field not in financial_data]
    if missing_fields:
        errors.append(f"Missing required financial fields: {', '.join(missing_fields)}")

    # Validate monthly revenue
    if 'monthly_revenue' in financial_data:
        try:
            revenue = float(financial_data['monthly_revenue'])
            if not VALIDATION_THRESHOLDS['min_revenue'] <= revenue <= VALIDATION_THRESHOLDS['max_revenue']:
                errors.append("Monthly revenue outside acceptable range")
                risk_assessment['flags'].append('revenue_range')
        except ValueError:
            errors.append("Invalid monthly revenue format")

    # Validate bank account information
    if 'bank_account' in financial_data:
        if not re.match(SENSITIVE_FIELD_PATTERNS['bank_account'], financial_data['bank_account']):
            errors.append("Invalid bank account number")
            risk_assessment['flags'].append('invalid_account')

    # Update risk level based on flags
    if len(risk_assessment['flags']) >= 2:
        risk_assessment['risk_level'] = 'high'
    elif len(risk_assessment['flags']) == 1:
        risk_assessment['risk_level'] = 'medium'

    return len(errors) == 0, errors, risk_assessment

@staticmethod
def validate_processing_result(processing_result: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validates document processing results with quality metrics.
    
    Args:
        processing_result: Dictionary containing processing results and metrics
        
    Returns:
        Tuple containing validation result, errors, and quality metrics
    """
    errors = []
    quality_metrics = {
        'timestamp': datetime.now(timezone.utc),
        'metrics_version': '1.0',
        'quality_score': 0.0
    }

    # Validate OCR confidence
    if 'ocr_confidence' in processing_result:
        confidence = float(processing_result['ocr_confidence'])
        quality_metrics['ocr_confidence'] = confidence
        if confidence < VALIDATION_THRESHOLDS['min_confidence']:
            errors.append(f"OCR confidence below threshold: {confidence}")

    # Validate processing timestamps
    if 'processing_time' in processing_result:
        try:
            start_time = datetime.fromisoformat(processing_result['processing_time']['start'])
            end_time = datetime.fromisoformat(processing_result['processing_time']['end'])
            if end_time <= start_time:
                errors.append("Invalid processing time sequence")
            quality_metrics['processing_duration'] = (end_time - start_time).total_seconds()
        except (ValueError, KeyError):
            errors.append("Invalid processing time format")

    # Calculate overall quality score
    quality_factors = {
        'ocr_confidence': processing_result.get('ocr_confidence', 0),
        'field_accuracy': processing_result.get('field_accuracy', 0),
        'validation_rate': processing_result.get('validation_rate', 0)
    }
    quality_metrics['quality_score'] = sum(quality_factors.values()) / len(quality_factors)

    return len(errors) == 0, errors, quality_metrics

@staticmethod
def sanitize_sensitive_data(data: Dict[str, Any], encryption_key: str) -> Dict[str, Any]:
    """
    Sanitizes and encrypts sensitive information with audit logging.
    
    Args:
        data: Dictionary containing data to be sanitized
        encryption_key: Key used for encrypting sensitive data
        
    Returns:
        Dictionary containing sanitized and encrypted data
    """
    fernet = Fernet(encryption_key.encode())
    sanitized_data = {}
    audit_log = []

    for field, value in data.items():
        # Check if field contains sensitive data
        is_sensitive = any(pattern in field.lower() for pattern in ['ssn', 'ein', 'account', 'routing'])
        
        if is_sensitive:
            # Encrypt sensitive fields
            encrypted_value = fernet.encrypt(str(value).encode()).decode()
            sanitized_data[field] = encrypted_value
            audit_log.append({
                'field': field,
                'action': 'encrypted',
                'timestamp': datetime.now(timezone.utc)
            })
        else:
            # Copy non-sensitive fields as is
            sanitized_data[field] = value

    # Add audit log to sanitized data
    sanitized_data['_audit'] = audit_log
    sanitized_data['_sanitized_at'] = datetime.now(timezone.utc).isoformat()

    return sanitized_data