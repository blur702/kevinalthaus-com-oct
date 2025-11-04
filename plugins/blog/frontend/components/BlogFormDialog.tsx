/**
 * Blog Form Dialog Component
 * Dialog for creating and editing blog posts
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid,
  SelectChangeEvent,
  Box,
  Alert,
  Chip,
  InputAdornment,
} from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import type { BlogPost, BlogPostFormData } from '../types';

interface BlogFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editPost?: BlogPost | null;
}

export const BlogFormDialog: React.FC<BlogFormDialogProps> = ({
  open,
  onClose,
  onSave,
  editPost,
}) => {
  const [formData, setFormData] = useState<BlogPostFormData>({
    title: '',
    body_html: '',
    excerpt: '',
    meta_description: '',
    meta_keywords: [],
    reading_time_minutes: 5,
    allow_comments: true,
    status: 'draft',
  });

  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editPost) {
      setFormData({
        ...editPost,
        meta_keywords: editPost.meta_keywords || [],
      });
    } else {
      setFormData({
        title: '',
        body_html: '',
        excerpt: '',
        meta_description: '',
        meta_keywords: [],
        reading_time_minutes: 5,
        allow_comments: true,
        status: 'draft',
      });
    }
    setError(null);
  }, [editPost, open]);

  const handleInputChange = (field: keyof BlogPostFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.type === 'checkbox'
      ? (event.target as HTMLInputElement).checked
      : event.target.value;

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSelectChange = (field: keyof BlogPostFormData) => (
    event: SelectChangeEvent<string>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && formData.meta_keywords) {
      setFormData((prev) => ({
        ...prev,
        meta_keywords: [...(prev.meta_keywords || []), keywordInput.trim()],
      }));
      setKeywordInput('');
    }
  };

  const handleDeleteKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      meta_keywords: prev.meta_keywords?.filter((k) => k !== keyword) || [],
    }));
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddKeyword();
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = editPost ? `/api/blog/${editPost.id}` : '/api/blog';
      const method = editPost ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save blog post');
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editPost ? 'Edit Blog Post' : 'Create New Blog Post'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              label="Title"
              fullWidth
              required
              value={formData.title}
              onChange={handleInputChange('title')}
              placeholder="Enter blog post title"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Slug"
              fullWidth
              value={formData.slug || ''}
              onChange={handleInputChange('slug')}
              placeholder="auto-generated-from-title"
              helperText="Leave empty to auto-generate from title"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Content"
              fullWidth
              required
              multiline
              rows={12}
              value={formData.body_html}
              onChange={handleInputChange('body_html')}
              placeholder="Enter blog post content (HTML supported)"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Excerpt"
              fullWidth
              multiline
              rows={3}
              value={formData.excerpt || ''}
              onChange={handleInputChange('excerpt')}
              placeholder="Brief summary of the blog post"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Meta Description"
              fullWidth
              value={formData.meta_description || ''}
              onChange={handleInputChange('meta_description')}
              placeholder="SEO meta description"
              helperText="160 characters recommended"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Add Keyword"
              fullWidth
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type keyword and press Enter"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button onClick={handleAddKeyword} size="small">
                      Add
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.meta_keywords?.map((keyword) => (
                <Chip
                  key={keyword}
                  label={keyword}
                  onDelete={() => handleDeleteKeyword(keyword)}
                  size="small"
                />
              ))}
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Reading Time (minutes)"
              type="number"
              fullWidth
              value={formData.reading_time_minutes || ''}
              onChange={handleInputChange('reading_time_minutes')}
              inputProps={{ min: 1 }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={handleSelectChange('status')}
                label="Status"
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {formData.status === 'scheduled' && (
            <Grid item xs={12}>
              <TextField
                label="Publish At"
                type="datetime-local"
                fullWidth
                value={formData.publish_at || ''}
                onChange={handleInputChange('publish_at')}
                InputLabelProps={{
                  shrink: true,
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ScheduleIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.allow_comments}
                  onChange={handleInputChange('allow_comments')}
                />
              }
              label="Allow Comments"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading || !formData.title || !formData.body_html}
        >
          {loading ? 'Saving...' : editPost ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
