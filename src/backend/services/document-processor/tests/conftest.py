"""
Pytest configuration and fixtures for document processor service tests.
Provides reusable test components for document processing, OCR, and classification testing.

Version: 1.0.0
"""

import pytest
import numpy as np
import uuid
from typing import Dict, Any

from ..src.models.document import Document
from ..src.core.document_classifier import DocumentClassifier
from ..src.core.ocr_engine import OCREngine

# Global test configuration
TEST_MODEL_PATH = 'tests/data/test_model.h5'
TEST_CONFIDENCE_THRESHOLD = 0.95
TEST_OCR_CONFIG = '--oem 3 --psm 3'
TEST_CLEANUP_ENABLED = True
TEST_BENCHMARK_ENABLED = True

@pytest.fixture(scope='function')
@pytest.mark.timeout(30)
def mock_document() -> Document:
    """
    Creates a mock Document instance for testing with enhanced validation.
    
    Returns:
        Document: Mock document instance with validation capabilities
    """
    doc_id = uuid.uuid4()
    app_id = uuid.uuid4()
    
    document = Document(
        id=doc_id,
        application_id=app_id,
        type='BANK_STATEMENT',
        storage_path=f'test_documents/{doc_id}.pdf',
        ocr_confidence=0.0
    )
    
    # Configure validation rules
    document.validation_results = {
        'type_validation': {
            'valid': True,
            'timestamp': None
        },
        'content_validation': {
            'valid': False,
            'timestamp': None
        }
    }
    
    return document

@pytest.fixture(scope='module')
@pytest.mark.timeout(60)
def mock_ocr_engine() -> OCREngine:
    """
    Creates a mock OCR engine instance with additional configuration options.
    
    Returns:
        OCREngine: Mock OCR engine instance with enhanced capabilities
    """
    engine = OCREngine(
        config=TEST_OCR_CONFIG,
        confidence_threshold=TEST_CONFIDENCE_THRESHOLD,
        supported_languages=['eng'],
        field_patterns={
            'business_name': r'^[A-Za-z0-9\s,.-]+$',
            'ein': r'^\d{2}-\d{7}$',
            'ssn': r'^\d{3}-\d{2}-\d{4}$'
        },
        error_patterns={
            'O0': {'pattern': r'[oO]', 'replacement': '0'},
            'I1': {'pattern': r'[iIl]', 'replacement': '1'},
            'S5': {'pattern': r'[sS]', 'replacement': '5'}
        }
    )
    
    # Configure performance benchmarking if enabled
    if TEST_BENCHMARK_ENABLED:
        engine._logger.setLevel('DEBUG')
    
    return engine

@pytest.fixture(scope='module')
def mock_document_classifier() -> DocumentClassifier:
    """
    Creates a mock document classifier instance with expanded test patterns.
    
    Returns:
        DocumentClassifier: Mock document classifier instance with enhanced patterns
    """
    classifier = DocumentClassifier(
        model_path=TEST_MODEL_PATH,
        confidence_threshold=TEST_CONFIDENCE_THRESHOLD,
        feature_config={
            'text_density': True,
            'image_size': True,
            'aspect_ratio': True,
            'key_phrases': True,
            'layout_pattern': True,
            'content_structure': True
        }
    )
    
    # Configure test document patterns
    classifier._document_patterns = {
        'BANK_STATEMENT': {
            'key_phrases': ['account', 'balance', 'transaction', 'statement', 'deposit'],
            'layout': 'tabular',
            'content_ratio': 0.7
        },
        'ISO_APPLICATION': {
            'key_phrases': ['merchant', 'business', 'application', 'owner', 'ein'],
            'layout': 'form',
            'content_ratio': 0.6
        },
        'VOIDED_CHECK': {
            'key_phrases': ['pay to', 'routing', 'account', 'void'],
            'layout': 'check',
            'content_ratio': 0.4
        }
    }
    
    return classifier

@pytest.fixture(scope='function')
def test_image_data() -> np.ndarray:
    """
    Provides test image data with comprehensive patterns.
    
    Returns:
        numpy.ndarray: Test image data array with enhanced patterns
    """
    # Create test image with specific dimensions and patterns
    height, width = 1024, 768
    image = np.ones((height, width), dtype=np.uint8) * 255
    
    # Add test patterns
    # Horizontal lines for table structure
    for y in range(100, height-100, 50):
        image[y:y+2, 50:width-50] = 0
        
    # Vertical lines for columns
    for x in range(50, width-50, 100):
        image[100:height-100, x:x+2] = 0
        
    # Add simulated text areas
    for y in range(150, height-150, 100):
        image[y:y+30, 100:width-100] = 200
        
    return image

@pytest.fixture(scope='function')
def test_document_metadata() -> Dict[str, Any]:
    """
    Provides test document metadata with additional properties.
    
    Returns:
        dict: Test metadata dictionary with enhanced properties
    """
    return {
        'document_properties': {
            'page_count': 2,
            'file_size': 1024 * 1024,  # 1MB
            'creation_date': '2023-01-01T00:00:00Z',
            'modification_date': '2023-01-01T00:00:00Z'
        },
        'processing_flags': {
            'requires_ocr': True,
            'has_handwriting': False,
            'is_encrypted': False,
            'requires_validation': True
        },
        'validation_rules': {
            'required_fields': ['business_name', 'ein', 'address'],
            'field_formats': {
                'business_name': '^[A-Za-z0-9\\s,.-]+$',
                'ein': '^\\d{2}-\\d{7}$',
                'address': '^[A-Za-z0-9\\s,.-]+$'
            },
            'confidence_thresholds': {
                'business_name': 0.95,
                'ein': 0.98,
                'address': 0.90
            }
        },
        'performance_metrics': {
            'processing_time': 0.0,
            'ocr_confidence': 0.0,
            'validation_score': 0.0,
            'error_count': 0
        }
    }