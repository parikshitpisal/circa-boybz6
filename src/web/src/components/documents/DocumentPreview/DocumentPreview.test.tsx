import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import DocumentPreview from './DocumentPreview';
import { customRender } from '../../../tests/utils/test-utils';
import { formatDocumentMetadata, getDocumentStatusColor, formatDocumentName } from '../../../utils/document.utils';
import { DOCUMENT_TYPE, APPLICATION_STATUS } from '../../../constants/application.constants';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock document data
const mockDocument = {
  id: 'doc-123',
  type: DOCUMENT_TYPE.BANK_STATEMENT,
  status: APPLICATION_STATUS.PROCESSING,
  metadata: {
    fileSize: 1024 * 1024, // 1MB
    ocrConfidence: 0.95,
    pageCount: 3,
    securityLevel: 'restricted',
    accessControl: {
      allowedRoles: ['ADMIN', 'OPERATOR'],
      requiredPermissions: ['document:view']
    }
  },
  securityInfo: {
    securityHash: 'abc123',
    encryptionStatus: true,
    lastValidated: new Date(),
    accessHistory: []
  }
};

// Mock security context
const mockSecurityContext = {
  userRole: 'ADMIN',
  permissions: ['document:view', 'document:download'],
  securityLevel: 'restricted'
};

// Mock handlers
const mockHandlers = {
  onZoomIn: jest.fn(),
  onZoomOut: jest.fn(),
  onDownload: jest.fn(),
  onSecurityError: jest.fn()
};

// Helper function to render component with security context
const renderDocumentPreview = (props = {}, securityContext = mockSecurityContext) => {
  return customRender(
    <DocumentPreview
      document={mockDocument}
      previewUrl="https://example.com/preview"
      downloadUrl="https://example.com/download"
      {...mockHandlers}
      {...props}
    />,
    {
      securityContext,
      accessibilityOptions: {
        wcagLevel: 'AA',
        screenReaderTesting: true,
        keyboardNavigation: true,
        colorContrast: true
      }
    }
  );
};

describe('DocumentPreview Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders document metadata correctly', () => {
    renderDocumentPreview();

    // Verify document type display
    expect(screen.getByText('Bank Statement')).toBeInTheDocument();
    expect(screen.getByText('Bank Statement')).toHaveAttribute('role', 'text');

    // Verify page count
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toHaveAttribute('aria-live', 'polite');

    // Verify file size display
    const formattedSize = formatDocumentMetadata(mockDocument.metadata.fileSize);
    expect(screen.getByText(formattedSize)).toBeInTheDocument();
  });

  it('handles zoom controls with keyboard accessibility', () => {
    renderDocumentPreview();

    // Get zoom control buttons
    const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
    const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });

    // Test keyboard interaction
    zoomInButton.focus();
    fireEvent.keyDown(zoomInButton, { key: 'Enter' });
    expect(mockHandlers.onZoomIn).toHaveBeenCalled();

    zoomOutButton.focus();
    fireEvent.keyDown(zoomOutButton, { key: 'Enter' });
    expect(mockHandlers.onZoomOut).toHaveBeenCalled();

    // Verify ARIA labels
    expect(zoomInButton).toHaveAttribute('aria-label', 'Zoom in');
    expect(zoomOutButton).toHaveAttribute('aria-label', 'Zoom out');
  });

  it('validates security context for document access', () => {
    // Test with insufficient permissions
    const restrictedContext = {
      ...mockSecurityContext,
      permissions: []
    };

    renderDocumentPreview({}, restrictedContext);

    // Verify download button is disabled
    const downloadButton = screen.getByRole('button', { name: /download document/i });
    expect(downloadButton).toBeDisabled();

    // Verify security error is triggered on download attempt
    fireEvent.click(downloadButton);
    expect(mockHandlers.onSecurityError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Invalid document access')
      })
    );
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderDocumentPreview();

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify keyboard navigation
    const controls = screen.getAllByRole('button');
    controls.forEach(control => {
      control.focus();
      expect(document.activeElement).toBe(control);
    });

    // Verify screen reader announcements
    const pageInfo = screen.getByText('Page 1 of 3');
    expect(pageInfo).toHaveAttribute('aria-live', 'polite');

    // Verify document viewer region
    const viewer = screen.getByRole('region', { name: 'Document Preview' });
    expect(viewer).toBeInTheDocument();
  });

  it('handles page navigation correctly', () => {
    renderDocumentPreview();

    const prevButton = screen.getByRole('button', { name: /previous page/i });
    const nextButton = screen.getByRole('button', { name: /next page/i });

    // Test initial state
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Test navigation
    fireEvent.click(nextButton);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    fireEvent.click(nextButton);
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(nextButton).toBeDisabled();

    fireEvent.click(prevButton);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('handles loading and error states', () => {
    // Test loading state
    renderDocumentPreview({ isLoading: true });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading document preview')).toBeInTheDocument();

    // Test error state
    renderDocumentPreview({ error: new Error('Failed to load document') });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load document');
  });

  it('validates document integrity on mount', () => {
    const validateSpy = jest.spyOn(require('../../../utils/document.utils'), 'validateDocumentFile');
    renderDocumentPreview();

    expect(validateSpy).toHaveBeenCalledWith(mockDocument);
    expect(mockHandlers.onSecurityError).not.toHaveBeenCalled();

    validateSpy.mockRestore();
  });
});