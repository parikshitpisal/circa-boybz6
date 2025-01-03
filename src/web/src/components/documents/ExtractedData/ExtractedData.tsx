import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  TextField, 
  Typography, 
  Box, 
  Alert, 
  CircularProgress,
  Tooltip,
  IconButton
} from '@mui/material'; // ^5.0.0
import EditIcon from '@mui/icons-material/Edit'; // ^5.0.0
import LockIcon from '@mui/icons-material/Lock'; // ^5.0.0
import Card from '../../common/Card/Card';
import Table from '../../common/Table/Table';
import { Document } from '../../../interfaces/document.interface';
import { APPLICATION_STATUS, DOCUMENT_TYPE } from '../../../constants/application.constants';

// Field type definitions for data organization
const FIELD_TYPES = {
  BUSINESS_INFO: 'business',
  OWNER_INFO: 'owner',
  FINANCIAL_INFO: 'financial'
} as const;

// Validation rules for different field types
const VALIDATION_RULES = {
  [FIELD_TYPES.BUSINESS_INFO]: ['required', 'format', 'length'],
  [FIELD_TYPES.OWNER_INFO]: ['required', 'format', 'sensitive'],
  [FIELD_TYPES.FINANCIAL_INFO]: ['required', 'numeric', 'range']
} as const;

// Security levels for data masking
type SecurityLevel = 'standard' | 'sensitive' | 'restricted';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fieldType: keyof typeof FIELD_TYPES;
}

interface ExtractedDataProps {
  document: Document;
  onDataChange: (data: Record<string, any>, validationResult: ValidationResult) => void;
  readOnly?: boolean;
  securityLevel?: SecurityLevel;
}

/**
 * Component for displaying and editing extracted document data with validation and security features
 */
const ExtractedData: React.FC<ExtractedDataProps> = ({
  document,
  onDataChange,
  readOnly = false,
  securityLevel = 'standard'
}) => {
  const [extractedData, setExtractedData] = useState<Record<string, any>>(document.metadata.extractedData);
  const [validationErrors, setValidationErrors] = useState<string[]>(document.metadata.validationErrors);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Mask sensitive data based on security level
  const maskSensitiveData = useCallback((value: string, fieldType: string): string => {
    if (securityLevel === 'restricted' && fieldType === FIELD_TYPES.OWNER_INFO) {
      return '*'.repeat(value.length);
    }
    if (securityLevel === 'sensitive' && fieldType === FIELD_TYPES.OWNER_INFO) {
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    }
    return value;
  }, [securityLevel]);

  // Validate field based on type and rules
  const validateField = useCallback((value: any, fieldType: keyof typeof FIELD_TYPES): ValidationResult => {
    const errors: string[] = [];
    const rules = VALIDATION_RULES[fieldType];

    rules.forEach(rule => {
      switch (rule) {
        case 'required':
          if (!value) errors.push('Field is required');
          break;
        case 'numeric':
          if (isNaN(Number(value))) errors.push('Must be a number');
          break;
        case 'format':
          // Add specific format validation logic
          break;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      fieldType
    };
  }, []);

  // Handle field changes with validation
  const handleFieldChange = useCallback((fieldName: string, value: any, fieldType: keyof typeof FIELD_TYPES) => {
    const validationResult = validateField(value, fieldType);
    
    setExtractedData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    setValidationErrors(prev => 
      validationResult.isValid 
        ? prev.filter(error => !error.includes(fieldName))
        : [...prev, ...validationResult.errors]
    );

    onDataChange({ [fieldName]: value }, validationResult);
  }, [validateField, onDataChange]);

  // Financial data table columns
  const financialColumns = useMemo(() => [
    { field: 'month', headerName: 'Month', width: 120 },
    { field: 'revenue', headerName: 'Revenue', width: 150, type: 'number' },
    { field: 'expenses', headerName: 'Expenses', width: 150, type: 'number' },
    { field: 'netIncome', headerName: 'Net Income', width: 150, type: 'number' }
  ], []);

  return (
    <Box 
      component="section" 
      aria-label="Extracted Document Data"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationErrors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      {/* Business Information Section */}
      <Card elevation={2}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Business Information
            {!readOnly && (
              <IconButton 
                onClick={() => setIsEditing(!isEditing)}
                aria-label="Toggle edit mode"
                size="small"
                sx={{ ml: 1 }}
              >
                <EditIcon />
              </IconButton>
            )}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            {Object.entries(extractedData.business || {}).map(([field, value]) => (
              <TextField
                key={field}
                label={field.replace(/([A-Z])/g, ' $1').trim()}
                value={value}
                onChange={(e) => handleFieldChange(field, e.target.value, FIELD_TYPES.BUSINESS_INFO)}
                disabled={!isEditing || readOnly}
                fullWidth
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Box>
      </Card>

      {/* Owner Information Section */}
      <Card elevation={2}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Owner Information
            <Tooltip title={securityLevel === 'restricted' ? 'Restricted Access' : 'Sensitive Data'}>
              <LockIcon sx={{ ml: 1, fontSize: '1rem', color: 'warning.main' }} />
            </Tooltip>
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            {Object.entries(extractedData.owner || {}).map(([field, value]) => (
              <TextField
                key={field}
                label={field.replace(/([A-Z])/g, ' $1').trim()}
                value={maskSensitiveData(String(value), FIELD_TYPES.OWNER_INFO)}
                onChange={(e) => handleFieldChange(field, e.target.value, FIELD_TYPES.OWNER_INFO)}
                disabled={!isEditing || readOnly || securityLevel === 'restricted'}
                fullWidth
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Box>
      </Card>

      {/* Financial Information Section */}
      <Card elevation={2}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Financial Information
          </Typography>
          <Table
            columns={financialColumns}
            data={extractedData.financial || []}
            loading={false}
            pageSize={5}
            onSortChange={(field, direction) => {
              // Handle sorting
            }}
          />
        </Box>
      </Card>
    </Box>
  );
};

export default ExtractedData;