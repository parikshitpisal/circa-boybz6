import React, { useEffect, useCallback, useRef, useState } from 'react';
import { 
  IconButton, 
  Grid, 
  Typography, 
  CircularProgress, 
  Alert,
  Box,
  useTheme
} from '@mui/material';
import { 
  ZoomIn, 
  ZoomOut, 
  NavigateNext, 
  NavigateBefore,
  Security 
} from '@mui/icons-material';
import { useDocumentViewer } from '../../../hooks/useDocumentViewer';
import ExtractedData from '../ExtractedData/ExtractedData';
import Card from '../../common/Card/Card';
import Loading from '../../common/Loading/Loading';
import { Document } from '../../../interfaces/document.interface';
import { auditLogger } from '@company/audit-logger'; // v1.0.0

// Constants for viewer configuration
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const WATERMARK_TEXT = 'CONFIDENTIAL';

interface DocumentViewerProps {
  document: Document;
  onDataChange: (data: Record<string, any>) => void;
  readOnly?: boolean;
  accessToken: string;
}

/**
 * Secure document viewer component with split-screen layout, zoom controls,
 * and encrypted data display. Implements WCAG 2.1 Level AA compliance.
 */
const DocumentViewer: React.FC<DocumentViewerProps> = React.memo(({
  document,
  onDataChange,
  readOnly = false,
  accessToken
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize document viewer hook with security context
  const {
    zoomLevel,
    currentPage,
    handleZoomIn,
    handleZoomOut,
    handlePageChange,
    validateDocumentAccess,
    logDocumentAccess
  } = useDocumentViewer({
    document,
    initialZoom: 1.0,
    initialPage: 1,
    accessToken
  });

  // Security validation on mount
  useEffect(() => {
    const validateAccess = async () => {
      try {
        await validateDocumentAccess(document.id, accessToken);
        await logDocumentAccess({
          documentId: document.id,
          action: 'VIEW',
          timestamp: new Date()
        });
      } catch (err) {
        setError('Access denied: Insufficient permissions');
        auditLogger.error('Document access denied', {
          documentId: document.id,
          error: err
        });
      }
    };

    validateAccess();
  }, [document.id, accessToken, validateDocumentAccess, logDocumentAccess]);

  // Handle document rendering with watermark
  const renderDocument = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom transformation
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);

    // Render document content
    // ... document rendering logic here ...

    // Apply watermark
    ctx.globalAlpha = 0.2;
    ctx.font = '24px Arial';
    ctx.rotate(-45 * Math.PI / 180);
    ctx.fillStyle = theme.palette.text.secondary;
    ctx.fillText(WATERMARK_TEXT, -50, 100);

    ctx.restore();
  }, [zoomLevel, theme.palette.text.secondary]);

  // Update canvas on zoom/page changes
  useEffect(() => {
    renderDocument();
  }, [renderDocument, currentPage, zoomLevel]);

  // Keyboard navigation handlers
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
        handlePageChange(currentPage - 1);
        break;
      case 'ArrowRight':
        handlePageChange(currentPage + 1);
        break;
      case '+':
        handleZoomIn();
        break;
      case '-':
        handleZoomOut();
        break;
    }
  }, [currentPage, handlePageChange, handleZoomIn, handleZoomOut]);

  if (error) {
    return (
      <Alert 
        severity="error" 
        icon={<Security />}
        sx={{ mb: 2 }}
      >
        {error}
      </Alert>
    );
  }

  return (
    <Card
      elevation={2}
      role="region"
      aria-label="Document Viewer"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <Grid container spacing={2} sx={{ p: 2 }}>
        {/* Document Display Section */}
        <Grid item xs={12} md={6}>
          <Box
            sx={{
              position: 'relative',
              height: '600px',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              overflow: 'hidden'
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'grab'
              }}
              aria-label={`Document page ${currentPage}`}
            />

            {/* Zoom Controls */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 1,
                padding: 1
              }}
            >
              <IconButton
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
                aria-label="Zoom out"
                size="small"
              >
                <ZoomOut />
              </IconButton>
              <Typography
                variant="body2"
                component="span"
                sx={{ mx: 1 }}
                aria-label={`Zoom level ${Math.round(zoomLevel * 100)}%`}
              >
                {Math.round(zoomLevel * 100)}%
              </Typography>
              <IconButton
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
                aria-label="Zoom in"
                size="small"
              >
                <ZoomIn />
              </IconButton>
            </Box>

            {/* Page Navigation */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 1,
                padding: 1,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <IconButton
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                size="small"
              >
                <NavigateBefore />
              </IconButton>
              <Typography
                variant="body2"
                component="span"
                sx={{ mx: 1 }}
                aria-label={`Page ${currentPage} of ${document.metadata.pageCount}`}
              >
                {currentPage} / {document.metadata.pageCount}
              </Typography>
              <IconButton
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === document.metadata.pageCount}
                aria-label="Next page"
                size="small"
              >
                <NavigateNext />
              </IconButton>
            </Box>
          </Box>
        </Grid>

        {/* Extracted Data Section */}
        <Grid item xs={12} md={6}>
          <ExtractedData
            document={document}
            onDataChange={onDataChange}
            readOnly={readOnly}
            securityLevel="sensitive"
          />
        </Grid>
      </Grid>
    </Card>
  );
});

DocumentViewer.displayName = 'DocumentViewer';

export default DocumentViewer;