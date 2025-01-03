/**
 * useDocumentViewer Hook
 * A secure and accessible custom React hook for managing document viewer state and functionality
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { Document } from '../interfaces/document.interface';
import { documentService } from '../services/document.service';

// Constants for viewer configuration
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 1.0;
const DEFAULT_PAGE = 1;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const CACHE_DURATION = 300000; // 5 minutes

/**
 * Props interface for useDocumentViewer hook
 */
interface UseDocumentViewerProps {
  document: Document;
  initialZoom?: number;
  initialPage?: number;
  accessToken: string;
}

/**
 * Return interface for useDocumentViewer hook
 */
interface UseDocumentViewerReturn {
  zoomLevel: number;
  currentPage: number;
  totalPages: number;
  documentContent: Blob | null;
  error: Error | null;
  isLoading: boolean;
  setZoomLevel: (zoom: number) => void;
  setCurrentPage: (page: number) => void;
  resetView: () => void;
}

/**
 * Custom hook for secure document viewing functionality
 */
export const useDocumentViewer = ({
  document,
  initialZoom = DEFAULT_ZOOM,
  initialPage = DEFAULT_PAGE,
  accessToken
}: UseDocumentViewerProps): UseDocumentViewerReturn => {
  // State management
  const [zoomLevel, setZoomLevel] = useState<number>(
    Math.min(Math.max(initialZoom, MIN_ZOOM), MAX_ZOOM)
  );
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(document.metadata.pageCount);
  const [documentContent, setDocumentContent] = useState<Blob | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Refs for cleanup and caching
  const abortControllerRef = useRef<AbortController | null>(null);
  const documentCacheRef = useRef<{ content: Blob; timestamp: number } | null>(null);

  // Error boundary integration
  const { showBoundary } = useErrorBoundary();

  /**
   * Validates and updates zoom level
   */
  const handleZoomChange = useCallback((newZoom: number) => {
    const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
    const roundedZoom = Math.round(clampedZoom / ZOOM_STEP) * ZOOM_STEP;
    setZoomLevel(roundedZoom);
  }, []);

  /**
   * Validates and updates current page
   */
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  /**
   * Resets viewer to default state
   */
  const resetView = useCallback(() => {
    handleZoomChange(DEFAULT_ZOOM);
    handlePageChange(DEFAULT_PAGE);
  }, [handleZoomChange, handlePageChange]);

  /**
   * Fetches document content with retry logic
   */
  const fetchDocumentContent = useCallback(async () => {
    let attempts = 0;
    
    while (attempts < MAX_RETRY_ATTEMPTS) {
      try {
        // Check cache first
        if (documentCacheRef.current) {
          const { content, timestamp } = documentCacheRef.current;
          if (Date.now() - timestamp < CACHE_DURATION) {
            setDocumentContent(content);
            setIsLoading(false);
            return;
          }
        }

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        // Validate document access
        await documentService.validateDocumentAccess(document.id, accessToken);

        // Fetch document content
        const content = await documentService.getDocumentContent(
          document.id,
          { signal: abortControllerRef.current.signal }
        );

        // Update cache
        documentCacheRef.current = {
          content,
          timestamp: Date.now()
        };

        setDocumentContent(content);
        setError(null);
        return;

      } catch (err) {
        attempts++;
        if (attempts === MAX_RETRY_ATTEMPTS) {
          const error = err as Error;
          setError(error);
          showBoundary(error);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }, [document.id, accessToken, showBoundary]);

  /**
   * Initialize document viewer
   */
  useEffect(() => {
    setIsLoading(true);
    fetchDocumentContent();

    return () => {
      // Cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear cache on unmount
      documentCacheRef.current = null;
    };
  }, [fetchDocumentContent]);

  /**
   * Update total pages when document changes
   */
  useEffect(() => {
    setTotalPages(document.metadata.pageCount);
  }, [document.metadata.pageCount]);

  return {
    zoomLevel,
    currentPage,
    totalPages,
    documentContent,
    error,
    isLoading,
    setZoomLevel: handleZoomChange,
    setCurrentPage: handlePageChange,
    resetView
  };
};