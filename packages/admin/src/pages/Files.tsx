/**
 * File Management Page
 *
 * Admin interface for managing files across all plugins.
 * Provides file listing, upload, metadata editing, and deletion.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Grid,
  Divider,
  FormControlLabel,
  Switch,
  SelectChangeEvent,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  GetApp as DownloadIcon,
  Share as ShareIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import type {
  FileMetadata,
  FileListOptions,
  AllowedFileType,
  BulkUploadResult,
} from '../services/filesService';
import {
  listFiles,
  getFile,
  uploadFile,
  bulkUploadFiles,
  updateFileMetadata,
  deleteFile,
  hardDeleteFile,
  getAllowedFileTypes,
  formatFileSize,
  getCategoryFromMimeType,
} from '../services/filesService';
import { ShareDialog } from '../components/ShareDialog';
import { VersionHistoryDialog } from '../components/VersionHistoryDialog';

type SortField = 'created_at' | 'filename' | 'file_size';
type SortOrder = 'asc' | 'desc';

const Files: React.FC = () => {
  // Data state
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_allowedTypes, _setAllowedTypes] = useState<AllowedFileType[]>([]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Sorting state
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Filter state
  const [_searchQuery, _setSearchQuery] = useState('');
  const [pluginIdFilter, setPluginIdFilter] = useState<string>('');
  const [mimeTypeFilter, setMimeTypeFilter] = useState<string>('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadPluginId, setUploadPluginId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [bulkUploadPluginId, setBulkUploadPluginId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkUploadResult | null>(null);
  const [continueOnError, setContinueOnError] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileMetadata | null>(null);
  const [editAltText, setEditAltText] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState('');

  // View state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileMetadata | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFile, setDeletingFile] = useState<FileMetadata | null>(null);
  const [hardDelete, setHardDelete] = useState(false);

  // Share state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingFile, setSharingFile] = useState<FileMetadata | null>(null);

  // Version history state
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versioningFile, setVersioningFile] = useState<FileMetadata | null>(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch files
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const options: FileListOptions = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        orderBy: sortBy,
        orderDirection: sortOrder,
        includeDeleted,
      };

      if (pluginIdFilter) {
        options.pluginId = pluginIdFilter;
      }
      if (mimeTypeFilter) {
        options.mimeType = mimeTypeFilter;
      }

      const response = await listFiles(options);
      setFiles(response.files);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load files');
      showSnackbar('Failed to load files', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, sortBy, sortOrder, pluginIdFilter, mimeTypeFilter, includeDeleted]);

  // Fetch allowed file types
  const fetchAllowedTypes = useCallback(async () => {
    try {
      const types = await getAllowedFileTypes();
      _setAllowedTypes(types);
    } catch (err) {
      console.error('Failed to fetch allowed file types:', err);
    }
  }, []);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    void fetchAllowedTypes();
  }, [fetchAllowedTypes]);

  // Snackbar helper
  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'success'
  ): void => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = (): void => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Sort handler
  const handleSort = (field: SortField): void => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(field);
  };

  // Upload handlers
  const handleUploadClick = (): void => {
    setUploadDialogOpen(true);
    setSelectedFile(null);
    setUploadPluginId('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async (): Promise<void> => {
    console.log('[FILES] handleUpload called', { selectedFile: selectedFile?.name, uploadPluginId });

    if (!selectedFile || !uploadPluginId) {
      console.log('[FILES] Validation failed', { hasFile: !!selectedFile, hasPluginId: !!uploadPluginId });
      showSnackbar('Please select a file and plugin', 'error');
      return;
    }

    console.log('[FILES] Starting upload...');
    setUploading(true);
    try {
      console.log('[FILES] Calling uploadFile service...');
      await uploadFile(selectedFile, {
        pluginId: uploadPluginId,
        generateThumbnail: getCategoryFromMimeType(selectedFile.type) === 'image',
        thumbnailWidth: 200,
        thumbnailHeight: 200,
      });

      console.log('[FILES] Upload successful!');
      showSnackbar('File uploaded successfully', 'success');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadPluginId('');
      void fetchFiles();
    } catch (err) {
      console.error('[FILES] Upload failed:', err);
      showSnackbar('Failed to upload file', 'error');
    } finally {
      setUploading(false);
      console.log('[FILES] handleUpload completed');
    }
  };

  // Bulk upload handlers
  const handleBulkUploadClick = (): void => {
    setBulkUploadDialogOpen(true);
    setSelectedFiles([]);
    setBulkUploadPluginId('');
    setBulkUploadResult(null);
    setContinueOnError(true);
  };

  const handleBulkFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleDrag = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemoveFile = (index: number): void => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBulkUpload = async (): Promise<void> => {
    if (selectedFiles.length === 0 || !bulkUploadPluginId) {
      showSnackbar('Please select files and plugin', 'error');
      return;
    }

    setBulkUploading(true);
    setBulkUploadResult(null);
    try {
      const result = await bulkUploadFiles(selectedFiles, {
        pluginId: bulkUploadPluginId,
        generateThumbnails: true,
        thumbnailWidth: 200,
        thumbnailHeight: 200,
        continueOnError,
      });

      setBulkUploadResult(result);

      if (result.failed.length === 0) {
        showSnackbar(
          `All ${result.successful.length} files uploaded successfully`,
          'success'
        );
      } else if (result.successful.length > 0) {
        showSnackbar(
          `Uploaded ${result.successful.length} files, ${result.failed.length} failed`,
          'warning'
        );
      } else {
        showSnackbar('All uploads failed', 'error');
      }

      void fetchFiles();
    } catch (err) {
      console.error('Bulk upload failed:', err);
      showSnackbar('Bulk upload failed', 'error');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleCloseBulkUploadDialog = (): void => {
    if (!bulkUploading) {
      setBulkUploadDialogOpen(false);
      setSelectedFiles([]);
      setBulkUploadPluginId('');
      setBulkUploadResult(null);
    }
  };

  // Edit handlers
  const handleEditClick = (file: FileMetadata): void => {
    setEditingFile(file);
    setEditAltText(file.altText || '');
    setEditCaption(file.caption || '');
    setEditTags(file.tags?.join(', ') || '');
    setEditDialogOpen(true);
  };

  const handleEditSave = async (): Promise<void> => {
    if (!editingFile) {return;}

    try {
      await updateFileMetadata(editingFile.id, {
        altText: editAltText,
        caption: editCaption,
        tags: editTags ? editTags.split(',').map((t) => t.trim()) : [],
      });

      showSnackbar('File metadata updated successfully', 'success');
      setEditDialogOpen(false);
      void fetchFiles();
    } catch (err) {
      console.error('Update failed:', err);
      showSnackbar('Failed to update file metadata', 'error');
    }
  };

  // View handler
  const handleViewClick = async (file: FileMetadata): Promise<void> => {
    try {
      const fullFile = await getFile(file.id);
      setViewingFile(fullFile);
      setViewDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch file details:', err);
      showSnackbar('Failed to load file details', 'error');
    }
  };

  // Share handlers
  const handleShareClick = (file: FileMetadata): void => {
    setSharingFile(file);
    setShareDialogOpen(true);
  };

  // Version history handlers
  const handleVersionHistoryClick = (file: FileMetadata): void => {
    setVersioningFile(file);
    setVersionHistoryOpen(true);
  };

  const handleVersionRestored = (): void => {
    // Reload files to show updated file metadata
    void fetchFiles();
    setSnackbar({
      open: true,
      message: 'File restored successfully',
      severity: 'success',
    });
  };

  // Delete handlers
  const handleDeleteClick = (file: FileMetadata): void => {
    setDeletingFile(file);
    setHardDelete(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deletingFile) {return;}

    try {
      if (hardDelete) {
        await hardDeleteFile(deletingFile.id);
        showSnackbar('File permanently deleted', 'success');
      } else {
        await deleteFile(deletingFile.id);
        showSnackbar('File deleted successfully', 'success');
      }

      setDeleteDialogOpen(false);
      void fetchFiles();
    } catch (err) {
      console.error('Delete failed:', err);
      showSnackbar('Failed to delete file', 'error');
    }
  };

  // Get file preview URL
  const getFilePreviewUrl = (file: FileMetadata): string => {
    // In production, this would be the actual file URL from the storage service
    // For now, return a placeholder or the storage path
    return `/api${file.storagePath}`;
  };

  // Render file icon based on MIME type
  const renderFileIcon = (file: FileMetadata): React.ReactNode => {
    const category = getCategoryFromMimeType(file.mimeType);

    if (category === 'image') {
      return (
        <Box
          component="img"
          src={getFilePreviewUrl(file)}
          alt={file.altText || file.filename}
          sx={{
            width: 50,
            height: 50,
            objectFit: 'cover',
            borderRadius: 1,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
          }}
        />
      );
    }

    const IconComponent = category === 'image' ? ImageIcon : FileIcon;
    return <IconComponent sx={{ fontSize: 50, color: 'text.secondary' }} />;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          File Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void fetchFiles()}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={handleUploadClick}
          >
            Upload File
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={handleBulkUploadClick}
          >
            Bulk Upload
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Plugin ID"
              value={pluginIdFilter}
              onChange={(e) => setPluginIdFilter(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>MIME Type</InputLabel>
              <Select
                value={mimeTypeFilter}
                label="MIME Type"
                onChange={(e: SelectChangeEvent) => setMimeTypeFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="image/">Images</MenuItem>
                <MenuItem value="video/">Videos</MenuItem>
                <MenuItem value="audio/">Audio</MenuItem>
                <MenuItem value="application/pdf">PDFs</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                />
              }
              label="Include Deleted"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setPluginIdFilter('');
                setMimeTypeFilter('');
                setIncludeDeleted(false);
                setPage(0);
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Files table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Preview</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'filename'}
                  direction={sortBy === 'filename' ? sortOrder : 'asc'}
                  onClick={() => handleSort('filename')}
                >
                  Filename
                </TableSortLabel>
              </TableCell>
              <TableCell>Plugin ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'file_size'}
                  direction={sortBy === 'file_size' ? sortOrder : 'asc'}
                  onClick={() => handleSort('file_size')}
                >
                  Size
                </TableSortLabel>
              </TableCell>
              <TableCell>Dimensions</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'created_at'}
                  direction={sortBy === 'created_at' ? sortOrder : 'asc'}
                  onClick={() => handleSort('created_at')}
                >
                  Uploaded
                </TableSortLabel>
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">No files found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => (
                <TableRow
                  key={file.id}
                  sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <TableCell>{renderFileIcon(file)}</TableCell>
                  <TableCell>
                    <Tooltip title={file.originalName}>
                      <Typography noWrap sx={{ maxWidth: 200 }}>
                        {file.filename}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip label={file.pluginId} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getCategoryFromMimeType(file.mimeType)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                  <TableCell>
                    {file.width && file.height
                      ? `${file.width}x${file.height}`
                      : file.duration
                      ? `${file.duration}s`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(file.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {file.deletedAt ? (
                      <Chip label="Deleted" size="small" color="error" />
                    ) : (
                      <Chip label="Active" size="small" color="success" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => void handleViewClick(file)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Metadata">
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(file)}
                        disabled={!!file.deletedAt}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Share">
                      <IconButton
                        size="small"
                        onClick={() => handleShareClick(file)}
                        disabled={!!file.deletedAt}
                      >
                        <ShareIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Version History">
                      <IconButton
                        size="small"
                        onClick={() => handleVersionHistoryClick(file)}
                        disabled={!!file.deletedAt}
                      >
                        <HistoryIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(file)}
                        disabled={!!file.deletedAt}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload File</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Plugin ID"
              value={uploadPluginId}
              onChange={(e) => setUploadPluginId(e.target.value)}
              required
              helperText="Enter the plugin ID that will own this file"
            />
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
              fullWidth
            >
              Select File
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleFileSelect}
              />
            </Button>
            {selectedFile && (
              <Alert severity="info">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => void handleUpload()}
            variant="contained"
            disabled={!selectedFile || !uploadPluginId || uploading}
          >
            {uploading ? <CircularProgress size={24} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog
        open={bulkUploadDialogOpen}
        onClose={handleCloseBulkUploadDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Bulk Upload Files</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Plugin ID"
              value={bulkUploadPluginId}
              onChange={(e) => setBulkUploadPluginId(e.target.value)}
              required
              helperText="Enter the plugin ID that will own these files"
              disabled={bulkUploading}
            />

            {/* Drag and drop area */}
            <Box
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: dragActive ? 'primary.main' : 'grey.400',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: dragActive ? 'action.hover' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => bulkFileInputRef.current?.click()}
            >
              <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                Drag and drop files here
              </Typography>
              <Typography variant="body2" color="text.secondary">
                or click to browse
              </Typography>
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleBulkFileSelect}
                disabled={bulkUploading}
              />
            </Box>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Selected Files ({selectedFiles.length})
                </Typography>
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {selectedFiles.map((file, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderBottom: index < selectedFiles.length - 1 ? 1 : 0,
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflow: 'hidden' }}>
                        <FileIcon sx={{ color: 'text.secondary' }} />
                        <Tooltip title={file.name}>
                          <Typography noWrap variant="body2" sx={{ flex: 1 }}>
                            {file.name}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveFile(index)}
                        disabled={bulkUploading}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Paper>
              </Box>
            )}

            {/* Continue on error option */}
            <FormControlLabel
              control={
                <Switch
                  checked={continueOnError}
                  onChange={(e) => setContinueOnError(e.target.checked)}
                  disabled={bulkUploading}
                />
              }
              label="Continue uploading even if some files fail"
            />

            {/* Upload results */}
            {bulkUploadResult && (
              <Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Upload Results
                </Typography>
                {bulkUploadResult.successful.length > 0 && (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Successfully uploaded {bulkUploadResult.successful.length} file(s)
                  </Alert>
                )}
                {bulkUploadResult.failed.length > 0 && (
                  <Box>
                    <Alert severity="error" sx={{ mb: 1 }}>
                      Failed to upload {bulkUploadResult.failed.length} file(s)
                    </Alert>
                    <Paper variant="outlined" sx={{ maxHeight: 150, overflow: 'auto', p: 1 }}>
                      {bulkUploadResult.failed.map((failure, index) => (
                        <Typography key={index} variant="body2" color="error" sx={{ mb: 0.5 }}>
                          • {failure.filename}: {failure.error}
                        </Typography>
                      ))}
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulkUploadDialog} disabled={bulkUploading}>
            {bulkUploadResult ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={() => void handleBulkUpload()}
            variant="contained"
            disabled={selectedFiles.length === 0 || !bulkUploadPluginId || bulkUploading}
          >
            {bulkUploading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Uploading...
              </>
            ) : (
              `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit File Metadata</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Alt Text"
              value={editAltText}
              onChange={(e) => setEditAltText(e.target.value)}
              helperText="Alternative text for accessibility"
            />
            <TextField
              fullWidth
              label="Caption"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              multiline
              rows={3}
              helperText="Caption or description"
            />
            <TextField
              fullWidth
              label="Tags"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              helperText="Comma-separated tags"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleEditSave()} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          File Details
          <IconButton
            onClick={() => setViewDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {viewingFile && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {getCategoryFromMimeType(viewingFile.mimeType) === 'image' && (
                <Box
                  component="img"
                  src={getFilePreviewUrl(viewingFile)}
                  alt={viewingFile.altText || viewingFile.filename}
                  sx={{ width: '100%', maxHeight: 400, objectFit: 'contain' }}
                />
              )}
              <Divider />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Filename
                  </Typography>
                  <Typography variant="body1">{viewingFile.filename}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Original Name
                  </Typography>
                  <Typography variant="body1">{viewingFile.originalName}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Plugin ID
                  </Typography>
                  <Typography variant="body1">{viewingFile.pluginId}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    MIME Type
                  </Typography>
                  <Typography variant="body1">{viewingFile.mimeType}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    File Size
                  </Typography>
                  <Typography variant="body1">
                    {formatFileSize(viewingFile.fileSize)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Dimensions
                  </Typography>
                  <Typography variant="body1">
                    {viewingFile.width && viewingFile.height
                      ? `${viewingFile.width}x${viewingFile.height}`
                      : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Uploaded At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(viewingFile.createdAt).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Uploaded By
                  </Typography>
                  <Typography variant="body1">{viewingFile.uploadedBy}</Typography>
                </Grid>
                {viewingFile.altText && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Alt Text
                    </Typography>
                    <Typography variant="body1">{viewingFile.altText}</Typography>
                  </Grid>
                )}
                {viewingFile.caption && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Caption
                    </Typography>
                    <Typography variant="body1">{viewingFile.caption}</Typography>
                  </Grid>
                )}
                {viewingFile.tags && viewingFile.tags.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                      {viewingFile.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => {
              if (viewingFile) {
                window.open(getFilePreviewUrl(viewingFile), '_blank');
              }
            }}
          >
            Download
          </Button>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deletingFile?.filename}?
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
              />
            }
            label="Permanent Delete (cannot be undone)"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => void handleDeleteConfirm()}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      {/* Share Dialog */}
      {sharingFile && (
        <ShareDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          fileId={sharingFile.id}
          fileName={sharingFile.originalName}
        />
      )}

      {/* Version History Dialog */}
      {versioningFile && (
        <VersionHistoryDialog
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          fileId={versioningFile.id}
          fileName={versioningFile.originalName}
          onVersionRestored={handleVersionRestored}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Files;
