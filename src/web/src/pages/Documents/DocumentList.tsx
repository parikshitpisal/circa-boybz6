/**
 * DocumentList Component
 * Implements a secure, accessible document list with advanced filtering, sorting, and preview capabilities
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  TablePagination,
  Toolbar,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';
import { AutoSizer, List } from 'react-virtualized';
import { useAuth0 } from '@auth0/auth0-react';
import { ErrorBoundary } from 'react-error-boundary';

import { Document } from '../../interfaces/document.interface';
import { documentService } from '../../services/document.service';
import { 
  APPLICATION_STATUS, 
  DOCUMENT_TYPE,
  APPLICATION_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  STATUS_COLORS
} from '../../constants/application.constants';
import { formatFileSize, getDocumentTypeLabel } from '../../utils/document.utils';

// Enhanced state interface
interface DocumentListState {
  documents: Document[];
  page: number;
  rowsPerPage: number;
  searchQuery: string;
  filterType: DOCUMENT_TYPE | '';
  filterStatus: APPLICATION_STATUS | '';
  isLoading: boolean;
  error: Error | null;
  documentPreviewUrls: Map<string, string>;
  processingDocuments: Set<string>;
}

// Component props interface
interface DocumentListProps {
  className?: string;
}

/**
 * DocumentList Component
 * Implements a secure and accessible document list with advanced features
 */
const DocumentList: React.FC<DocumentListProps> = React.memo(({ className }) => {
  // Auth context
  const { getAccessTokenSilently, user } = useAuth0();

  // Component state
  const [state, setState] = useState<DocumentListState>({
    documents: [],
    page: 0,
    rowsPerPage: 25,
    searchQuery: '',
    filterType: '',
    filterStatus: '',
    isLoading: true,
    error: null,
    documentPreviewUrls: new Map(),
    processingDocuments: new Set()
  });

  // Refs
  const listRef = useRef<List>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout>();

  /**
   * Securely fetches documents with access validation
   */
  const fetchDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const accessToken = await getAccessTokenSilently();
      const securityContext = {
        userId: user?.sub,
        accessToken,
        permissions: ['document:read']
      };

      const documents = await documentService.getSecureDocument(securityContext);
      
      setState(prev => ({
        ...prev,
        documents,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error,
        isLoading: false
      }));
    }
  }, [getAccessTokenSilently, user]);

  /**
   * Handles document preview with secure URL generation
   */
  const handleDocumentPreview = useCallback(async (documentId: string) => {
    try {
      const accessToken = await getAccessTokenSilently();
      const previewUrl = await documentService.generateSecurePreviewUrl(documentId, {
        accessToken,
        watermark: true,
        expirationTime: 300000 // 5 minutes
      });

      setState(prev => ({
        ...prev,
        documentPreviewUrls: new Map(prev.documentPreviewUrls).set(documentId, previewUrl)
      }));
    } catch (error) {
      console.error('Preview generation failed:', error);
    }
  }, [getAccessTokenSilently]);

  /**
   * Handles search with debouncing
   */
  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, searchQuery: value, page: 0 }));
    }, 300);
  }, []);

  /**
   * Handles filter changes
   */
  const handleFilterChange = useCallback((
    type: 'status' | 'type',
    value: APPLICATION_STATUS | DOCUMENT_TYPE | ''
  ) => {
    setState(prev => ({
      ...prev,
      [type === 'status' ? 'filterStatus' : 'filterType']: value,
      page: 0
    }));
  }, []);

  /**
   * Handles pagination changes
   */
  const handlePageChange = useCallback((
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setState(prev => ({ ...prev, page: newPage }));
  }, []);

  /**
   * Handles rows per page changes
   */
  const handleRowsPerPageChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setState(prev => ({
      ...prev,
      rowsPerPage: parseInt(event.target.value, 10),
      page: 0
    }));
  }, []);

  // Initial load and refresh interval
  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  // Filter and sort documents
  const filteredDocuments = React.useMemo(() => {
    return state.documents
      .filter(doc => {
        const matchesSearch = state.searchQuery
          ? doc.metadata.fileName.toLowerCase().includes(state.searchQuery.toLowerCase())
          : true;
        const matchesType = state.filterType
          ? doc.type === state.filterType
          : true;
        const matchesStatus = state.filterStatus
          ? doc.status === state.filterStatus
          : true;
        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => b.metadata.uploadedAt.getTime() - a.metadata.uploadedAt.getTime());
  }, [state.documents, state.searchQuery, state.filterType, state.filterStatus]);

  // Pagination calculation
  const paginatedDocuments = React.useMemo(() => {
    const startIndex = state.page * state.rowsPerPage;
    return filteredDocuments.slice(startIndex, startIndex + state.rowsPerPage);
  }, [filteredDocuments, state.page, state.rowsPerPage]);

  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error" sx={{ m: 2 }}>
          An error occurred while loading the document list.
        </Alert>
      }
    >
      <Box
        component="main"
        role="main"
        aria-label="Document List"
        className={className}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flex: '1 1 100%' }}>
            Documents
          </Typography>
          <TextField
            placeholder="Search documents..."
            size="small"
            onChange={handleSearch}
            sx={{ mr: 2 }}
            InputProps={{
              'aria-label': 'Search documents'
            }}
          />
          <FormControl size="small" sx={{ mr: 2, minWidth: 120 }}>
            <InputLabel id="type-filter-label">Type</InputLabel>
            <Select
              labelId="type-filter-label"
              value={state.filterType}
              label="Type"
              onChange={(e) => handleFilterChange('type', e.target.value as DOCUMENT_TYPE)}
            >
              <MenuItem value="">All</MenuItem>
              {Object.values(DOCUMENT_TYPE).map((type) => (
                <MenuItem key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ mr: 2, minWidth: 120 }}>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              value={state.filterStatus}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value as APPLICATION_STATUS)}
            >
              <MenuItem value="">All</MenuItem>
              {Object.values(APPLICATION_STATUS).map((status) => (
                <MenuItem key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton
            onClick={() => fetchDocuments()}
            aria-label="Refresh document list"
            disabled={state.isLoading}
          >
            <RefreshIcon />
          </IconButton>
        </Toolbar>

        <TableContainer component={Paper} sx={{ flex: 1, overflow: 'hidden' }}>
          <AutoSizer>
            {({ width, height }) => (
              <Table aria-label="Document list" style={{ width, height }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Uploaded</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {state.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <CircularProgress size={40} />
                      </TableCell>
                    </TableRow>
                  ) : paginatedDocuments.map((document) => (
                    <TableRow
                      key={document.id}
                      hover
                      tabIndex={0}
                      aria-label={`Document: ${document.metadata.fileName}`}
                    >
                      <TableCell>{document.metadata.fileName}</TableCell>
                      <TableCell>
                        <span dangerouslySetInnerHTML={{
                          __html: getDocumentTypeLabel(document.type)
                        }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={APPLICATION_STATUS_LABELS[document.status]}
                          sx={{
                            bgcolor: STATUS_COLORS[document.status],
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <span dangerouslySetInnerHTML={{
                          __html: formatFileSize(document.metadata.fileSize)
                        }} />
                      </TableCell>
                      <TableCell>
                        {new Date(document.metadata.uploadedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={() => handleDocumentPreview(document.id)}
                          aria-label={`Preview ${document.metadata.fileName}`}
                        >
                          <VisibilityIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => {/* Download handler */}}
                          aria-label={`Download ${document.metadata.fileName}`}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AutoSizer>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredDocuments.length}
          page={state.page}
          onPageChange={handlePageChange}
          rowsPerPage={state.rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[25, 50, 100]}
        />
      </Box>
    </ErrorBoundary>
  );
});

DocumentList.displayName = 'DocumentList';

export default DocumentList;