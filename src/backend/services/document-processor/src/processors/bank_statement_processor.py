"""
Bank statement processor module implementing specialized OCR and data extraction
for bank statement documents with enhanced validation and security features.

External Dependencies:
numpy==1.24.0
logging (built-in)
datetime (built-in)
"""

import numpy as np
import logging
from datetime import datetime, timezone
from typing import Dict, Tuple, List, Any, Optional

from ..models.document import Document
from ..core.ocr_engine import OCREngine
from ..core.text_extractor import TextExtractor

# Constants for bank statement processing
BANK_STATEMENT_FIELDS = [
    'account_number',
    'routing_number', 
    'balance',
    'monthly_revenue',
    'transaction_history'
]

REQUIRED_CONFIDENCE = 0.95
MAX_PROCESSING_RETRIES = 3

class BankStatementProcessor:
    """
    Specialized processor for bank statement documents with enhanced validation,
    error handling, and security measures.
    """
    
    def __init__(self, ocr_engine: OCREngine, text_extractor: TextExtractor):
        """
        Initialize bank statement processor with required engines and configuration.
        
        Args:
            ocr_engine: Configured OCR engine instance
            text_extractor: Configured text extractor instance
        """
        self._ocr_engine = ocr_engine
        self._text_extractor = text_extractor
        self._logger = logging.getLogger(__name__)
        
        # Configure logging with sensitive data masking
        self._logger.addFilter(lambda record: self._mask_sensitive_data(record))
        
        # Verify engine configurations
        if not isinstance(ocr_engine, OCREngine) or not isinstance(text_extractor, TextExtractor):
            raise ValueError("Invalid engine configuration")

    def process_document(self, document: Document, image: np.ndarray) -> Tuple[bool, Dict[str, Any]]:
        """
        Process bank statement document with enhanced validation and security.
        
        Args:
            document: Document instance to process
            image: Input image as numpy array
            
        Returns:
            Tuple containing (success_status, extracted_data)
        """
        try:
            processing_start = datetime.now(timezone.utc)
            
            # Update document status
            document.update_status('PROCESSING', reason="Starting bank statement processing")
            
            # Extract text with enhanced preprocessing
            raw_text, confidence, ocr_metrics = self._ocr_engine.extract_text(
                image=image,
                enhance_preprocessing=True
            )
            
            # Extract structured financial data
            extracted_data = self._text_extractor.extract_financial_data(image)
            
            # Extract and validate transaction history
            transactions = self.extract_transaction_history(raw_text)
            if transactions:
                extracted_data['transaction_history'] = transactions
            
            # Validate extracted data
            is_valid, validation_message = self.validate_statement_data(extracted_data)
            
            # Update document metadata
            processing_duration = (datetime.now(timezone.utc) - processing_start).total_seconds()
            metadata = {
                'processing_duration': processing_duration,
                'ocr_confidence': confidence,
                'ocr_metrics': ocr_metrics,
                'validation_result': is_valid,
                'validation_message': validation_message,
                'processed_at': datetime.now(timezone.utc).isoformat()
            }
            document.update_metadata(metadata)
            
            # Update final status
            if is_valid and confidence >= REQUIRED_CONFIDENCE:
                document.update_status('COMPLETED', reason="Successfully processed bank statement")
                return True, extracted_data
            else:
                document.update_status('FAILED', reason=f"Validation failed: {validation_message}")
                return False, {'error': validation_message}
                
        except Exception as e:
            error_message = f"Bank statement processing error: {str(e)}"
            self._logger.error(error_message)
            document.update_status('FAILED', reason=error_message)
            return False, {'error': error_message}

    def validate_statement_data(self, extracted_data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validates extracted bank statement data with enhanced rules.
        
        Args:
            extracted_data: Dictionary of extracted data
            
        Returns:
            Tuple containing (validation_status, message)
        """
        try:
            # Check required fields
            missing_fields = [
                field for field in BANK_STATEMENT_FIELDS 
                if field not in extracted_data
            ]
            if missing_fields:
                return False, f"Missing required fields: {', '.join(missing_fields)}"
            
            # Validate account number
            account_number = extracted_data.get('account_number', '')
            if not account_number or len(account_number) < 8:
                return False, "Invalid account number format"
            
            # Validate routing number (ABA format)
            routing_number = extracted_data.get('routing_number', '')
            if not routing_number or len(routing_number) != 9:
                return False, "Invalid routing number format"
            
            # Validate balance format and value
            balance = extracted_data.get('balance', 0)
            if not isinstance(balance, (int, float)) or balance < 0:
                return False, "Invalid balance value"
            
            # Validate monthly revenue
            monthly_revenue = extracted_data.get('monthly_revenue', 0)
            if not isinstance(monthly_revenue, (int, float)) or monthly_revenue < 0:
                return False, "Invalid monthly revenue value"
            
            # Validate transaction history if present
            if 'transaction_history' in extracted_data:
                transactions = extracted_data['transaction_history']
                if not isinstance(transactions, list):
                    return False, "Invalid transaction history format"
                
                # Validate transaction sequence
                for transaction in transactions:
                    if not all(k in transaction for k in ['date', 'description', 'amount']):
                        return False, "Invalid transaction format"
            
            return True, "Validation successful"
            
        except Exception as e:
            error_message = f"Validation error: {str(e)}"
            self._logger.error(error_message)
            return False, error_message

    def extract_transaction_history(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts and normalizes transaction history from statement.
        
        Args:
            text: Raw text from OCR processing
            
        Returns:
            List of transaction dictionaries
        """
        try:
            transactions = []
            
            # Find transaction section using pattern matching
            transaction_lines = self._extract_transaction_lines(text)
            
            for line in transaction_lines:
                try:
                    # Parse transaction components
                    transaction = self._parse_transaction_line(line)
                    if transaction:
                        transactions.append(transaction)
                except Exception as e:
                    self._logger.warning(f"Error parsing transaction line: {str(e)}")
                    continue
            
            # Sort transactions by date
            transactions.sort(key=lambda x: x['date'])
            
            # Calculate running balance
            balance = 0
            for transaction in transactions:
                balance += transaction['amount']
                transaction['running_balance'] = balance
            
            return transactions
            
        except Exception as e:
            self._logger.error(f"Transaction history extraction error: {str(e)}")
            return []

    def _extract_transaction_lines(self, text: str) -> List[str]:
        """Extract transaction lines from text using pattern matching."""
        import re
        
        # Pattern for transaction lines
        transaction_pattern = r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\s+.*?\s+[-]?\$?\d+[.,]\d{2}'
        
        # Find all matching lines
        matches = re.finditer(transaction_pattern, text)
        return [match.group() for match in matches]

    def _parse_transaction_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse individual transaction line into structured format."""
        import re
        
        try:
            # Pattern for components
            date_pattern = r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})'
            amount_pattern = r'[-]?\$?(\d+[.,]\d{2})'
            
            # Extract components
            date_match = re.search(date_pattern, line)
            amount_match = re.search(amount_pattern, line)
            
            if not date_match or not amount_match:
                return None
            
            # Extract description (text between date and amount)
            description = line[date_match.end():amount_match.start()].strip()
            
            # Parse amount
            amount_str = amount_match.group(1).replace(',', '')
            amount = float(amount_str)
            
            # Normalize date format
            date_str = date_match.group(1)
            date_obj = datetime.strptime(date_str, '%m/%d/%Y')
            
            return {
                'date': date_obj.isoformat(),
                'description': description,
                'amount': amount,
                'original_text': line
            }
            
        except Exception as e:
            self._logger.warning(f"Transaction parsing error: {str(e)}")
            return None

    def _mask_sensitive_data(self, record: logging.LogRecord) -> bool:
        """Mask sensitive data in log records."""
        sensitive_patterns = {
            'account_number': r'\d{8,17}',
            'routing_number': r'\d{9}',
            'ssn': r'\d{3}-\d{2}-\d{4}'
        }
        
        for field, pattern in sensitive_patterns.items():
            if hasattr(record, 'msg'):
                record.msg = re.sub(pattern, '***', str(record.msg))
                
        return True