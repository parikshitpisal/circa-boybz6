import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest } from '@jest/globals';
import { axe } from '@axe-core/react';
import ExtractedData from './ExtractedData';
import { customRender } from '../../../tests/utils/test-utils';
import { Document } from '../../../interfaces/document.interface';
import { APPLICATION_STATUS, DOCUMENT_TYPE } from '../../../constants/application.constants';

// Mock document data for testing
const mockDocument: Document = {
  id: 'test-doc-1',
  applicationId: 'app-1',
  type: DOCUMENT_TYPE.BANK_STATEMENT,
  status: APPLICATION_STATUS.COMPLETED,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  metadata: {
    fileSize: 1024,
    mimeType: 'application/pdf',
    pageCount: 1,
    ocrConfidence: 0.95,
    processingDuration: 1500,
    extractedData: {
      business: {
        businessName: 'Test Company',
        ein: '12-3456789',
        dba: 'Test DBA'
      },
      owner: {
        firstName: 'John',
        lastName: 'Doe',
        ssn: '123-45-6789',
        phoneNumber: '555-0123'
      },
      financial: [
        {
          month: 'January',
          revenue: 50000,
          expenses: 30000,
          netIncome: 20000
        }
      ]
    },
    validationErrors: [],
    processingMetrics: {
      processingTime: 1500,
      queueWaitTime: 100,
      ocrAccuracy: 0.95,
      processingSteps: ['ocr', 'validation'],
      stepDurations: { ocr: 1000, validation: 500 }
    },
    retentionPolicy: {
      retentionDate: new Date('2024-01-01'),
      policyType: 'standard',
      complianceRequirements: ['GLBA'],
      archivalRequired: false
    },
    complianceFlags: []
  },
  securityInfo: {
    securityHash: 'hash123',
    encryptionStatus: true,
    lastValidated: new Date('2023-01-01'),
    accessHistory: []
  }
};

// Mock callback functions
const mockOnDataChange = jest.fn();

describe('ExtractedData Component', () => {
  // Helper function to render component with common props
  const renderExtractedData = (props = {}) => {
    return customRender(
      <ExtractedData
        document={mockDocument}
        onDataChange={mockOnDataChange}
        {...props}
      />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders extracted data fields correctly', () => {
    renderExtractedData();

    // Verify business information section
    expect(screen.getByText('Business Information')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Company')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12-3456789')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test DBA')).toBeInTheDocument();

    // Verify owner information section
    expect(screen.getByText('Owner Information')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();

    // Verify financial information section
    expect(screen.getByText('Financial Information')).toBeInTheDocument();
    const table = screen.getByRole('grid');
    expect(within(table).getByText('January')).toBeInTheDocument();
    expect(within(table).getByText('50000')).toBeInTheDocument();
  });

  it('handles data changes correctly', async () => {
    renderExtractedData();

    // Enable editing mode
    const editButton = screen.getByLabelText('Toggle edit mode');
    fireEvent.click(editButton);

    // Change business name
    const businessNameInput = screen.getByDisplayValue('Test Company');
    await userEvent.clear(businessNameInput);
    await userEvent.type(businessNameInput, 'Updated Company');

    expect(mockOnDataChange).toHaveBeenCalledWith(
      { businessName: 'Updated Company' },
      expect.objectContaining({
        isValid: true,
        fieldType: 'business'
      })
    );
  });

  it('displays validation errors correctly', () => {
    const documentWithErrors = {
      ...mockDocument,
      metadata: {
        ...mockDocument.metadata,
        validationErrors: ['Invalid business name']
      }
    };

    renderExtractedData({ document: documentWithErrors });

    expect(screen.getByText('Invalid business name')).toBeInTheDocument();
  });

  it('handles sensitive data masking correctly', () => {
    renderExtractedData({ securityLevel: 'sensitive' });

    // Verify SSN is masked
    const ssnInput = screen.getByDisplayValue(/\*{5}6789/);
    expect(ssnInput).toBeInTheDocument();
    expect(ssnInput).toBeDisabled();
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderExtractedData();

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify keyboard navigation
    const firstInput = screen.getByDisplayValue('Test Company');
    firstInput.focus();
    expect(document.activeElement).toBe(firstInput);

    // Test tab navigation
    userEvent.tab();
    expect(document.activeElement).not.toBe(firstInput);
  });

  it('integrates with theme correctly', () => {
    renderExtractedData();

    const section = screen.getByRole('region', { name: /extracted document data/i });
    expect(section).toHaveStyle({
      display: 'flex',
      flexDirection: 'column'
    });
  });

  it('handles read-only mode correctly', () => {
    renderExtractedData({ readOnly: true });

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });

    expect(screen.queryByLabelText('Toggle edit mode')).not.toBeInTheDocument();
  });

  it('displays OCR confidence indicator', () => {
    renderExtractedData();

    const confidenceValue = mockDocument.metadata.ocrConfidence * 100;
    expect(screen.getByText(`${confidenceValue}%`)).toBeInTheDocument();
  });

  it('handles performance monitoring', async () => {
    const { rerender } = renderExtractedData();

    // Measure initial render time
    const startTime = performance.now();
    rerender(
      <ExtractedData
        document={mockDocument}
        onDataChange={mockOnDataChange}
      />
    );
    const endTime = performance.now();

    // Verify render time is within acceptable range (100ms)
    expect(endTime - startTime).toBeLessThan(100);
  });

  it('validates field data correctly', async () => {
    renderExtractedData();

    // Enable editing mode
    const editButton = screen.getByLabelText('Toggle edit mode');
    fireEvent.click(editButton);

    // Test invalid input
    const einInput = screen.getByDisplayValue('12-3456789');
    await userEvent.clear(einInput);
    await userEvent.type(einInput, 'invalid-ein');

    expect(mockOnDataChange).toHaveBeenCalledWith(
      { ein: 'invalid-ein' },
      expect.objectContaining({
        isValid: false,
        errors: expect.arrayContaining(['Must be a valid EIN format'])
      })
    );
  });
});