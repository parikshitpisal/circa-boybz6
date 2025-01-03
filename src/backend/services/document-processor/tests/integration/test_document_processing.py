"""
Integration tests for the document processing pipeline.
Validates end-to-end document classification, OCR processing, and data extraction workflows.

Version: 1.0.0
"""

import pytest
import numpy as np
from itertools import product
import time
from typing import Dict, Any

from ...src.core.document_classifier import DocumentClassifier
from ...src.core.text_extractor import TextExtractor

# Test configuration constants
TEST_DOCUMENT_TYPES = ["BANK_STATEMENT", "ISO_APPLICATION", "VOIDED_CHECK"]
CONFIDENCE_THRESHOLD = 0.95
PROCESSING_TIME_LIMITS = {
    "classification": 2,  # seconds
    "ocr": 2,
    "extraction": 1,
    "total": 5
}
TEST_DATA_QUALITIES = ["HIGH", "MEDIUM", "LOW"]

@pytest.mark.integration
@pytest.mark.parametrize('doc_type', TEST_DOCUMENT_TYPES)
def test_document_classification_pipeline(mock_document, mock_document_classifier, test_image_data):
    """
    Tests end-to-end document classification pipeline with accuracy validation.
    
    Args:
        mock_document: Document test fixture
        mock_document_classifier: Document classifier test fixture
        test_image_data: Test image data fixture
    """
    try:
        # Initialize test data
        mock_document.type = doc_type
        start_time = time.time()

        # Process document through classification pipeline
        doc_type, confidence, metadata = mock_document_classifier.classify_document(
            test_image_data, 
            mock_document
        )

        # Verify processing time
        processing_time = time.time() - start_time
        assert processing_time < PROCESSING_TIME_LIMITS["classification"], \
            f"Classification exceeded time limit: {processing_time}s"

        # Validate classification results
        assert doc_type in TEST_DOCUMENT_TYPES, \
            f"Invalid document type classification: {doc_type}"
        assert confidence >= CONFIDENCE_THRESHOLD, \
            f"Classification confidence below threshold: {confidence}"

        # Verify metadata updates
        assert 'classification' in mock_document.metadata, \
            "Classification metadata not updated"
        assert mock_document.metadata['classification']['ml_confidence'] >= CONFIDENCE_THRESHOLD, \
            "ML model confidence below threshold"
        
        # Validate consistency across multiple runs
        for _ in range(3):
            repeat_type, repeat_confidence, _ = mock_document_classifier.classify_document(
                test_image_data,
                mock_document
            )
            assert repeat_type == doc_type, "Inconsistent classification results"
            assert abs(repeat_confidence - confidence) < 0.05, \
                "Classification confidence varies significantly between runs"

    except Exception as e:
        pytest.fail(f"Classification pipeline test failed: {str(e)}")

@pytest.mark.integration
@pytest.mark.parametrize('quality', TEST_DATA_QUALITIES)
def test_ocr_processing_pipeline(mock_document, mock_ocr_engine, test_image_data):
    """
    Tests end-to-end OCR processing pipeline with accuracy validation.
    
    Args:
        mock_document: Document test fixture
        mock_ocr_engine: OCR engine test fixture
        test_image_data: Test image data fixture
    """
    try:
        start_time = time.time()

        # Process document through OCR pipeline
        text, confidence, metrics = mock_ocr_engine.extract_text(
            test_image_data,
            enhance_preprocessing=True
        )

        # Verify processing time
        processing_time = time.time() - start_time
        assert processing_time < PROCESSING_TIME_LIMITS["ocr"], \
            f"OCR processing exceeded time limit: {processing_time}s"

        # Validate OCR results
        assert text, "No text extracted from document"
        assert confidence >= CONFIDENCE_THRESHOLD, \
            f"OCR confidence below threshold: {confidence}"

        # Verify OCR metrics
        assert 'confidence_score' in metrics, "Missing confidence score in metrics"
        assert 'processing_attempts' in metrics, "Missing processing attempts in metrics"
        assert metrics['enhancement_applied'], "Image enhancement not applied"

        # Test error handling for poor quality images
        if quality == "LOW":
            noisy_image = np.random.normal(0, 1, test_image_data.shape)
            with pytest.raises(Exception):
                mock_ocr_engine.extract_text(noisy_image)

    except Exception as e:
        pytest.fail(f"OCR pipeline test failed: {str(e)}")

@pytest.mark.integration
@pytest.mark.parametrize('doc_type', TEST_DOCUMENT_TYPES)
def test_data_extraction_pipeline(mock_document, text_extractor, test_image_data):
    """
    Tests end-to-end data extraction pipeline with field validation.
    
    Args:
        mock_document: Document test fixture
        text_extractor: Text extractor test fixture
        test_image_data: Test image data fixture
    """
    try:
        mock_document.type = doc_type
        start_time = time.time()

        # Process document through extraction pipeline
        extracted_data, confidence = text_extractor.extract_structured_data(
            test_image_data,
            doc_type
        )

        # Verify processing time
        processing_time = time.time() - start_time
        assert processing_time < PROCESSING_TIME_LIMITS["extraction"], \
            f"Data extraction exceeded time limit: {processing_time}s"

        # Validate extraction results
        assert extracted_data, "No data extracted from document"
        assert confidence >= CONFIDENCE_THRESHOLD, \
            f"Extraction confidence below threshold: {confidence}"

        # Verify required fields based on document type
        if doc_type == "BANK_STATEMENT":
            required_fields = ['account_number', 'routing_number', 'balance']
        elif doc_type == "ISO_APPLICATION":
            required_fields = ['business_name', 'ein', 'owner_name']
        else:  # VOIDED_CHECK
            required_fields = ['account_number', 'routing_number', 'bank_name']

        for field in required_fields:
            assert field in extracted_data, f"Missing required field: {field}"
            assert extracted_data[field]['value'], f"Empty value for field: {field}"
            assert extracted_data[field]['confidence'] >= CONFIDENCE_THRESHOLD, \
                f"Low confidence for field: {field}"

    except Exception as e:
        pytest.fail(f"Data extraction pipeline test failed: {str(e)}")

@pytest.mark.integration
@pytest.mark.parametrize('doc_type,quality', product(TEST_DOCUMENT_TYPES, TEST_DATA_QUALITIES))
def test_end_to_end_processing(mock_document, mock_document_classifier, mock_ocr_engine, 
                             text_extractor, test_image_data):
    """
    Tests complete end-to-end document processing pipeline.
    
    Args:
        mock_document: Document test fixture
        mock_document_classifier: Document classifier test fixture
        mock_ocr_engine: OCR engine test fixture
        text_extractor: Text extractor test fixture
        test_image_data: Test image data fixture
    """
    try:
        mock_document.type = doc_type
        start_time = time.time()

        # Step 1: Document Classification
        doc_type, classification_confidence, _ = mock_document_classifier.classify_document(
            test_image_data,
            mock_document
        )
        assert doc_type in TEST_DOCUMENT_TYPES, f"Invalid document type: {doc_type}"
        assert classification_confidence >= CONFIDENCE_THRESHOLD

        # Step 2: OCR Processing
        text, ocr_confidence, ocr_metrics = mock_ocr_engine.extract_text(
            test_image_data,
            enhance_preprocessing=True
        )
        assert text and ocr_confidence >= CONFIDENCE_THRESHOLD

        # Step 3: Data Extraction
        extracted_data, extraction_confidence = text_extractor.extract_structured_data(
            test_image_data,
            doc_type
        )
        assert extracted_data and extraction_confidence >= CONFIDENCE_THRESHOLD

        # Verify total processing time
        total_time = time.time() - start_time
        assert total_time < PROCESSING_TIME_LIMITS["total"], \
            f"Total processing exceeded time limit: {total_time}s"

        # Validate end-to-end accuracy
        overall_confidence = (classification_confidence + ocr_confidence + extraction_confidence) / 3
        assert overall_confidence >= CONFIDENCE_THRESHOLD, \
            f"Overall confidence below threshold: {overall_confidence}"

        # Verify document metadata updates
        assert 'classification' in mock_document.metadata
        assert 'ocr_metrics' in mock_document.metadata
        assert 'extraction_results' in mock_document.metadata

        # Test error handling and recovery
        if quality == "LOW":
            with pytest.raises(Exception):
                noisy_image = np.random.normal(0, 1, test_image_data.shape)
                mock_document_classifier.classify_document(noisy_image, mock_document)

        # Verify resource cleanup
        assert mock_document.status != "PROCESSING"
        assert not hasattr(mock_document, '_temp_data')

    except Exception as e:
        pytest.fail(f"End-to-end pipeline test failed: {str(e)}")