import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { waitFor, within } from '@testing-library/react';
import { axe } from '@axe-core/react';
import { DocumentViewer } from './DocumentViewer';
import { customRender, screen, fireEvent } from '../../../tests/utils/test-utils';
import { DOCUMENT_TYPE } from '../../../constants/application.constants';

// Mock document data with security metadata
const mockDocument = {
  id: 'test-doc-1',
  type: DOCUMENT_TYPE.BANK_STATEMENT,
  metadata: {
    pageCount: 3,
    fileSize: 1024 * 1024, // 1MB
    ocrConfidence: 0.95,
    securityHash: 'abc123',
    encryptionStatus: true,
    lastValidated: new Date(),
    accessHistory: []
  },
  securityInfo: {
    securityHash: 'test-hash',
    encryptionStatus: true,
    lastValidated: new Date(),
    accessHistory: []
  }
};

// Mock extracted data with validation state
const mockExtractedData = {
  businessName: 'Test Corp',
  accountNumber: '****1234',
  routingNumber: '****5678',
  monthlyRevenue: 50000,
  validationState: 'pending',
  confidence: 0.95
};

// Mock handlers
const mockHandlers = {
  onDataChange: jest.fn(),
  onZoomChange: jest.fn(),
  onPageChange: jest.fn(),
  onValidate: jest.fn(),
  onSecurityViolation: jest.fn(),
  onAccessDenied: jest.fn()
};

// Helper function to render DocumentViewer with all required props
const renderDocumentViewer = (props = {}) => {
  const defaultProps = {
    document: mockDocument,
    accessToken: 'test-token',
    readOnly: false,
    ...mockHandlers,
    ...props
  };

  return customRender(<DocumentViewer {...defaultProps} />, {
    withTheme: true,
    withRouter: true,
    withSecurityContext: true,
    withAccessibilityContext: true
  });
};

describe('DocumentViewer Component', () => {
  describe('Core Functionality', () => {
    it('renders document preview correctly', async () => {
      renderDocumentViewer();
      
      const canvas = screen.getByRole('img', { name: /document page/i });
      expect(canvas).toBeInTheDocument();
      
      const pageIndicator = screen.getByText(`1 / ${mockDocument.metadata.pageCount}`);
      expect(pageIndicator).toBeInTheDocument();
    });

    it('handles zoom controls correctly', async () => {
      renderDocumentViewer();
      
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      
      fireEvent.click(zoomInButton);
      await waitFor(() => {
        expect(mockHandlers.onZoomChange).toHaveBeenCalledWith(1.25);
      });
      
      fireEvent.click(zoomOutButton);
      await waitFor(() => {
        expect(mockHandlers.onZoomChange).toHaveBeenCalledWith(0.75);
      });
    });

    it('handles page navigation correctly', async () => {
      renderDocumentViewer();
      
      const nextButton = screen.getByRole('button', { name: /next page/i });
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(mockHandlers.onPageChange).toHaveBeenCalledWith(2);
      });
      
      fireEvent.click(prevButton);
      await waitFor(() => {
        expect(mockHandlers.onPageChange).toHaveBeenCalledWith(1);
      });
    });

    it('displays extracted data correctly', () => {
      renderDocumentViewer();
      
      const extractedDataSection = screen.getByRole('region', { name: /extracted data/i });
      expect(extractedDataSection).toBeInTheDocument();
      expect(screen.getByText(mockExtractedData.businessName)).toBeInTheDocument();
    });
  });

  describe('Security Features', () => {
    it('validates document access on mount', async () => {
      renderDocumentViewer();
      
      await waitFor(() => {
        expect(mockHandlers.onSecurityViolation).not.toHaveBeenCalled();
      });
    });

    it('handles access denied scenarios', async () => {
      renderDocumentViewer({ accessToken: 'invalid-token' });
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/access denied/i);
        expect(mockHandlers.onAccessDenied).toHaveBeenCalled();
      });
    });

    it('applies security watermark to document', () => {
      renderDocumentViewer();
      
      const canvas = screen.getByRole('img', { name: /document page/i });
      const context = canvas.getContext('2d');
      expect(context?.fillText).toHaveBeenCalledWith('CONFIDENTIAL', expect.any(Number), expect.any(Number));
    });
  });

  describe('Accessibility Compliance', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = renderDocumentViewer();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', () => {
      renderDocumentViewer();
      
      const viewer = screen.getByRole('region', { name: /document viewer/i });
      fireEvent.keyDown(viewer, { key: 'ArrowRight' });
      expect(mockHandlers.onPageChange).toHaveBeenCalledWith(2);
      
      fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
      expect(mockHandlers.onPageChange).toHaveBeenCalledWith(1);
    });

    it('provides proper ARIA labels', () => {
      renderDocumentViewer();
      
      expect(screen.getByRole('region', { name: /document viewer/i })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /document page 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders within performance budget', async () => {
      const startTime = performance.now();
      renderDocumentViewer();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms budget
    });

    it('handles large documents efficiently', async () => {
      const largeDocument = {
        ...mockDocument,
        metadata: { ...mockDocument.metadata, pageCount: 100 }
      };
      
      renderDocumentViewer({ document: largeDocument });
      
      // Verify lazy loading is applied
      const canvas = screen.getByRole('img', { name: /document page/i });
      expect(canvas).toHaveAttribute('loading', 'lazy');
    });

    it('cleans up resources on unmount', () => {
      const { unmount } = renderDocumentViewer();
      const cleanup = jest.fn();
      jest.spyOn(React, 'useEffect').mockImplementation(() => cleanup);
      
      unmount();
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('displays error message on document load failure', async () => {
      renderDocumentViewer({ document: { ...mockDocument, id: 'invalid-id' } });
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to load document/i);
      });
    });

    it('handles validation errors gracefully', async () => {
      renderDocumentViewer();
      
      fireEvent.click(screen.getByRole('button', { name: /validate/i }));
      mockHandlers.onValidate.mockRejectedValueOnce(new Error('Validation failed'));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/validation failed/i);
      });
    });
  });
});