"""
Advanced document classification module implementing ensemble approach with ML/DL models.
Provides highly accurate document type identification with extensive validation.

External Dependencies:
numpy==1.24.0
scikit-learn==1.3.0
tensorflow==2.13.0
"""

import numpy as np
import tensorflow as tf
from sklearn.ensemble import RandomForestClassifier
from typing import Dict, Tuple, List, Optional
import logging
import json
import os

from ..models.document import Document
from .ocr_engine import OCREngine
from ..utils.image_utils import optimize_for_ocr

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
MODEL_PATH = 'models/document_classifier.h5'
CONFIDENCE_THRESHOLD = 0.95
DOCUMENT_FEATURES = ["text_density", "image_size", "aspect_ratio", "key_phrases", "layout_pattern", "content_structure"]
RETRY_ATTEMPTS = 3
ERROR_THRESHOLD = 0.05

# Document type specific patterns
DOCUMENT_PATTERNS = {
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

class DocumentClassifier:
    """
    Advanced document classification class implementing ensemble approach with ML/DL models
    and pattern recognition for highly accurate document type identification.
    """
    
    def __init__(self, 
                model_path: str = MODEL_PATH,
                confidence_threshold: float = CONFIDENCE_THRESHOLD,
                feature_config: Dict = None):
        """
        Initialize document classifier with ML/DL models and configurations.
        
        Args:
            model_path: Path to pre-trained models
            confidence_threshold: Minimum confidence threshold for classification
            feature_config: Custom feature extraction configuration
        """
        try:
            # Initialize OCR engine
            self._ocr_engine = OCREngine()
            
            # Load ML model (Random Forest)
            self._ml_model = RandomForestClassifier()
            ml_model_path = os.path.join(model_path, 'rf_classifier.joblib')
            if os.path.exists(ml_model_path):
                self._ml_model = tf.keras.models.load_model(ml_model_path)
            else:
                logger.warning("ML model not found, initializing new model")
            
            # Load DL model (CNN)
            self._dl_model = None
            dl_model_path = os.path.join(model_path, 'cnn_classifier.h5')
            if os.path.exists(dl_model_path):
                self._dl_model = tf.keras.models.load_model(dl_model_path)
            else:
                logger.warning("DL model not found, classification will rely on ML model")
            
            # Set configuration
            self._confidence_threshold = confidence_threshold
            self._document_patterns = DOCUMENT_PATTERNS
            self._feature_extractors = feature_config or {}
            
            logger.info("Document classifier initialized successfully")
            
        except Exception as e:
            logger.error(f"Classifier initialization error: {str(e)}")
            raise RuntimeError(f"Failed to initialize document classifier: {str(e)}")

    def classify_document(self, image: np.ndarray, document: Document) -> Tuple[str, float, Dict]:
        """
        Classifies document using ensemble approach with multiple models.
        
        Args:
            image: Input image as numpy array
            document: Document instance for metadata updates
            
        Returns:
            Tuple of (document_type, confidence_score, classification_metadata)
        """
        try:
            # Preprocess image
            processed_image = optimize_for_ocr(image)
            
            # Extract text using OCR
            text, ocr_confidence, ocr_metrics = self._ocr_engine.extract_text(
                processed_image,
                enhance_preprocessing=True
            )
            
            # Extract features
            features = self.extract_features(processed_image, {'text': text, 'confidence': ocr_confidence})
            
            # ML model classification
            ml_prediction = self._ml_model.predict_proba([features])[0]
            ml_class_idx = np.argmax(ml_prediction)
            ml_confidence = ml_prediction[ml_class_idx]
            
            # DL model classification if available
            dl_confidence = 0.0
            if self._dl_model:
                dl_prediction = self._dl_model.predict(np.expand_dims(processed_image, axis=0))[0]
                dl_class_idx = np.argmax(dl_prediction)
                dl_confidence = dl_prediction[dl_class_idx]
            
            # Pattern-based validation
            pattern_results = self._validate_patterns(text, features)
            
            # Ensemble decision
            ensemble_weights = {
                'ml_model': 0.4,
                'dl_model': 0.3 if self._dl_model else 0.0,
                'pattern_matching': 0.3 if self._dl_model else 0.6
            }
            
            final_confidence = (
                ml_confidence * ensemble_weights['ml_model'] +
                dl_confidence * ensemble_weights['dl_model'] +
                pattern_results['confidence'] * ensemble_weights['pattern_matching']
            )
            
            # Get predicted document type
            doc_type = list(DOCUMENT_PATTERNS.keys())[ml_class_idx]
            
            # Validate classification
            is_valid, validation_message = self.validate_classification(
                doc_type, final_confidence, pattern_results
            )
            
            if not is_valid:
                logger.warning(f"Classification validation failed: {validation_message}")
                raise ValueError(f"Classification validation failed: {validation_message}")
            
            # Update document metadata
            classification_metadata = {
                'ml_confidence': float(ml_confidence),
                'dl_confidence': float(dl_confidence),
                'pattern_confidence': pattern_results['confidence'],
                'ensemble_confidence': float(final_confidence),
                'ocr_metrics': ocr_metrics,
                'validation_result': validation_message
            }
            document.update_metadata({'classification': classification_metadata})
            
            return doc_type, final_confidence, classification_metadata
            
        except Exception as e:
            logger.error(f"Document classification error: {str(e)}")
            raise

    def extract_features(self, image: np.ndarray, ocr_results: Dict) -> np.ndarray:
        """
        Extracts comprehensive feature set from document.
        
        Args:
            image: Input image as numpy array
            ocr_results: Results from OCR processing
            
        Returns:
            Feature vector as numpy array
        """
        try:
            features = []
            
            # Text density features
            text = ocr_results.get('text', '')
            features.append(len(text.split()) / 1000.0)  # Normalized word count
            features.append(len(text) / (image.shape[0] * image.shape[1]))  # Text density
            
            # Image size and aspect ratio
            height, width = image.shape[:2]
            features.append(width / 1000.0)  # Normalized width
            features.append(height / 1000.0)  # Normalized height
            features.append(width / height)  # Aspect ratio
            
            # Layout pattern features
            layout_features = self._extract_layout_features(image)
            features.extend(layout_features)
            
            # Content structure features
            content_features = self._extract_content_features(text)
            features.extend(content_features)
            
            return np.array(features, dtype=np.float32)
            
        except Exception as e:
            logger.error(f"Feature extraction error: {str(e)}")
            raise

    @staticmethod
    def validate_classification(doc_type: str, confidence: float, metadata: Dict) -> Tuple[bool, str]:
        """
        Validates classification using multi-step verification.
        
        Args:
            doc_type: Predicted document type
            confidence: Classification confidence score
            metadata: Classification metadata
            
        Returns:
            Tuple of (is_valid, validation_message)
        """
        try:
            # Check confidence threshold
            if confidence < CONFIDENCE_THRESHOLD:
                return False, f"Confidence {confidence} below threshold {CONFIDENCE_THRESHOLD}"
            
            # Validate document type
            if doc_type not in DOCUMENT_PATTERNS:
                return False, f"Invalid document type: {doc_type}"
            
            # Check pattern matching confidence
            pattern_confidence = metadata.get('confidence', 0.0)
            if pattern_confidence < CONFIDENCE_THRESHOLD - ERROR_THRESHOLD:
                return False, f"Pattern matching confidence too low: {pattern_confidence}"
            
            return True, "Classification validated successfully"
            
        except Exception as e:
            logger.error(f"Classification validation error: {str(e)}")
            raise

    def _extract_layout_features(self, image: np.ndarray) -> List[float]:
        """Extract layout-specific features from the image."""
        try:
            # Convert to grayscale if needed
            gray = image if len(image.shape) == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Edge detection for layout analysis
            edges = cv2.Canny(gray, 50, 150)
            
            # Calculate layout features
            horizontal_lines = cv2.HoughLinesP(edges, 1, np.pi/2, 100, minLineLength=100)
            vertical_lines = cv2.HoughLinesP(edges, 1, np.pi/2, 100, minLineLength=100)
            
            return [
                len(horizontal_lines) if horizontal_lines is not None else 0,
                len(vertical_lines) if vertical_lines is not None else 0,
                np.mean(gray) / 255.0,
                np.std(gray) / 255.0
            ]
            
        except Exception as e:
            logger.error(f"Layout feature extraction error: {str(e)}")
            return [0.0] * 4

    def _extract_content_features(self, text: str) -> List[float]:
        """Extract content-specific features from the text."""
        try:
            features = []
            
            # Calculate features for each document type
            for doc_type, patterns in self._document_patterns.items():
                # Key phrase matching
                phrase_matches = sum(1 for phrase in patterns['key_phrases'] 
                                  if phrase.lower() in text.lower())
                features.append(phrase_matches / len(patterns['key_phrases']))
                
                # Layout type matching
                layout_score = 1.0 if patterns['layout'] in text.lower() else 0.0
                features.append(layout_score)
                
                # Content ratio
                content_ratio = len(text) / (1000 * patterns['content_ratio'])
                features.append(min(content_ratio, 1.0))
            
            return features
            
        except Exception as e:
            logger.error(f"Content feature extraction error: {str(e)}")
            return [0.0] * (len(self._document_patterns) * 3)

    def _validate_patterns(self, text: str, features: np.ndarray) -> Dict:
        """Validate document patterns and calculate pattern matching confidence."""
        try:
            results = {
                'matches': {},
                'confidence': 0.0
            }
            
            # Check patterns for each document type
            for doc_type, patterns in self._document_patterns.items():
                matches = []
                
                # Key phrase matching
                phrase_matches = sum(1 for phrase in patterns['key_phrases'] 
                                  if phrase.lower() in text.lower())
                phrase_score = phrase_matches / len(patterns['key_phrases'])
                matches.append(phrase_score)
                
                # Layout matching
                layout_score = 1.0 if patterns['layout'] in text.lower() else 0.0
                matches.append(layout_score)
                
                # Content ratio matching
                content_score = min(len(text) / (1000 * patterns['content_ratio']), 1.0)
                matches.append(content_score)
                
                # Calculate confidence for this document type
                type_confidence = np.mean(matches)
                results['matches'][doc_type] = {
                    'confidence': type_confidence,
                    'matches': matches
                }
            
            # Overall pattern matching confidence
            results['confidence'] = max(match['confidence'] 
                                     for match in results['matches'].values())
            
            return results
            
        except Exception as e:
            logger.error(f"Pattern validation error: {str(e)}")
            return {'matches': {}, 'confidence': 0.0}