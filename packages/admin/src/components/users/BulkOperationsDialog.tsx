// Bulk operations dialog for importing/exporting users

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CloudDownload as DownloadIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { Role } from '@monorepo/shared';
import Papa from 'papaparse';
import type { CreateUserRequest } from '../../types/user';
import { bulkImport, bulkExport } from '../../services/usersService';

interface BulkOperationsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedUserIds?: readonly string[];
}

type OperationType = 'import' | 'export';
type ExportFormat = 'csv' | 'json';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

const BulkOperationsDialog: React.FC<BulkOperationsDialogProps> = ({
  open,
  onClose,
  onSuccess,
  selectedUserIds = [],
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [operationType, setOperationType] = useState<OperationType>('import');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleReset = (): void => {
    setActiveStep(0);
    setOperationType('import');
    setExportFormat('csv');
    setSelectedFile(null);
    setLoading(false);
    setError(null);
    setImportResult(null);
  };

  const handleClose = (): void => {
    handleReset();
    onClose();
  };

  const handleNext = (): void => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = (): void => {
    setActiveStep((prev) => prev - 1);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      // Reject files over 5MB to prevent heavy parsing in browser
      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        setError('Selected file is too large. Maximum allowed size is 5MB.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const parseCSV = (csvText: string): CreateUserRequest[] => {
    const result = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (result.errors && result.errors.length > 0) {
      const message = result.errors
        .map((e) => `Row ${typeof e.row === 'number' ? e.row + 1 : 'unknown'}: ${e.message}`)
        .join('\n');
      throw new Error(`CSV parse error(s):\n${message}`);
    }

    const fields = result.meta?.fields || [];
    const requiredHeaders = ['username', 'email', 'password', 'role'];
    const missing = requiredHeaders.filter((h) => !fields.includes(h));
    if (missing.length > 0) {
      throw new Error(`Missing required header(s): ${missing.join(', ')}`);
    }

    const data = result.data || [];
    const errors: string[] = [];
    const users: CreateUserRequest[] = [];

    const validRoles = new Set<string>(Object.values(Role) as string[]);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    data.forEach((row, i) => {
      const humanRow = i + 2; // account for header row (row 1)
      const username = (row.username || '').trim();
      const email = (row.email || '').trim();
      const password = (row.password || '').toString();
      const roleRaw = (row.role || '').trim();
      const activeRaw = (row.active || '').trim().toLowerCase();

      // Required fields
      if (!username) {
        errors.push(`Row ${humanRow}: username is required and cannot be empty`);
      } else if (username.length < 3 || username.length > 30) {
        errors.push(`Row ${humanRow}: username must be 3-30 characters long`);
      }

      if (!email) {
        errors.push(`Row ${humanRow}: email is required and cannot be empty`);
      } else if (email.length > 254 || !emailRegex.test(email)) {
        errors.push(`Row ${humanRow}: email is invalid or too long`);
      }

      if (!password) {
        errors.push(`Row ${humanRow}: password is required and cannot be empty`);
      }

      if (!roleRaw) {
        errors.push(`Row ${humanRow}: role is required and cannot be empty`);
      } else if (!validRoles.has(roleRaw)) {
        errors.push(
          `Row ${humanRow}: role '${roleRaw}' is invalid. Allowed values: ${Array.from(validRoles).join(', ')}`
        );
      }

      let active: boolean | undefined = undefined;
      if (activeRaw) {
        if (activeRaw === 'true' || activeRaw === 'false') {
          active = activeRaw === 'true';
        } else {
          errors.push(`Row ${humanRow}: active must be 'true' or 'false' when provided`);
        }
      }

      // Only push this user if there are no errors recorded for THIS specific row
      if (!errors.some((e) => e.startsWith(`Row ${humanRow}:`))) {
        users.push({
          username,
          email,
          password,
          role: roleRaw as Role,
          active,
        });
      }
    });

    if (errors.length > 0) {
      throw new Error(`CSV validation error(s):\n${errors.join('\n')}`);
    }

    return users;
  };

  const handleImport = async (): Promise<void> => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    // Additional guard in case file came from a different source than the input
    const maxBytes = 5 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setError('Selected file is too large. Maximum allowed size is 5MB.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await selectedFile.text();
      let users: CreateUserRequest[];

      if (selectedFile.name.endsWith('.csv')) {
        users = parseCSV(text);
      } else if (selectedFile.name.endsWith('.json')) {
        const parsed = JSON.parse(text) as { users?: CreateUserRequest[] } | CreateUserRequest[];
        users = Array.isArray(parsed) ? parsed : (parsed.users || []);
      } else {
        throw new Error('Unsupported file format. Please use CSV or JSON.');
      }

      const result = await bulkImport({ users });
      setImportResult(result);
      handleNext();

      if (result.success > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Import failed:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to import users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const blob = await bulkExport(
        exportFormat,
        selectedUserIds.length > 0 ? [...selectedUserIds] : undefined
      );

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${Date.now()}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      handleNext();
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export users');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (): Promise<void> => {
    if (operationType === 'import') {
      await handleImport();
    } else {
      await handleExport();
    }
  };

  const getSteps = (): string[] => {
    if (operationType === 'import') {
      return ['Select Operation', 'Upload File', 'Review Results'];
    }
    return ['Select Operation', 'Configure Export', 'Download Complete'];
  };

  const renderStepContent = (step: number): React.ReactNode => {
    if (step === 0) {
      return (
        <Box>
          <Typography variant="body1" gutterBottom>
            Choose bulk operation type
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Paper
              variant="outlined"
              sx={{
                flex: 1,
                p: 3,
                cursor: 'pointer',
                border: operationType === 'import' ? 2 : 1,
                borderColor: operationType === 'import' ? 'primary.main' : 'divider',
                '&:hover': { borderColor: 'primary.main' },
              }}
              onClick={() => setOperationType('import')}
            >
              <Box textAlign="center">
                <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6">Import Users</Typography>
                <Typography variant="body2" color="text.secondary">
                  Upload CSV or JSON file to create multiple users
                </Typography>
              </Box>
            </Paper>

            <Paper
              variant="outlined"
              sx={{
                flex: 1,
                p: 3,
                cursor: 'pointer',
                border: operationType === 'export' ? 2 : 1,
                borderColor: operationType === 'export' ? 'primary.main' : 'divider',
                '&:hover': { borderColor: 'primary.main' },
              }}
              onClick={() => setOperationType('export')}
            >
              <Box textAlign="center">
                <DownloadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6">Export Users</Typography>
                <Typography variant="body2" color="text.secondary">
                  Download user data as CSV or JSON
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Box>
      );
    }

    if (operationType === 'import' && step === 1) {
      return (
        <Box>
          <Typography variant="body1" gutterBottom>
            Upload a CSV or JSON file containing user data
          </Typography>

          <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              CSV Format Requirements:
            </Typography>
            <Typography variant="body2" component="div">
              Headers: username, email, password, role, active (optional)
              <br />
              Example: john_doe,john@example.com,SecurePass123,editor,true
            </Typography>
          </Alert>

          <Box sx={{ mt: 3 }}>
            <input
              accept=".csv,.json"
              style={{ display: 'none' }}
              id="bulk-import-file"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="bulk-import-file">
              <Button variant="outlined" component="span" startIcon={<UploadIcon />} fullWidth>
                {selectedFile ? selectedFile.name : 'Choose File'}
              </Button>
            </label>
          </Box>

          {selectedFile && (
            <Alert severity="success" sx={{ mt: 2 }}>
              File selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </Alert>
          )}
        </Box>
      );
    }

    if (operationType === 'export' && step === 1) {
      return (
        <Box>
          <Typography variant="body1" gutterBottom>
            Configure export settings
          </Typography>

          <FormControl fullWidth sx={{ mt: 3 }}>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              label="Export Format"
            >
              <MenuItem value="csv">CSV - Comma Separated Values</MenuItem>
              <MenuItem value="json">JSON - JavaScript Object Notation</MenuItem>
            </Select>
          </FormControl>

          {selectedUserIds.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Exporting {selectedUserIds.length} selected user(s)
            </Alert>
          )}

          {selectedUserIds.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No users selected. All users will be exported.
            </Alert>
          )}
        </Box>
      );
    }

    if (step === 2) {
      if (operationType === 'import' && importResult) {
        return (
          <Box>
            <Box textAlign="center" mb={3}>
              {importResult.failed === 0 ? (
                <SuccessIcon sx={{ fontSize: 64, color: 'success.main' }} />
              ) : (
                <ErrorIcon sx={{ fontSize: 64, color: 'warning.main' }} />
              )}
            </Box>

            <Alert
              severity={importResult.failed === 0 ? 'success' : 'warning'}
              sx={{ mb: 3 }}
            >
              <Typography variant="subtitle2">
                Successfully imported {importResult.success} user(s)
              </Typography>
              {importResult.failed > 0 && (
                <Typography variant="body2">
                  Failed to import {importResult.failed} user(s)
                </Typography>
              )}
            </Alert>

            {importResult.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Import Errors:
                </Typography>
                <List dense>
                  {importResult.errors.map((err) => (
                    <ListItem key={err.index}>
                      <ListItemText
                        primary={`Row ${err.index + 1}`}
                        secondary={err.error}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        );
      }

      if (operationType === 'export') {
        return (
          <Box textAlign="center">
            <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Export Complete
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your file has been downloaded successfully
            </Typography>
          </Box>
        );
      }
    }

    return null;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Bulk Operations</Typography>
          <IconButton onClick={handleClose} size="small" aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {getSteps().map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ minHeight: 300 }}>{renderStepContent(activeStep)}</Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {activeStep === 2 ? 'Close' : 'Cancel'}
        </Button>
        {activeStep > 0 && activeStep < 2 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep === 0 && (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        )}
        {activeStep === 1 && (
           
          <Button
            variant="contained"
            onClick={handleExecute}
            disabled={loading || (operationType === 'import' && !selectedFile)}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {operationType === 'import' ? 'Import' : 'Export'}
          </Button>
        )}
        {activeStep === 2 && (
          <Button variant="contained" onClick={handleClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkOperationsDialog;
