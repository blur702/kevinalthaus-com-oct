import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Typography,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { PageBuilderEditor } from '@page-builder/frontend/components';
import type { PageLayout, GridConfig } from '@page-builder/frontend/types';
import api from '../lib/api';

// Default grid configuration matching the plugin's defaults
const defaultGridConfig: GridConfig = {
  columns: 12,
  gap: {
    unit: 'px',
    value: 16,
  },
  snapToGrid: true,
  breakpoints: [
    { name: 'mobile', minWidth: 0, maxWidth: 767, columns: 4 },
    { name: 'tablet', minWidth: 768, maxWidth: 1023, columns: 8 },
    { name: 'desktop', minWidth: 1024, maxWidth: 1439, columns: 12 },
    { name: 'wide', minWidth: 1440, columns: 16 },
  ],
};

interface PageMetadata {
  title: string;
  slug: string;
  status: 'draft' | 'published';
  meta_description: string;
  meta_keywords: string;
}

interface PageData extends PageMetadata {
  id: number;
  layout_json: PageLayout;
  created_at: string;
  updated_at: string;
}

const PageBuilderEditorWrapper: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // State management
  const [loading, setLoading] = useState<boolean>(!!id);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Metadata state
  const [metadata, setMetadata] = useState<PageMetadata>({
    title: '',
    slug: '',
    status: 'draft',
    meta_description: '',
    meta_keywords: '',
  });

  // Layout state
  const [layout, setLayout] = useState<PageLayout>({
    version: '1.0',
    grid: defaultGridConfig,
    widgets: [],
  });

  // Load page data when editing
  useEffect(() => {
    if (id) {
      fetchPageData(id);
    }
  }, [id]);

  const fetchPageData = async (pageId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/page-builder/pages/${pageId}`);
      const pageData: PageData = response.data.data;

      setMetadata({
        title: pageData.title || '',
        slug: pageData.slug || '',
        status: pageData.status || 'draft',
        meta_description: pageData.meta_description || '',
        meta_keywords: pageData.meta_keywords || '',
      });

      setLayout(
        pageData.layout_json || {
          version: '1.0',
          grid: defaultGridConfig,
          widgets: [],
        }
      );
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || 'Failed to load page data';
      setError(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMetadataChange = (field: keyof PageMetadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }));
  };

  const handleLayoutChange = useCallback((updatedLayout: PageLayout) => {
    setLayout(updatedLayout);
  }, []);

  const validateForm = (): string | null => {
    if (!metadata.title.trim()) {
      return 'Page title is required';
    }
    if (!metadata.slug.trim()) {
      return 'Page slug is required';
    }
    // Validate slug is URL-friendly
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(metadata.slug)) {
      return 'Slug must be URL-friendly (lowercase letters, numbers, and hyphens only)';
    }
    return null;
  };

  const handleSave = useCallback(async () => {
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...metadata,
        layout_json: layout,
      };

      if (id) {
        // Update existing page
        await api.put(`/page-builder/pages/${id}`, payload);
        setSnackbar({
          open: true,
          message: 'Page updated successfully',
          severity: 'success',
        });
      } else {
        // Create new page
        const response = await api.post('/page-builder/pages', payload);
        setSnackbar({
          open: true,
          message: 'Page created successfully',
          severity: 'success',
        });
        // Navigate to edit mode with the new page ID
        const newPageId = response.data.id;
        navigate(`/page-builder/editor/${newPageId}`, { replace: true });
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || 'Failed to save page';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [metadata, layout, id]);

  // Keyboard shortcut for save (Ctrl/Cmd + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleBack = () => {
    navigate('/page-builder');
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <Typography variant="h6" color="error">
          {error}
        </Typography>
        <Button variant="contained" onClick={handleBack}>
          Back to Page List
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <IconButton onClick={handleBack} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {id ? `Edit: ${metadata.title || 'Untitled Page'}` : 'Create New Page'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {saving ? 'Saving...' : 'Press Ctrl+S to save'}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Collapsible Metadata Sidebar */}
        <Collapse orientation="horizontal" in={sidebarOpen}>
          <Box
            sx={{
              width: 280,
              borderRight: '1px solid',
              borderColor: 'divider',
              p: 2,
              overflowY: 'auto',
              backgroundColor: 'background.paper',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Page Settings
            </Typography>

            <TextField
              label="Page Title"
              value={metadata.title}
              onChange={(e) => handleMetadataChange('title', e.target.value)}
              fullWidth
              required
              margin="normal"
              size="small"
            />

            <TextField
              label="Slug"
              value={metadata.slug}
              onChange={(e) => handleMetadataChange('slug', e.target.value)}
              fullWidth
              required
              margin="normal"
              size="small"
              helperText="URL-friendly identifier (e.g., about-us)"
            />

            <FormControl fullWidth margin="normal" size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={metadata.status}
                onChange={(e) =>
                  handleMetadataChange('status', e.target.value as 'draft' | 'published')
                }
                label="Status"
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Meta Description"
              value={metadata.meta_description}
              onChange={(e) => handleMetadataChange('meta_description', e.target.value)}
              fullWidth
              multiline
              rows={3}
              margin="normal"
              size="small"
              helperText={`${metadata.meta_description.length}/160 characters (recommended)`}
            />

            <TextField
              label="Meta Keywords"
              value={metadata.meta_keywords}
              onChange={(e) => handleMetadataChange('meta_keywords', e.target.value)}
              fullWidth
              margin="normal"
              size="small"
              helperText="Comma-separated keywords"
            />
          </Box>
        </Collapse>

        {/* Sidebar Toggle Button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderRight: sidebarOpen ? 0 : '1px solid',
            borderColor: 'divider',
          }}
        >
          <IconButton
            onClick={() => setSidebarOpen(!sidebarOpen)}
            size="small"
            sx={{ borderRadius: 0 }}
          >
            {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </Box>

        {/* Page Builder Editor */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            backgroundColor: '#f5f5f5',
          }}
        >
          <PageBuilderEditor
            initialLayout={layout}
            onChange={handleLayoutChange}
            onSave={handleSave}
            readOnly={false}
          />
        </Box>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PageBuilderEditorWrapper;
