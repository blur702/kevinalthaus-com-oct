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
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import type { AIServiceConfig } from '../../types/aiService';
import { updateAIService } from '../../services/aiServicesService';

interface ServiceConfigDialogProps {
  open: boolean;
  service: AIServiceConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  apiKey: string;
  enabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface FormErrors {
  apiKey?: string;
  model?: string;
  temperature?: string;
  maxTokens?: string;
  submit?: string;
}

const ServiceConfigDialog: React.FC<ServiceConfigDialogProps> = ({
  open,
  service,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormData>({
    apiKey: '',
    enabled: false,
    model: '',
    temperature: 0.7,
    maxTokens: 4096,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (service && open) {
      setFormData({
        apiKey: '',
        enabled: service.enabled,
        model: (service.settings.model as string) || '',
        temperature: (service.settings.temperature as number) || 0.7,
        maxTokens: (service.settings.max_tokens as number) || 4096,
      });
      setErrors({});
      setShowApiKey(false);
    }
  }, [service, open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate API key with provider-specific checks
    if (formData.apiKey && service) {
      const apiKey = formData.apiKey.trim();
      const serviceName = service.service_name;

      switch (serviceName) {
        case 'chatgpt':
          if (!apiKey.startsWith('sk-')) {
            newErrors.apiKey = 'OpenAI API key must start with "sk-"';
          } else if (apiKey.length < 51) {
            newErrors.apiKey = 'OpenAI API key must be at least 51 characters long';
          }
          break;
        case 'claude':
          if (!apiKey.startsWith('sk-ant-')) {
            newErrors.apiKey = 'Anthropic API key must start with "sk-ant-"';
          } else if (apiKey.length < 100) {
            newErrors.apiKey = 'Anthropic API key must be at least 100 characters long';
          }
          break;
        case 'gemini':
          if (apiKey.length < 39) {
            newErrors.apiKey = 'Google Gemini API key must be at least 39 characters long';
          }
          break;
        case 'deepseek':
          if (!apiKey.startsWith('sk-')) {
            newErrors.apiKey = 'DeepSeek API key must start with "sk-"';
          } else if (apiKey.length < 51) {
            newErrors.apiKey = 'DeepSeek API key must be at least 51 characters long';
          }
          break;
        default:
          if (apiKey.length < 30) {
            newErrors.apiKey = 'API key must be at least 30 characters long';
          }
      }
    }

    if (!formData.model.trim()) {
      newErrors.model = 'Model is required';
    }

    if (formData.temperature < 0 || formData.temperature > 2) {
      newErrors.temperature = 'Temperature must be between 0 and 2';
    }

    if (formData.maxTokens < 1 || formData.maxTokens > 32000) {
      newErrors.maxTokens = 'Max tokens must be between 1 and 32000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateForm() || !service) return;

    setLoading(true);
    setErrors({});

    try {
      await updateAIService(service.service_name, {
        ...(formData.apiKey ? { api_key: formData.apiKey } : {}),
        enabled: formData.enabled,
        settings: {
          model: formData.model,
          temperature: formData.temperature,
          max_tokens: formData.maxTokens,
        },
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setErrors({
        submit: err.response?.data?.error || 'Failed to update service configuration',
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

  if (!service) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Configure {service.service_name.charAt(0).toUpperCase() + service.service_name.slice(1)}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {errors.submit && (
              <Alert severity="error" onClose={() => setErrors({ ...errors, submit: undefined })}>
                {errors.submit}
              </Alert>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  disabled={loading}
                />
              }
              label="Enable Service"
            />

            <TextField
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              fullWidth
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              error={Boolean(errors.apiKey)}
              helperText={
                errors.apiKey ||
                (service.api_key_configured
                  ? 'API key is already configured. Enter a new key to update.'
                  : 'Enter the API key for this service')
              }
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowApiKey(!showApiKey)}
                      edge="end"
                      size="small"
                    >
                      {showApiKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Model"
              fullWidth
              required
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              error={Boolean(errors.model)}
              helperText={errors.model || 'Enter the model name (e.g., gpt-4, claude-3-opus-20240229)'}
              disabled={loading}
            />

            <TextField
              label="Temperature"
              type="number"
              fullWidth
              required
              value={formData.temperature}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                setFormData({
                  ...formData,
                  temperature: Number.isNaN(parsed) ? 0 : parsed
                });
              }}
              error={Boolean(errors.temperature)}
              helperText={errors.temperature || 'Controls randomness (0-2)'}
              disabled={loading}
              inputProps={{
                min: 0,
                max: 2,
                step: 0.1,
              }}
            />

            <TextField
              label="Max Tokens"
              type="number"
              fullWidth
              required
              value={formData.maxTokens}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setFormData({
                  ...formData,
                  maxTokens: Number.isNaN(parsed) ? 0 : parsed
                });
              }}
              error={Boolean(errors.maxTokens)}
              helperText={errors.maxTokens || 'Maximum number of tokens to generate'}
              disabled={loading}
              inputProps={{
                min: 1,
                max: 32000,
                step: 1,
              }}
            />

            {service.api_key_configured && (
              <Alert severity="info">
                This service already has an API key configured. Leave the API key field empty to keep
                the existing key, or enter a new key to replace it.
              </Alert>
            )}
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
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ServiceConfigDialog;
