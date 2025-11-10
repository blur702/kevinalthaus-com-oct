/**
 * Blog Form Component
 * Inline form for creating and editing blog posts
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
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
  Alert,
  Chip,
  InputAdornment,
  Paper,
  Typography,
  Stack,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { RichTextEditor, TaxonomyField } from '@monorepo/shared';
import type { BlogPost, BlogPostFormData } from '../types';

// Use the same API base URL as the admin app
const API_BASE: string = (import.meta as any).env?.VITE_API_URL || '/api';

interface BlogFormProps {
  onClose: () => void;
  onSave: () => void;
  editPost?: BlogPost | null;
}

export const BlogForm: React.FC<BlogFormProps> = ({
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
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (editPost) {
      // Parse meta_keywords from string to array
      let keywords: string[] = [];
      if (editPost.meta_keywords) {
        try {
          keywords = typeof editPost.meta_keywords === 'string'
            ? JSON.parse(editPost.meta_keywords)
            : editPost.meta_keywords;
        } catch {
          // If parsing fails, treat as empty array
          keywords = [];
        }
      }

      setFormData({
        title: editPost.title || '',
        body_html: editPost.body_html || '',
        slug: editPost.slug,
        excerpt: editPost.excerpt,
        meta_description: editPost.meta_description,
        meta_keywords: Array.isArray(keywords) ? keywords : [],
        reading_time_minutes: editPost.reading_time_minutes,
        allow_comments: editPost.allow_comments ?? true,
        status: editPost.status || 'draft',
        publish_at: editPost.publish_at,
      });

      // Load existing taxonomy terms
      const loadTerms = async () => {
        try {
          const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
          const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
          }

          const response = await fetch(`${API_BASE}/taxonomy/entities/blog_post/${editPost.id}/terms`, {
            credentials: 'include',
            headers,
          });

          if (response.ok) {
            const data = await response.json();
            const terms = data.terms || [];

            // Separate categories and tags based on vocabulary
            const categoryTerms = terms.filter((t: any) => t.vocabulary_id && t.vocabulary_id.includes('categor'));
            const tagTerms = terms.filter((t: any) => t.vocabulary_id && !t.vocabulary_id.includes('categor'));

            setCategories(categoryTerms.map((t: any) => t.id));
            setTags(tagTerms.map((t: any) => t.id));
          }
        } catch (err) {
          console.error('Failed to load taxonomy terms:', err);
        }
      };

      loadTerms();
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
      setCategories([]);
      setTags([]);
    }
    setError(null);
  }, [editPost]);

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

      const url = editPost ? `${API_BASE}/blog/${editPost.id}` : `${API_BASE}/blog`;
      const method = editPost ? 'PUT' : 'POST';

      // Get CSRF token from cookie
      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add CSRF token for state-changing requests
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      // Convert meta_keywords array to JSON string for API
      const payload = {
        ...formData,
        meta_keywords: formData.meta_keywords && formData.meta_keywords.length > 0
          ? JSON.stringify(formData.meta_keywords)
          : undefined,
      };

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save blog post');
      }

      // Get the blog post ID from response
      const savedPost = await response.json();
      const postId = savedPost.id;

      // Save taxonomy associations
      if (postId) {
        // Clear existing terms first
        await fetch(`${API_BASE}/taxonomy/entities/blog_post/${postId}/terms`, {
          method: 'DELETE',
          credentials: 'include',
          headers,
        });

        // Assign category terms
        for (const categoryId of categories) {
          await fetch(`${API_BASE}/taxonomy/entities/blog_post/${postId}/terms/${categoryId}`, {
            method: 'POST',
            credentials: 'include',
            headers,
          });
        }

        // Assign tag terms
        for (const tagId of tags) {
          await fetch(`${API_BASE}/taxonomy/entities/blog_post/${postId}/terms/${tagId}`, {
            method: 'POST',
            credentials: 'include',
            headers,
          });
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onClose}
            disabled={loading}
          >
            Back to List
          </Button>
          <Typography variant="h5" component="h2" sx={{ flexGrow: 1 }}>
            {editPost ? 'Edit Blog Post' : 'Create New Blog Post'}
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            name="title"
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
            name="slug"
            label="Slug"
            fullWidth
            value={formData.slug || ''}
            onChange={handleInputChange('slug')}
            placeholder="auto-generated-from-title"
            helperText="Leave empty to auto-generate from title"
          />
        </Grid>

        <Grid item xs={12}>
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
              Content *
            </Typography>
            <RichTextEditor
              value={formData.body_html}
              onChange={(html: string) => setFormData({ ...formData, body_html: html })}
              placeholder="Start writing your blog post..."
              minHeight={300}
              maxHeight={600}
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <TextField
            name="excerpt"
            label="Excerpt"
            fullWidth
            multiline
            rows={3}
            value={formData.excerpt || ''}
            onChange={handleInputChange('excerpt')}
            placeholder="Brief summary of the blog post"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TaxonomyField
            vocabularyMachineName="categories"
            label="Categories"
            value={categories}
            onChange={(value: string | string[]) => setCategories(Array.isArray(value) ? value : [value])}
            helperText="Select one or more categories for this post"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TaxonomyField
            vocabularyMachineName="tags"
            label="Tags"
            value={tags}
            onChange={(value: string | string[]) => setTags(Array.isArray(value) ? value : [value])}
            helperText="Add relevant tags to help readers find this post"
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            name="meta_description"
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
            name="reading_time_minutes"
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

        <Grid item xs={12}>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button onClick={onClose} disabled={loading} variant="outlined">
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
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};
