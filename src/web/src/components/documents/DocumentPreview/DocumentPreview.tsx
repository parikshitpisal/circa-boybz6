/**
 * DocumentPreview Component
 * A secure and accessible document preview interface with enhanced controls
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { Box, IconButton, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { ZoomIn, ZoomOut, Download, NavigateNext, NavigateBefore } from '@mui/icons-material';
import { useDocumentViewer } from '../../../hooks/useDocumentViewer';
import { Document } from '../../../interfaces/document.interface';
import { validateDocumentFile, generateDocumentPreviewUrl } from '../../../utils/document.utils';

/**
 * Props interface for DocumentPreview component
 */
interface DocumentPreviewProps {
  document: Document;
  previewUrl: string;
  downloadUrl: string;
  className?: string;
  onAccessViolation?: (error: Error) => void;
}

/**
 * Enhanced document preview component with security and accessibility features
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = React.memo(({
  document,
  previewUrl,
  downloadUrl,
  className,
  onAccessViolation
}) => {
  // Initialize document viewer hook with security context
  const {
    zoomLevel,
    currentPage,
    totalPages,
    isLoading,
    error,
    setZoomLevel,
    setCurrentPage,
    resetView
  } = useDocumentViewer({
    document,
    accessToken: document.securityInfo.securityHash,
    initialZoom: 1.0,
    initialPage: 1
  });

  /**
   * Securely handle document download with access validation
   */
  const handleDownload = useCallback(async () => {
    try {
      // Validate document access permissions
      const validationResult = await validateDocumentFile(document as unknown as File);
      if (!validationResult.isValid) {
        throw new Error('Document access validation failed');
      }

      // Generate secure download URL
      const secureUrl = await generateDocumentPreviewUrl(document.id, {
        userId: 'current-user', // Would come from auth context
        permissions: ['document:download']
      });

      // Trigger download
      window.open(secureUrl.url, '_blank');
    } catch (error) {
      onAccessViolation?.(error as Error);
    }
  }, [document, onAccessViolation]);

  /**
   * Handle secure page navigation
   */
  const handlePageNext = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  const handlePagePrevious = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage, setCurrentPage]);

  /**
   * Handle zoom controls with validation
   */
  const handleZoomIn = useCallback(() => {
    setZoomLevel(zoomLevel + 0.25);
  }, [zoomLevel, setZoomLevel]);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(zoomLevel - 0.25);
  }, [zoomLevel, setZoomLevel]);

  /**
   * Effect to validate document access on mount
   */
  useEffect(() => {
    const validateAccess = async () => {
      try {
        const validationResult = await validateDocumentFile(document as unknown as File);
        if (!validationResult.isValid) {
          onAccessViolation?.(new Error('Invalid document access'));
        }
      } catch (error) {
        onAccessViolation?.(error as Error);
      }
    };

    validateAccess();
  }, [document, onAccessViolation]);

  // Handle loading state
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress aria-label="Loading document preview" />
      </Box>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Alert 
        severity="error" 
        aria-live="polite"
        role="alert"
      >
        {error.message}
      </Alert>
    );
  }

  return (
    <Paper 
      elevation={2} 
      className={className}
      role="region"
      aria-label="Document Preview"
    >
      {/* Control toolbar */}
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        p={1}
        borderBottom={1}
        borderColor="divider"
      >
        <Box>
          <IconButton
            onClick={handleZoomOut}
            aria-label="Zoom out"
            disabled={zoomLevel <= 0.5}
          >
            <ZoomOut />
          </IconButton>
          <IconButton
            onClick={handleZoomIn}
            aria-label="Zoom in"
            disabled={zoomLevel >= 3}
          >
            <ZoomIn />
          </IconButton>
        </Box>

        <Typography variant="body2" component="div" aria-live="polite">
          Page {currentPage} of {totalPages}
        </Typography>

        <IconButton
          onClick={handleDownload}
          aria-label="Download document"
        >
          <Download />
        </IconButton>
      </Box>

      {/* Document preview */}
      <Box
        position="relative"
        width="100%"
        height={600}
        overflow="auto"
        sx={{
          '& img': {
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease-in-out'
          }
        }}
      >
        <img
          src={previewUrl}
          alt={`Page ${currentPage} of document ${document.metadata.fileSize}`}
          style={{
            maxWidth: '100%',
            height: 'auto'
          }}
        />
      </Box>

      {/* Page navigation */}
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        p={1}
        borderTop={1}
        borderColor="divider"
      >
        <IconButton
          onClick={handlePagePrevious}
          aria-label="Previous page"
          disabled={currentPage <= 1}
        >
          <NavigateBefore />
        </IconButton>

        <IconButton
          onClick={handlePageNext}
          aria-label="Next page"
          disabled={currentPage >= totalPages}
        >
          <NavigateNext />
        </IconButton>
      </Box>
    </Paper>
  );
});

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;