import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Box,
  Alert,
  CircularProgress,
  MenuItem,
  Chip,
  Typography,
} from '@mui/material';
import type { AIPrompt, AIPromptCategory } from '../../types/aiService';
import {
  createPrompt,
  updatePrompt,
  listCategories,
} from '../../services/aiServicesService';

interface PromptDialogProps {
  open: boolean;
  prompt: AIPrompt | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  title: string;
  content: string;
  category_id: string;
  variables: string[];
  variableInput: string;
  metadataJson: string;
  is_favorite: boolean;
}

interface FormErrors {
  title?: string;
  content?: string;
  variables?: string;
  metadataJson?: string;
  submit?: string;
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  prompt,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    content: '',
    category_id: '',
    variables: [],
    variableInput: '',
    metadataJson: '{}',
    is_favorite: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<AIPromptCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    if (open) {
      const controller = new AbortController();

      const loadCategoriesWithSignal = async (): Promise<void> => {
        setLoadingCategories(true);
        try {
          const data = await listCategories(controller.signal);
          if (!controller.signal.aborted) {
            setCategories(data);
          }
        } catch (error) {
          const err = error as { name?: string };
          if (err.name !== 'AbortError') {
            console.error('Failed to load categories:', error);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoadingCategories(false);
          }
        }
      };

      loadCategoriesWithSignal();

      if (prompt) {
        setFormData({
          title: prompt.title,
          content: prompt.content,
          category_id: prompt.category_id || '',
          variables: prompt.variables || [],
          variableInput: '',
          metadataJson: JSON.stringify(prompt.metadata || {}, null, 2),
          is_favorite: prompt.is_favorite,
        });
      } else {
        setFormData({
          title: '',
          content: '',
          category_id: '',
          variables: [],
          variableInput: '',
          metadataJson: '{}',
          is_favorite: false,
        });
      }
      setErrors({});

      return () => {
        controller.abort();
      };
    }
  }, [prompt, open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 255) {
      newErrors.title = 'Title must be less than 255 characters';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    // Validate metadata JSON
    try {
      JSON.parse(formData.metadataJson);
    } catch {
      newErrors.metadataJson = 'Invalid JSON format';
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
      const metadata = JSON.parse(formData.metadataJson) as Record<string, unknown>;

      const requestData = {
        title: formData.title,
        content: formData.content,
        category_id: formData.category_id || undefined,
        variables: formData.variables,
        metadata,
        is_favorite: formData.is_favorite,
      };

      if (prompt) {
        await updatePrompt(prompt.id, requestData);
      } else {
        await createPrompt(requestData);
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setErrors({
        submit: err.response?.data?.error || `Failed to ${prompt ? 'update' : 'create'} prompt`,
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

  const handleAddVariable = (): void => {
    const variable = formData.variableInput.trim();
    if (variable && !formData.variables.includes(variable)) {
      setFormData({
        ...formData,
        variables: [...formData.variables, variable],
        variableInput: '',
      });
    }
  };

  const handleDeleteVariable = (variableToDelete: string): void => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((v) => v !== variableToDelete),
    });
  };

  const handleVariableInputKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (loading) {
        return;
      }
      e.preventDefault();
      handleAddVariable();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {prompt ? 'Edit Prompt' : 'Create New Prompt'}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {errors.submit && (
              <Alert severity="error" onClose={() => setErrors({ ...errors, submit: undefined })}>
                {errors.submit}
              </Alert>
            )}

            <TextField
              label="Title"
              fullWidth
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              error={Boolean(errors.title)}
              helperText={errors.title || 'A descriptive title for this prompt'}
              disabled={loading}
            />

            <TextField
              label="Content"
              fullWidth
              required
              multiline
              rows={8}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              error={Boolean(errors.content)}
              helperText={errors.content || 'The prompt template content. Use {{variable}} for placeholders.'}
              disabled={loading}
            />

            <TextField
              label="Category"
              fullWidth
              select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              disabled={loading || loadingCategories}
              helperText="Optional category for organizing prompts"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Variables
              </Typography>
              <TextField
                label="Add Variable"
                fullWidth
                value={formData.variableInput}
                onChange={(e) => setFormData({ ...formData, variableInput: e.target.value })}
                onKeyDown={handleVariableInputKeyDown}
                helperText="Enter variable names that will be used in the prompt template (press Enter to add)"
                disabled={loading}
                InputProps={{
                  endAdornment: (
                    <Button
                      size="small"
                      onClick={handleAddVariable}
                      disabled={!formData.variableInput.trim()}
                    >
                      Add
                    </Button>
                  ),
                }}
              />
              {formData.variables.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {formData.variables.map((variable) => (
                    <Chip
                      key={variable}
                      label={variable}
                      onDelete={() => handleDeleteVariable(variable)}
                      disabled={loading}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            </Box>

            <TextField
              label="Metadata (JSON)"
              fullWidth
              multiline
              rows={4}
              value={formData.metadataJson}
              onChange={(e) => setFormData({ ...formData, metadataJson: e.target.value })}
              error={Boolean(errors.metadataJson)}
              helperText={errors.metadataJson || 'Additional metadata in JSON format'}
              disabled={loading}
              sx={{ fontFamily: 'monospace' }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_favorite}
                  onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                  disabled={loading}
                />
              }
              label="Mark as Favorite"
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
            {loading ? 'Saving...' : prompt ? 'Update Prompt' : 'Create Prompt'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PromptDialog;
