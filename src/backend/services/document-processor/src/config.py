import os
import logging
from typing import Dict, Any
from threading import Lock
from dotenv import load_dotenv  # v1.0.0
from pathlib import Path

# Initialize logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Global constants
ENV = os.getenv('ENV', 'development')
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Config:
    """
    Thread-safe configuration management for document processing service.
    Handles OCR, classification, storage, and processing configurations with
    built-in validation and security features.
    """
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(Config, cls).__new__(cls)
            return cls._instance

    def __init__(self):
        """Initialize configuration with environment-specific settings and validation."""
        if not hasattr(self, '_initialized'):
            with self._lock:
                self._ocr_config: Dict[str, Any] = {}
                self._classifier_config: Dict[str, Any] = {}
                self._storage_config: Dict[str, Any] = {}
                self._processing_config: Dict[str, Any] = {}
                self._load_all_configs()
                self._initialized = True

    def _load_all_configs(self) -> None:
        """Load and validate all configuration components."""
        try:
            self._ocr_config = self.load_ocr_config()
            self._classifier_config = self.load_classifier_config()
            self._storage_config = self.load_storage_config()
            self._processing_config = self.load_processing_config()
            self.validate_config()
        except Exception as e:
            logger.error(f"Configuration initialization failed: {str(e)}")
            raise

    def load_ocr_config(self) -> Dict[str, Any]:
        """
        Load and validate OCR engine configuration with performance optimization.
        Returns:
            Dict[str, Any]: Validated OCR configuration settings
        """
        return {
            'engine': {
                'path': os.getenv('OCR_ENGINE_PATH', '/usr/local/bin/tesseract'),
                'version': os.getenv('OCR_ENGINE_VERSION', '4.1.1'),
                'threads': int(os.getenv('OCR_THREADS', '4')),
            },
            'preprocessing': {
                'dpi': int(os.getenv('OCR_DPI', '300')),
                'denoise': bool(int(os.getenv('OCR_DENOISE', '1'))),
                'deskew': bool(int(os.getenv('OCR_DESKEW', '1'))),
            },
            'confidence': {
                'threshold': float(os.getenv('OCR_CONFIDENCE_THRESHOLD', '0.85')),
                'min_acceptable': float(os.getenv('OCR_MIN_CONFIDENCE', '0.60')),
            },
            'languages': os.getenv('OCR_LANGUAGES', 'eng').split(','),
            'cache': {
                'enabled': bool(int(os.getenv('OCR_CACHE_ENABLED', '1'))),
                'ttl': int(os.getenv('OCR_CACHE_TTL', '3600')),
            }
        }

    def load_classifier_config(self) -> Dict[str, Any]:
        """
        Load document classifier configuration with model management.
        Returns:
            Dict[str, Any]: Validated classifier configuration settings
        """
        return {
            'model': {
                'path': os.getenv('CLASSIFIER_MODEL_PATH', f'{BASE_DIR}/models'),
                'version': os.getenv('CLASSIFIER_MODEL_VERSION', 'v1.0.0'),
                'update_interval': int(os.getenv('MODEL_UPDATE_INTERVAL', '86400')),
            },
            'confidence': {
                'threshold': float(os.getenv('CLASSIFIER_CONFIDENCE_THRESHOLD', '0.90')),
                'fallback_threshold': float(os.getenv('CLASSIFIER_FALLBACK_THRESHOLD', '0.70')),
            },
            'preprocessing': {
                'target_size': tuple(map(int, os.getenv('CLASSIFIER_IMAGE_SIZE', '800,600').split(','))),
                'normalize': bool(int(os.getenv('CLASSIFIER_NORMALIZE', '1'))),
            },
            'performance': {
                'batch_size': int(os.getenv('CLASSIFIER_BATCH_SIZE', '32')),
                'max_queue_size': int(os.getenv('CLASSIFIER_QUEUE_SIZE', '100')),
            }
        }

    def load_storage_config(self) -> Dict[str, Any]:
        """
        Load secure storage configuration with encryption management.
        Returns:
            Dict[str, Any]: Validated storage configuration settings
        """
        return {
            'aws': {
                'region': os.getenv('AWS_REGION', 'us-east-1'),
                'bucket': os.getenv('AWS_BUCKET_NAME'),
                'access_key_id': os.getenv('AWS_ACCESS_KEY_ID'),
                'secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY'),
            },
            'encryption': {
                'enabled': bool(int(os.getenv('STORAGE_ENCRYPTION_ENABLED', '1'))),
                'kms_key_id': os.getenv('AWS_KMS_KEY_ID'),
                'key_rotation_interval': int(os.getenv('KEY_ROTATION_INTERVAL', '90')),
            },
            'retention': {
                'enabled': bool(int(os.getenv('RETENTION_ENABLED', '1'))),
                'period_days': int(os.getenv('RETENTION_PERIOD_DAYS', '2555')),
            },
            'backup': {
                'enabled': bool(int(os.getenv('BACKUP_ENABLED', '1'))),
                'frequency': os.getenv('BACKUP_FREQUENCY', 'daily'),
                'retention_copies': int(os.getenv('BACKUP_RETENTION_COPIES', '30')),
            }
        }

    def load_processing_config(self) -> Dict[str, Any]:
        """
        Load optimized processing configuration with queue management.
        Returns:
            Dict[str, Any]: Validated processing configuration settings
        """
        return {
            'queue': {
                'max_size': int(os.getenv('QUEUE_MAX_SIZE', '1000')),
                'batch_size': int(os.getenv('PROCESSING_BATCH_SIZE', '50')),
                'workers': int(os.getenv('PROCESSING_WORKERS', '8')),
            },
            'timeouts': {
                'processing': int(os.getenv('PROCESSING_TIMEOUT', '300')),
                'ocr': int(os.getenv('OCR_TIMEOUT', '120')),
                'classification': int(os.getenv('CLASSIFICATION_TIMEOUT', '60')),
            },
            'retry': {
                'max_attempts': int(os.getenv('MAX_RETRY_ATTEMPTS', '3')),
                'delay_seconds': int(os.getenv('RETRY_DELAY_SECONDS', '60')),
            },
            'monitoring': {
                'enabled': bool(int(os.getenv('MONITORING_ENABLED', '1'))),
                'metrics_interval': int(os.getenv('METRICS_INTERVAL', '60')),
            }
        }

    def validate_config(self) -> bool:
        """
        Perform comprehensive configuration validation with dependency checking.
        Returns:
            bool: Validation success status
        """
        try:
            # Validate OCR configuration
            assert self._ocr_config['engine']['path'], "OCR engine path not configured"
            assert 0 < self._ocr_config['confidence']['threshold'] <= 1, "Invalid OCR confidence threshold"
            
            # Validate classifier configuration
            assert os.path.exists(self._classifier_config['model']['path']), "Classifier model path not found"
            assert 0 < self._classifier_config['confidence']['threshold'] <= 1, "Invalid classifier confidence threshold"
            
            # Validate storage configuration
            assert self._storage_config['aws']['bucket'], "AWS bucket not configured"
            assert self._storage_config['aws']['access_key_id'], "AWS credentials not configured"
            
            # Validate processing configuration
            assert self._processing_config['queue']['max_size'] > 0, "Invalid queue size"
            assert self._processing_config['queue']['workers'] > 0, "Invalid worker count"
            
            logger.info("Configuration validation successful")
            return True
            
        except AssertionError as e:
            logger.error(f"Configuration validation failed: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during configuration validation: {str(e)}")
            raise

    @property
    def ocr_config(self) -> Dict[str, Any]:
        """Thread-safe access to OCR configuration."""
        with self._lock:
            return self._ocr_config.copy()

    @property
    def classifier_config(self) -> Dict[str, Any]:
        """Thread-safe access to classifier configuration."""
        with self._lock:
            return self._classifier_config.copy()

    @property
    def storage_config(self) -> Dict[str, Any]:
        """Thread-safe access to storage configuration."""
        with self._lock:
            return self._storage_config.copy()

    @property
    def processing_config(self) -> Dict[str, Any]:
        """Thread-safe access to processing configuration."""
        with self._lock:
            return self._processing_config.copy()