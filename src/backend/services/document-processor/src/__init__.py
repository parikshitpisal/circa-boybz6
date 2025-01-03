"""
Document Processor Service Initialization Module
Provides core document processing functionality with high-accuracy OCR, classification,
and comprehensive monitoring capabilities.

External Dependencies:
logging==3.11+
threading==3.11+
"""

import logging
import threading
from typing import Dict, Any, Optional

from .config import Config
from .core.document_classifier import DocumentClassifier
from .core.ocr_engine import OCREngine

# Initialize logging
logger = logging.getLogger(__name__)

# Package version
VERSION = '1.0.0'

# Thread safety lock
_instance_lock = threading.Lock()

class DocumentProcessor:
    """
    Thread-safe document processor class that orchestrates document processing pipeline
    with comprehensive error handling and monitoring.
    """
    
    def __init__(self):
        """Thread-safe initialization of document processor components."""
        self._config: Config = None
        self._classifier: DocumentClassifier = None
        self._ocr_engine: OCREngine = None
        self._logger: logging.Logger = logging.getLogger(__name__)
        self._performance_metrics: Dict[str, Any] = {
            'total_processed': 0,
            'successful_processed': 0,
            'failed_processed': 0,
            'avg_processing_time': 0,
            'avg_confidence_score': 0,
            'accuracy_rate': 0
        }
        self._processing_lock = threading.Lock()
        
        try:
            with _instance_lock:
                # Initialize configuration
                self._config = Config()
                
                # Initialize document classifier
                self._classifier = DocumentClassifier(
                    model_path=self._config.classifier_config['model']['path'],
                    confidence_threshold=self._config.classifier_config['confidence']['threshold']
                )
                
                # Initialize OCR engine
                self._ocr_engine = OCREngine(
                    confidence_threshold=self._config.ocr_config['confidence']['threshold'],
                    supported_languages=self._config.ocr_config['languages']
                )
                
                # Configure logging
                logging.basicConfig(
                    level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
                )
                
                self._logger.info("Document processor initialized successfully")
                
        except Exception as e:
            self._logger.error(f"Initialization error: {str(e)}")
            raise RuntimeError(f"Failed to initialize document processor: {str(e)}")

    def process_document(self, 
                        document_data: bytes,
                        document_type: Optional[str] = None,
                        processing_options: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Process document through classification and OCR pipeline with comprehensive monitoring.
        
        Args:
            document_data: Raw document data as bytes
            document_type: Optional pre-defined document type
            processing_options: Optional processing configuration
            
        Returns:
            Dict containing processing results, extracted data, and performance metrics
        """
        try:
            with self._processing_lock:
                start_time = time.time()
                processing_metrics = {
                    'start_time': start_time,
                    'document_size': len(document_data),
                    'processing_status': 'PROCESSING'
                }
                
                # Convert bytes to numpy array for processing
                image = cv2.imdecode(
                    np.frombuffer(document_data, np.uint8),
                    cv2.IMREAD_COLOR
                )
                
                # Validate input
                valid, message = validate_image(image)
                if not valid:
                    raise ValueError(f"Invalid document image: {message}")
                
                # Classify document if type not provided
                if not document_type:
                    doc_type, confidence, classification_metadata = self._classifier.classify_document(
                        image,
                        Document()
                    )
                    processing_metrics['classification'] = classification_metadata
                else:
                    doc_type = document_type
                
                # Optimize image for OCR
                optimized_image = optimize_for_ocr(
                    image,
                    options=processing_options.get('ocr_options', {})
                )
                
                # Perform OCR extraction
                extracted_text, confidence, ocr_metrics = self._ocr_engine.extract_text(
                    optimized_image,
                    enhance_preprocessing=True
                )
                
                # Extract structured fields
                structured_data = self._ocr_engine.extract_structured_fields(
                    optimized_image,
                    strict_validation=True
                )
                
                # Validate results
                is_valid, validation_message, validation_metrics = self._ocr_engine.validate_results(
                    extracted_text,
                    confidence,
                    structured_data
                )
                
                # Update performance metrics
                processing_time = time.time() - start_time
                self._update_performance_metrics(
                    processing_time,
                    confidence,
                    is_valid
                )
                
                # Prepare response
                result = {
                    'document_type': doc_type,
                    'extracted_text': extracted_text,
                    'structured_data': structured_data,
                    'confidence_score': confidence,
                    'validation_result': {
                        'is_valid': is_valid,
                        'message': validation_message,
                        'metrics': validation_metrics
                    },
                    'processing_metrics': {
                        **processing_metrics,
                        'processing_time': processing_time,
                        'completion_time': time.time(),
                        'processing_status': 'COMPLETED' if is_valid else 'FAILED'
                    }
                }
                
                self._logger.info(f"Document processing completed: {result['processing_metrics']}")
                return result
                
        except Exception as e:
            self._logger.error(f"Document processing error: {str(e)}")
            raise

    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get current performance metrics and processing statistics.
        
        Returns:
            Dict containing comprehensive performance metrics
        """
        with self._processing_lock:
            return {
                **self._performance_metrics,
                'timestamp': time.time(),
                'uptime_seconds': time.time() - self._performance_metrics.get('start_time', time.time())
            }

    def _update_performance_metrics(self, 
                                 processing_time: float,
                                 confidence_score: float,
                                 is_valid: bool) -> None:
        """Update internal performance metrics with new processing results."""
        with self._processing_lock:
            self._performance_metrics['total_processed'] += 1
            
            if is_valid:
                self._performance_metrics['successful_processed'] += 1
            else:
                self._performance_metrics['failed_processed'] += 1
            
            # Update running averages
            total = self._performance_metrics['total_processed']
            self._performance_metrics['avg_processing_time'] = (
                (self._performance_metrics['avg_processing_time'] * (total - 1) + processing_time) / total
            )
            self._performance_metrics['avg_confidence_score'] = (
                (self._performance_metrics['avg_confidence_score'] * (total - 1) + confidence_score) / total
            )
            self._performance_metrics['accuracy_rate'] = (
                self._performance_metrics['successful_processed'] / total * 100
            )

# Export version and main processor class
__version__ = VERSION
__all__ = ['DocumentProcessor', 'VERSION']