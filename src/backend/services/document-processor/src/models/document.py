from datetime import datetime, timezone
from typing import Dict, Optional, Any
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, validator
from enum import Enum

# Import application status and document types from shared constants
from ....shared.constants import APPLICATION_STATUS, DOCUMENT_TYPES

class Document(BaseModel):
    """
    Pydantic model representing a document in the AI-Driven Application Intake Platform.
    Implements comprehensive document metadata management, status tracking, validation,
    and security features.
    """
    
    # Required fields
    id: UUID = Field(default_factory=uuid4)
    application_id: UUID
    type: str
    status: str = Field(default=APPLICATION_STATUS.PENDING)
    storage_path: str
    ocr_confidence: float = Field(ge=0.0, le=1.0)
    
    # Optional fields with defaults
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    audit_log: Dict[str, Any] = Field(default_factory=list)
    validation_results: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        """Pydantic model configuration"""
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

    @validator('type')
    def validate_document_type(cls, v):
        """Validates document type against allowed DOCUMENT_TYPES"""
        if v not in [t.value for t in DOCUMENT_TYPES]:
            raise ValueError(f"Invalid document type. Must be one of: {[t.value for t in DOCUMENT_TYPES]}")
        return v

    @validator('status')
    def validate_status(cls, v):
        """Validates status against allowed APPLICATION_STATUS values"""
        if v not in [s.value for s in APPLICATION_STATUS]:
            raise ValueError(f"Invalid status. Must be one of: {[s.value for s in APPLICATION_STATUS]}")
        return v

    def validate_type(self, doc_type: str, subtype: Optional[str] = None) -> bool:
        """
        Enhanced document type validation with subtype support.
        
        Args:
            doc_type: The primary document type
            subtype: Optional document subtype for specialized validation
            
        Returns:
            bool: Validation result
        """
        try:
            # Validate primary type
            if doc_type not in [t.value for t in DOCUMENT_TYPES]:
                raise ValueError(f"Invalid document type: {doc_type}")
            
            # Update validation results
            self.validation_results.update({
                'type_validation': {
                    'timestamp': datetime.now(timezone.utc),
                    'type': doc_type,
                    'subtype': subtype,
                    'valid': True
                }
            })
            return True
        except ValueError as e:
            self.validation_results.update({
                'type_validation': {
                    'timestamp': datetime.now(timezone.utc),
                    'type': doc_type,
                    'subtype': subtype,
                    'valid': False,
                    'error': str(e)
                }
            })
            return False

    def update_status(self, new_status: str, reason: Optional[str] = None, user_id: Optional[UUID] = None) -> None:
        """
        Updates document status with transition validation and audit logging.
        
        Args:
            new_status: New status to set
            reason: Optional reason for status change
            user_id: Optional ID of user making the change
        """
        if new_status not in [s.value for s in APPLICATION_STATUS]:
            raise ValueError(f"Invalid status: {new_status}")

        old_status = self.status
        self.status = new_status
        self.updated_at = datetime.now(timezone.utc)

        if new_status == APPLICATION_STATUS.COMPLETED:
            self.processed_at = datetime.now(timezone.utc)
        elif new_status == APPLICATION_STATUS.FAILED:
            self.failure_reason = reason

        # Record in audit log
        self.audit_log.append({
            'timestamp': datetime.now(timezone.utc),
            'action': 'status_update',
            'old_value': old_status,
            'new_value': new_status,
            'reason': reason,
            'user_id': str(user_id) if user_id else None
        })

    def update_metadata(self, new_metadata: Dict[str, Any], user_id: Optional[UUID] = None) -> None:
        """
        Updates document metadata with validation and security checks.
        
        Args:
            new_metadata: New metadata to merge/update
            user_id: Optional ID of user making the change
        """
        # Merge with existing metadata
        old_metadata = self.metadata.copy()
        self.metadata.update(new_metadata)
        self.updated_at = datetime.now(timezone.utc)

        # Record in audit log
        self.audit_log.append({
            'timestamp': datetime.now(timezone.utc),
            'action': 'metadata_update',
            'old_value': old_metadata,
            'new_value': self.metadata,
            'user_id': str(user_id) if user_id else None
        })

    def to_dict(self, include_sensitive: bool = False, user_id: Optional[UUID] = None) -> Dict[str, Any]:
        """
        Converts document to dictionary with security filtering.
        
        Args:
            include_sensitive: Whether to include sensitive data
            user_id: Optional ID of user requesting the data
            
        Returns:
            Dict containing the filtered document data
        """
        data = {
            'id': str(self.id),
            'application_id': str(self.application_id),
            'type': self.type,
            'status': self.status,
            'storage_path': self.storage_path,
            'ocr_confidence': self.ocr_confidence,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'validation_results': self.validation_results
        }

        if include_sensitive:
            data.update({
                'metadata': self.metadata,
                'failure_reason': self.failure_reason,
                'audit_log': self.audit_log
            })

        return data