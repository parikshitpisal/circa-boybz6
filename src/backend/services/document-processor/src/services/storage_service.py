import boto3
import logging
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential  # v8.0.1
from botocore.exceptions import ClientError
from datetime import datetime, timezone

from ..config import Config
from ..models.document import Document

# Initialize logging
logger = logging.getLogger(__name__)

# Storage tier configuration
STORAGE_TIERS = {
    'HOT': 'STANDARD',
    'WARM': 'STANDARD_IA',
    'COLD': 'GLACIER'
}

# Retry configuration
MAX_RETRIES = 3

class StorageService:
    """
    Enterprise-grade service for secure document storage operations with multi-tier
    lifecycle management, encryption, and comprehensive monitoring.
    """

    def __init__(self, config: Config):
        """
        Initialize storage service with enhanced security and validation.
        
        Args:
            config: Application configuration instance
        """
        self._storage_config = config.storage_config
        
        # Initialize S3 client with enhanced retry configuration
        self._s3_client = boto3.client(
            's3',
            region_name=self._storage_config['aws']['region'],
            aws_access_key_id=self._storage_config['aws']['access_key_id'],
            aws_secret_access_key=self._storage_config['aws']['secret_access_key'],
            config=boto3.Config(
                retries={'max_attempts': MAX_RETRIES},
                connect_timeout=30,
                read_timeout=60
            )
        )
        
        self._bucket_name = self._storage_config['aws']['bucket']
        
        # Configure encryption settings
        self._encryption_config = {
            'ServerSideEncryption': 'aws:kms',
            'SSEKMSKeyId': self._storage_config['encryption']['kms_key_id']
        } if self._storage_config['encryption']['enabled'] else {}
        
        # Configure lifecycle rules
        self._lifecycle_rules = {
            'Rules': [
                {
                    'ID': 'hot-to-warm',
                    'Prefix': 'documents/',
                    'Status': 'Enabled',
                    'Transition': {
                        'Days': 30,
                        'StorageClass': 'STANDARD_IA'
                    }
                },
                {
                    'ID': 'warm-to-cold',
                    'Prefix': 'documents/',
                    'Status': 'Enabled',
                    'Transition': {
                        'Days': 90,
                        'StorageClass': 'GLACIER'
                    }
                }
            ]
        }
        
        self._validate_storage_setup()

    def _validate_storage_setup(self) -> None:
        """Validates S3 bucket configuration and permissions."""
        try:
            # Verify bucket exists and is accessible
            self._s3_client.head_bucket(Bucket=self._bucket_name)
            
            # Verify encryption settings
            encryption = self._s3_client.get_bucket_encryption(Bucket=self._bucket_name)
            if self._storage_config['encryption']['enabled']:
                assert encryption['ServerSideEncryptionConfiguration']['Rules'][0]['ApplyServerSideEncryptionByDefault']['SSEAlgorithm'] == 'aws:kms'
            
            # Verify lifecycle rules
            lifecycle = self._s3_client.get_bucket_lifecycle_configuration(Bucket=self._bucket_name)
            assert any(rule['ID'] in ['hot-to-warm', 'warm-to-cold'] for rule in lifecycle['Rules'])
            
            logger.info(f"Storage configuration validated successfully for bucket: {self._bucket_name}")
        except Exception as e:
            logger.error(f"Storage validation failed: {str(e)}")
            raise

    @retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=1, min=4, max=10))
    def upload_document(self, file_content: bytes, document: Document, metadata: Dict[str, Any]) -> str:
        """
        Uploads document with encryption and metadata.
        
        Args:
            file_content: Document binary content
            document: Document model instance
            metadata: Additional metadata for the document
            
        Returns:
            str: S3 storage path with version ID
        """
        try:
            # Generate S3 key with timestamp and UUID
            timestamp = datetime.now(timezone.utc).strftime('%Y/%m/%d')
            s3_key = f"documents/{timestamp}/{document.id}/{document.type.lower()}"
            
            # Prepare upload parameters with encryption and metadata
            upload_params = {
                'Bucket': self._bucket_name,
                'Key': s3_key,
                'Body': file_content,
                'Metadata': {
                    'application_id': str(document.application_id),
                    'document_type': document.type,
                    'upload_timestamp': datetime.now(timezone.utc).isoformat(),
                    **metadata
                },
                'StorageClass': STORAGE_TIERS['HOT'],
                **self._encryption_config
            }
            
            # Perform upload with versioning
            response = self._s3_client.put_object(**upload_params)
            
            # Update document metadata
            document.update_metadata({
                'storage_path': s3_key,
                'version_id': response['VersionId'],
                'storage_class': STORAGE_TIERS['HOT'],
                'encryption_status': 'encrypted' if self._encryption_config else 'none'
            })
            
            logger.info(f"Document uploaded successfully: {s3_key}, Version: {response['VersionId']}")
            return f"{s3_key}?versionId={response['VersionId']}"
            
        except Exception as e:
            logger.error(f"Document upload failed: {str(e)}")
            raise

    @retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=1, min=4, max=10))
    def download_document(self, document: Document, version_id: Optional[str] = None) -> bytes:
        """
        Downloads document with integrity verification.
        
        Args:
            document: Document model instance
            version_id: Optional specific version to download
            
        Returns:
            bytes: Verified file content
        """
        try:
            # Prepare download parameters
            download_params = {
                'Bucket': self._bucket_name,
                'Key': document.storage_path
            }
            if version_id:
                download_params['VersionId'] = version_id
            
            # Check if document needs restoration from Glacier
            object_info = self._s3_client.head_object(**download_params)
            if object_info.get('StorageClass') == 'GLACIER':
                self._initiate_glacier_restoration(document)
                raise ValueError("Document is in Glacier storage and needs restoration")
            
            # Download document
            response = self._s3_client.get_object(**download_params)
            content = response['Body'].read()
            
            logger.info(f"Document downloaded successfully: {document.storage_path}")
            return content
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'InvalidObjectState':
                logger.warning(f"Document in Glacier storage: {document.storage_path}")
                raise ValueError("Document is in Glacier storage and needs restoration")
            logger.error(f"Document download failed: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Document download failed: {str(e)}")
            raise

    def manage_lifecycle(self, document: Document, target_tier: str) -> bool:
        """
        Manages document lifecycle and storage transitions.
        
        Args:
            document: Document model instance
            target_tier: Target storage tier
            
        Returns:
            bool: Transition success status
        """
        try:
            if target_tier not in STORAGE_TIERS:
                raise ValueError(f"Invalid storage tier: {target_tier}")
            
            # Prepare storage class transition
            copy_params = {
                'Bucket': self._bucket_name,
                'Key': document.storage_path,
                'CopySource': {
                    'Bucket': self._bucket_name,
                    'Key': document.storage_path
                },
                'StorageClass': STORAGE_TIERS[target_tier],
                'MetadataDirective': 'COPY',
                **self._encryption_config
            }
            
            # Perform storage class transition
            response = self._s3_client.copy_object(**copy_params)
            
            # Update document metadata
            document.update_metadata({
                'storage_class': STORAGE_TIERS[target_tier],
                'transition_timestamp': datetime.now(timezone.utc).isoformat(),
                'previous_version_id': document.metadata.get('version_id'),
                'version_id': response['VersionId']
            })
            
            logger.info(f"Document transitioned to {target_tier}: {document.storage_path}")
            return True
            
        except Exception as e:
            logger.error(f"Storage transition failed: {str(e)}")
            raise

    def _initiate_glacier_restoration(self, document: Document) -> None:
        """
        Initiates restoration of a document from Glacier storage.
        
        Args:
            document: Document model instance
        """
        try:
            self._s3_client.restore_object(
                Bucket=self._bucket_name,
                Key=document.storage_path,
                RestoreRequest={
                    'Days': 7,
                    'GlacierJobParameters': {
                        'Tier': 'Standard'
                    }
                }
            )
            logger.info(f"Glacier restoration initiated for: {document.storage_path}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'RestoreAlreadyInProgress':
                logger.info(f"Restoration already in progress for: {document.storage_path}")
            else:
                raise