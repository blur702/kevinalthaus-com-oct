import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import type { AIPromptCategory } from '../../types/aiService';
import {
  createCategory,
  updateCategory,
  listCategories,
} from '../../services/aiServicesService';

interface CategoryDialogProps {
  open: boolean;
  category: AIPromptCategory | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  description: string;
  parent_id: string;
  sort_order: number;
}

interface FormErrors {
  name?: string;
  sort_order?: string;
  submit?: string;
}

const CategoryDialog: React.FC<CategoryDialogProps> = ({
  open,
  category,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    parent_id: '',
    sort_order: 0,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<AIPromptCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string>('');

  useEffect(() => {
    if (open) {
      loadCategories();

      if (category) {
        setFormData({
          name: category.name,
          description: category.description || '',
          parent_id: category.parent_id || '',
          sort_order: category.sort_order,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          parent_id: '',
          sort_order: 0,
        });
      }
      setErrors({});
    }
  }, [category, open]);

  const loadCategories = async (): Promise<void> => {
    setLoadingCategories(true);
    try {
      const data = await listCategories();

      if (!category) {
        setCategories(data);
        return;
      }

      // Build parent->children map
      const childrenMap = new Map<string, string[]>();
      for (const cat of data) {
        if (cat.parent_id) {
          const children = childrenMap.get(cat.parent_id) || [];
          children.push(cat.id);
          childrenMap.set(cat.parent_id, children);
        }
      }

      // Find all descendants using BFS
      const descendants = new Set<string>();
      const queue = [category.id];
      const visited = new Set<string>([category.id]);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = childrenMap.get(currentId) || [];

        for (const childId of children) {
          if (!visited.has(childId)) {
            visited.add(childId);
            descendants.add(childId);
            queue.push(childId);
          }
        }
      }

      // Filter out current category and all its descendants
      const availableCategories = data.filter(
        (cat) => cat.id !== category.id && !descendants.has(cat.id)
      );

      setCategories(availableCategories);
      setCategoriesError('');
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategoriesError('Failed to load categories. Please try again.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    }

    if (formData.sort_order < 0 || formData.sort_order > 9999) {
      newErrors.sort_order = 'Sort order must be between 0 and 9999';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const requestData = {
        name: formData.name,
        description: formData.description || undefined,
        parent_id: formData.parent_id || undefined,
        sort_order: formData.sort_order,
      };

      if (category) {
        await updateCategory(category.id, requestData);
      } else {
        await createCategory(requestData);
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      // Type guard to safely extract error message
      const isErrorWithResponse = (err: unknown): err is { response: { data: { error: string } } } => {
        return (
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as {response?: unknown}).response === 'object' &&
          (err as {response?: unknown}).response !== null &&
          'data' in ((err as {response: unknown}).response as object) &&
          typeof ((err as {response: {data?: unknown}}).response.data) === 'object' &&
          ((err as {response: {data?: unknown}}).response.data) !== null &&
          'error' in (((err as {response: {data: unknown}}).response.data) as object) &&
          typeof (((err as {response: {data: {error?: unknown}}}).response.data).error) === 'string'
        );
      };

      const errorMessage = isErrorWithResponse(error)
        ? error.response.data.error
        : (error instanceof Error ? error.message : null) ||
          `Failed to ${category ? 'update' : 'create'} category`;

      setErrors({
        submit: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (): void => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {category ? 'Edit Category' : 'Create New Category'}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {errors.submit && (
              <Alert severity="error" onClose={() => setErrors({ ...errors, submit: undefined })}>
                {errors.submit}
              </Alert>
            )}

            <TextField
              label="Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={Boolean(errors.name)}
              helperText={errors.name || 'A descriptive name for this category'}
              disabled={loading}
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              helperText="Optional description for this category"
              disabled={loading}
            />

            <TextField
              label="Parent Category"
              fullWidth
              select
              value={formData.parent_id}
              onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
              disabled={loading || loadingCategories || Boolean(categoriesError)}
              helperText={categoriesError || "Optional parent category for creating a hierarchy"}
              error={Boolean(categoriesError)}
            >
              <MenuItem value="">
                <em>None (Top Level)</em>
              </MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Sort Order"
              type="number"
              fullWidth
              value={formData.sort_order}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setFormData({
                  ...formData,
                  sort_order: Number.isNaN(parsed) ? 0 : parsed
                });
              }}
              error={Boolean(errors.sort_order)}
              helperText={errors.sort_order || 'Determines the display order (lower numbers appear first)'}
              disabled={loading}
              inputProps={{
                min: 0,
                max: 9999,
                step: 1,
              }}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading && <CircularProgress size={16} />}
          >
            {loading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CategoryDialog;
