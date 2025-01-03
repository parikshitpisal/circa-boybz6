import pytest
import numpy as np
from unittest.mock import Mock, patch
from datetime import datetime, timezone
from uuid import uuid4

from ....shared.constants import DOCUMENT_TYPES, APPLICATION_STATUS
from ../../src.core.document_classifier import DocumentClassifier, CONFIDENCE_THRESHOLD
from ../../src.models.document import Document

# Test constants
TEST_MODEL_PATH = "tests/data/test_model.h5"
TEST_IMAGE_SIZE = (1000, 800)
TEST_CONFIDENCE_THRESHOLD = 0.95
VALID_DOCUMENT_TYPES = [t.value for t in DOCUMENT_TYPES]

@pytest.fixture
def mock_document():
    """Fixture for creating a test document instance"""
    return Document(
        id=uuid4(),
        application_id=uuid4(),
        type=DOCUMENT_TYPES.BANK_STATEMENT.value,
        status=APPLICATION_STATUS.PENDING.value,
        storage_path="test/path/document.pdf",
        ocr_confidence=0.98
    )

@pytest.fixture
def mock_document_classifier():
    """Fixture for creating a DocumentClassifier instance with mocked dependencies"""
    with patch('tensorflow.keras.models.load_model') as mock_load_model:
        classifier = DocumentClassifier(
            model_path=TEST_MODEL_PATH,
            confidence_threshold=TEST_CONFIDENCE_THRESHOLD
        )
        return classifier

@pytest.fixture
def test_image_data():
    """Fixture for creating test image data"""
    return np.random.randint(0, 255, TEST_IMAGE_SIZE, dtype=np.uint8)

@pytest.mark.unit
def test_document_classifier_initialization(mock_document_classifier):
    """Test DocumentClassifier initialization and configuration"""
    assert mock_document_classifier._confidence_threshold == TEST_CONFIDENCE_THRESHOLD
    assert mock_document_classifier._document_patterns is not None
    assert all(doc_type in mock_document_classifier._document_patterns 
              for doc_type in VALID_DOCUMENT_TYPES)
    assert mock_document_classifier._ocr_engine is not None
    assert mock_document_classifier._ml_model is not None

@pytest.mark.unit
def test_classify_document_bank_statement(mock_document_classifier, mock_document, test_image_data):
    """Test successful classification of a bank statement document"""
    # Mock OCR engine response
    mock_ocr_text = """
    BANK STATEMENT
    Account Number: 1234567890
    Statement Period: 01/01/2023 - 01/31/2023
    Balance: $10,000.00
    """
    mock_document_classifier._ocr_engine.extract_text.return_value = (
        mock_ocr_text, 0.98, {"word_count": 20}
    )

    # Mock ML model prediction
    mock_document_classifier._ml_model.predict_proba.return_value = np.array([[0.96, 0.02, 0.02]])

    # Execute classification
    doc_type, confidence, metadata = mock_document_classifier.classify_document(
        test_image_data, 
        mock_document
    )

    # Verify results
    assert doc_type == DOCUMENT_TYPES.BANK_STATEMENT.value
    assert confidence >= TEST_CONFIDENCE_THRESHOLD
    assert "ml_confidence" in metadata
    assert "pattern_confidence" in metadata
    assert "ocr_metrics" in metadata
    assert metadata["ensemble_confidence"] >= TEST_CONFIDENCE_THRESHOLD

@pytest.mark.unit
def test_classify_document_low_confidence(mock_document_classifier, mock_document, test_image_data):
    """Test classification behavior with low confidence scores"""
    # Mock OCR engine response with low confidence
    mock_ocr_text = "Unclear document content"
    mock_document_classifier._ocr_engine.extract_text.return_value = (
        mock_ocr_text, 0.45, {"word_count": 3}
    )

    # Mock ML model prediction with low confidence
    mock_document_classifier._ml_model.predict_proba.return_value = np.array([[0.4, 0.3, 0.3]])

    # Verify classification raises appropriate error
    with pytest.raises(ValueError) as exc_info:
        mock_document_classifier.classify_document(test_image_data, mock_document)
    
    assert "Classification validation failed" in str(exc_info.value)
    assert mock_document.status == APPLICATION_STATUS.PENDING.value

@pytest.mark.unit
def test_extract_features(mock_document_classifier, test_image_data):
    """Test feature extraction functionality"""
    # Mock OCR results
    ocr_results = {
        "text": "Sample bank statement text",
        "confidence": 0.98
    }

    # Extract features
    features = mock_document_classifier.extract_features(test_image_data, ocr_results)

    # Verify feature vector
    assert isinstance(features, np.ndarray)
    assert features.dtype == np.float32
    assert len(features) > 0
    assert all(isinstance(f, (int, float)) for f in features)

@pytest.mark.unit
def test_validate_classification():
    """Test classification validation logic"""
    # Test valid classification
    is_valid, message = DocumentClassifier.validate_classification(
        DOCUMENT_TYPES.BANK_STATEMENT.value,
        0.96,
        {"confidence": 0.95}
    )
    assert is_valid
    assert "validated successfully" in message

    # Test invalid confidence
    is_valid, message = DocumentClassifier.validate_classification(
        DOCUMENT_TYPES.BANK_STATEMENT.value,
        0.80,
        {"confidence": 0.85}
    )
    assert not is_valid
    assert "below threshold" in message

@pytest.mark.unit
def test_classify_document_invalid_image(mock_document_classifier, mock_document):
    """Test classification behavior with invalid image input"""
    invalid_image = np.zeros((10, 10), dtype=np.uint8)  # Too small image

    with pytest.raises(ValueError) as exc_info:
        mock_document_classifier.classify_document(invalid_image, mock_document)
    
    assert "Invalid image" in str(exc_info.value)

@pytest.mark.unit
def test_classify_document_pattern_matching(mock_document_classifier, mock_document, test_image_data):
    """Test pattern-based validation in document classification"""
    # Mock OCR engine response with specific patterns
    mock_ocr_text = """
    VOID
    Pay to the order of: Test Company
    Routing Number: 123456789
    Account Number: 987654321
    """
    mock_document_classifier._ocr_engine.extract_text.return_value = (
        mock_ocr_text, 0.97, {"word_count": 15}
    )

    # Mock ML model prediction
    mock_document_classifier._ml_model.predict_proba.return_value = np.array([[0.05, 0.05, 0.90]])

    # Execute classification
    doc_type, confidence, metadata = mock_document_classifier.classify_document(
        test_image_data, 
        mock_document
    )

    # Verify results
    assert doc_type == DOCUMENT_TYPES.VOIDED_CHECK.value
    assert metadata["pattern_confidence"] >= TEST_CONFIDENCE_THRESHOLD
    assert "validation_result" in metadata

@pytest.mark.unit
def test_document_metadata_update(mock_document_classifier, mock_document, test_image_data):
    """Test document metadata updates during classification"""
    # Mock successful classification
    mock_ocr_text = "BANK STATEMENT"
    mock_document_classifier._ocr_engine.extract_text.return_value = (
        mock_ocr_text, 0.98, {"word_count": 2}
    )
    mock_document_classifier._ml_model.predict_proba.return_value = np.array([[0.96, 0.02, 0.02]])

    # Perform classification
    mock_document_classifier.classify_document(test_image_data, mock_document)

    # Verify metadata updates
    assert "classification" in mock_document.metadata
    assert isinstance(mock_document.metadata["classification"], dict)
    assert "ml_confidence" in mock_document.metadata["classification"]
    assert "ensemble_confidence" in mock_document.metadata["classification"]
    assert mock_document.updated_at > mock_document.created_at