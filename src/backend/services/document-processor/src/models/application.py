from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, validator
from prometheus_client import Counter, Histogram
from cryptography.fernet import Fernet
import json

from .document import Document
from ../../shared.constants import APPLICATION_STATUS

# Metrics for monitoring
application_status_changes = Counter('application_status_changes_total', 'Total number of application status changes', ['from_status', 'to_status'])
validation_duration = Histogram('application_validation_duration_seconds', 'Time spent validating application data')
document_processing_duration = Histogram('application_document_processing_seconds', 'Time spent processing application documents')

class EncryptedDict(dict):
    """Custom dictionary class for handling encrypted data fields"""
    def __init__(self, data: Dict[str, Any], encryption_key: bytes):
        self._fernet = Fernet(encryption_key)
        encrypted_data = {
            k: self._encrypt(v) if self._should_encrypt(k) else v 
            for k, v in data.items()
        }
        super().__init__(encrypted_data)

    def _should_encrypt(self, field: str) -> bool:
        """Determines if a field should be encrypted based on sensitivity"""
        sensitive_fields = {'ssn', 'ein', 'bank_account', 'routing_number'}
        return field.lower() in sensitive_fields

    def _encrypt(self, value: Any) -> str:
        """Encrypts sensitive values"""
        if not value:
            return value
        return self._fernet.encrypt(json.dumps(value).encode()).decode()

    def _decrypt(self, value: str) -> Any:
        """Decrypts sensitive values"""
        if not value:
            return value
        return json.loads(self._fernet.decrypt(value.encode()).decode())

class Application(BaseModel):
    """
    Enhanced Pydantic model representing a merchant cash advance application with 
    security, validation, and monitoring capabilities.
    """
    
    # Required fields
    id: UUID = Field(default_factory=uuid4)
    status: str = Field(default=APPLICATION_STATUS.PENDING)
    email_source: str
    merchant_data: EncryptedDict
    documents: List[Document] = Field(default_factory=list)
    
    # Optional fields with defaults
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None
    validation_results: Dict[str, Any] = Field(default_factory=dict)
    processing_metrics: Dict[str, Any] = Field(default_factory=dict)
    status_history: List[Dict[str, Any]] = Field(default_factory=list)
    security_context: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        """Pydantic model configuration"""
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
            EncryptedDict: lambda v: {k: v._decrypt(val) if v._should_encrypt(k) else val 
                                    for k, val in v.items()}
        }

    def __init__(self, email_source: str, merchant_data: Dict[str, Any], 
                 security_context: Dict[str, Any], **data: Any):
        """Initialize a new Application instance with enhanced security and monitoring"""
        # Generate encryption key from security context
        encryption_key = security_context.get('encryption_key', Fernet.generate_key())
        
        # Encrypt sensitive merchant data
        encrypted_merchant_data = EncryptedDict(merchant_data, encryption_key)
        
        super().__init__(
            email_source=email_source,
            merchant_data=encrypted_merchant_data,
            security_context={**security_context, 'encryption_key': encryption_key},
            **data
        )

        # Initialize performance metrics
        self.processing_metrics = {
            'start_time': datetime.now(timezone.utc),
            'document_count': 0,
            'validation_attempts': 0,
            'processing_duration': 0
        }

    @validator('status')
    def validate_status(cls, v):
        """Validates status against allowed APPLICATION_STATUS values"""
        if v not in [s.value for s in APPLICATION_STATUS]:
            raise ValueError(f"Invalid status. Must be one of: {[s.value for s in APPLICATION_STATUS]}")
        return v

    def validate_merchant_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Enhanced validation of merchant data with business rules"""
        with validation_duration.time():
            self.processing_metrics['validation_attempts'] += 1
            validation_result = {
                'timestamp': datetime.now(timezone.utc),
                'valid': True,
                'errors': [],
                'warnings': []
            }

            required_fields = {
                'business_name', 'business_address', 'business_type',
                'owner_name', 'owner_ssn', 'owner_dob'
            }

            # Check required fields
            missing_fields = required_fields - set(data.keys())
            if missing_fields:
                validation_result['valid'] = False
                validation_result['errors'].append(f"Missing required fields: {missing_fields}")

            # Business rules validation
            if data.get('business_type') not in {'LLC', 'Corporation', 'Sole Proprietorship'}:
                validation_result['warnings'].append("Non-standard business type")

            self.validation_results = validation_result
            return validation_result

    def add_documents(self, documents: List[Document]) -> Dict[str, Any]:
        """Adds multiple documents with batch processing support"""
        with document_processing_duration.time():
            batch_result = {
                'processed': 0,
                'failed': 0,
                'documents': []
            }

            for doc in documents:
                try:
                    # Validate document type
                    if not doc.validate_type(doc.type):
                        raise ValueError(f"Invalid document type: {doc.type}")

                    # Add document to application
                    doc.application_id = self.id
                    self.documents.append(doc)
                    
                    batch_result['processed'] += 1
                    batch_result['documents'].append({
                        'id': str(doc.id),
                        'type': doc.type,
                        'status': doc.status
                    })
                except Exception as e:
                    batch_result['failed'] += 1
                    batch_result['documents'].append({
                        'id': str(doc.id),
                        'type': doc.type,
                        'error': str(e)
                    })

            self.processing_metrics['document_count'] = len(self.documents)
            return batch_result

    def update_status(self, new_status: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Updates application status with audit trail"""
        old_status = self.status
        
        # Validate status transition
        if not self._is_valid_status_transition(old_status, new_status):
            raise ValueError(f"Invalid status transition from {old_status} to {new_status}")

        self.status = new_status
        self.updated_at = datetime.now(timezone.utc)

        if new_status == APPLICATION_STATUS.COMPLETED:
            self.processed_at = datetime.now(timezone.utc)

        # Record status change
        status_change = {
            'timestamp': datetime.now(timezone.utc),
            'from_status': old_status,
            'to_status': new_status,
            'context': context
        }
        self.status_history.append(status_change)

        # Update metrics
        application_status_changes.labels(
            from_status=old_status,
            to_status=new_status
        ).inc()

        return status_change

    def to_dict(self, security_context: Dict[str, Any]) -> Dict[str, Any]:
        """Converts application to dictionary with security handling"""
        # Validate security context
        if not self._validate_security_context(security_context):
            raise ValueError("Invalid security context")

        # Base data dictionary
        data = {
            'id': str(self.id),
            'status': self.status,
            'email_source': self.email_source,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'document_count': len(self.documents),
            'validation_status': self.validation_results.get('valid', False)
        }

        # Add merchant data if authorized
        if security_context.get('include_sensitive', False):
            data['merchant_data'] = dict(self.merchant_data)
            data['documents'] = [doc.to_dict(include_sensitive=True) for doc in self.documents]
            data['status_history'] = self.status_history
            data['processing_metrics'] = self.processing_metrics

        return data

    def _is_valid_status_transition(self, from_status: str, to_status: str) -> bool:
        """Validates status transitions based on business rules"""
        valid_transitions = {
            APPLICATION_STATUS.PENDING: {APPLICATION_STATUS.PROCESSING, APPLICATION_STATUS.FAILED},
            APPLICATION_STATUS.PROCESSING: {APPLICATION_STATUS.COMPLETED, APPLICATION_STATUS.FAILED},
            APPLICATION_STATUS.FAILED: {APPLICATION_STATUS.PROCESSING},
            APPLICATION_STATUS.COMPLETED: set()  # No transitions from completed
        }
        return to_status in valid_transitions.get(from_status, set())

    def _validate_security_context(self, context: Dict[str, Any]) -> bool:
        """Validates the security context for data access"""
        required_fields = {'user_id', 'encryption_key'}
        return all(field in context for field in required_fields)