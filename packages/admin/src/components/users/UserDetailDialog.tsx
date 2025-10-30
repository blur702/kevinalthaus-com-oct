// User detail view dialog with activity timeline

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
  Grid,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { Role } from '@monorepo/shared';
import type { User } from '../../types/user';
import ActivityTimeline from './ActivityTimeline';
import { getCustomFields, updateCustomFields } from '../../services/usersService';

interface UserDetailDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onEdit?: (user: User) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-detail-tabpanel-${index}`}
      aria-labelledby={`user-detail-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const UserDetailDialog: React.FC<UserDetailDialogProps> = ({ open, user, onClose, onEdit }) => {
  const [tabValue, setTabValue] = useState(0);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false);
  const [customFieldsError, setCustomFieldsError] = useState<string | null>(null);
  const [editingCustomFields, setEditingCustomFields] = useState(false);
  const [customFieldsJson, setCustomFieldsJson] = useState('');

  useEffect(() => {
    if (user && open) {
      setTabValue(0);
      setEditingCustomFields(false);
      setCustomFieldsJson('');

      // Load custom fields if user has any
      if (user.customFields) {
        setCustomFields(user.customFields);
      } else {
        // Fetch from API
        const fetchCustomFields = async (): Promise<void> => {
          try {
            setCustomFieldsLoading(true);
            setCustomFieldsError(null);
            const data = await getCustomFields(user.id);
            setCustomFields(data.customFields || {});
          } catch (err) {
            console.error('Failed to fetch custom fields:', err);
            setCustomFieldsError('Failed to load custom fields');
            setCustomFields({});
          } finally {
            setCustomFieldsLoading(false);
          }
        };

        void fetchCustomFields();
      }
    }
  }, [user, open]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue);
  };

  const handleEditCustomFields = (): void => {
    setEditingCustomFields(true);
    setCustomFieldsJson(JSON.stringify(customFields, null, 2));
    setCustomFieldsError(null);
  };

  const handleSaveCustomFields = async (): Promise<void> => {
    if (!user) {
      return;
    }

    try {
      const parsed = JSON.parse(customFieldsJson) as Record<string, unknown>;
      setCustomFieldsLoading(true);
      setCustomFieldsError(null);

      const data = await updateCustomFields(user.id, parsed);
      setCustomFields(data.customFields);
      setEditingCustomFields(false);
    } catch (err) {
      console.error('Failed to update custom fields:', err);
      if (err instanceof SyntaxError) {
        setCustomFieldsError('Invalid JSON format');
      } else if (err instanceof Error) {
        setCustomFieldsError(err.message);
      } else {
        setCustomFieldsError('Failed to update custom fields');
      }
    } finally {
      setCustomFieldsLoading(false);
    }
  };

  const handleCancelCustomFields = (): void => {
    setEditingCustomFields(false);
    setCustomFieldsJson('');
    setCustomFieldsError(null);
  };

  const getRoleColor = (role: Role): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (role) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.ADMIN:
        return 'error';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.EDITOR:
        return 'primary';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.VIEWER:
        return 'info';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.GUEST:
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" component="span">
              User Details
            </Typography>
            <Chip
              label={user.active ? 'Active' : 'Inactive'}
              color={user.active ? 'success' : 'default'}
              size="small"
            />
          </Box>
          <Box>
            {onEdit && (
              <IconButton
                onClick={() => onEdit(user)}
                aria-label="Edit user"
                title="Edit user"
                size="small"
                sx={{ mr: 1 }}
              >
                <EditIcon />
              </IconButton>
            )}
            <IconButton onClick={onClose} aria-label="Close" size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        aria-label="User detail tabs"
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab icon={<PersonIcon />} label="Profile" id="user-detail-tab-0" />
        <Tab icon={<TimelineIcon />} label="Activity" id="user-detail-tab-1" />
        <Tab icon={<SettingsIcon />} label="Custom Fields" id="user-detail-tab-2" />
      </Tabs>

      <DialogContent sx={{ minHeight: 400 }}>
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Username
                </Typography>
                <Typography variant="body1">{user.username}</Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Email
                </Typography>
                <Typography variant="body1">{user.email}</Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Role
                </Typography>
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */}
                <Chip label={user.role} color={getRoleColor(user.role as Role)} />
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Status
                </Typography>
                <Chip
                  label={user.active ? 'Active' : 'Inactive'}
                  color={user.active ? 'success' : 'default'}
                />
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Created
                </Typography>
                <Typography variant="body2">{formatDate(user.createdAt)}</Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Last Updated
                </Typography>
                <Typography variant="body2">{formatDate(user.updatedAt)}</Typography>
              </Paper>
            </Grid>

            {user.lastLogin && (
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Last Login
                  </Typography>
                  <Typography variant="body2">{formatDate(user.lastLogin)}</Typography>
                </Paper>
              </Grid>
            )}

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  User ID
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {user.id}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ActivityTimeline userId={user.id} limit={50} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box>
            {customFieldsError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {customFieldsError}
              </Alert>
            )}

            {editingCustomFields ? (
              <Box>
                <TextField
                  label="Custom Fields (JSON)"
                  value={customFieldsJson}
                  onChange={(e) => setCustomFieldsJson(e.target.value)}
                  multiline
                  rows={12}
                  fullWidth
                  disabled={customFieldsLoading}
                  helperText="Enter valid JSON object"
                  inputProps={{
                    'aria-label': 'Custom fields JSON',
                    style: { fontFamily: 'monospace', fontSize: '0.875rem' },
                  }}
                />
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    onClick={handleSaveCustomFields}
                    disabled={customFieldsLoading}
                  >
                    {customFieldsLoading ? <CircularProgress size={20} /> : 'Save'}
                  </Button>
                  <Button onClick={handleCancelCustomFields} disabled={customFieldsLoading}>
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
                {customFieldsLoading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : Object.keys(customFields).length === 0 ? (
                  <Box py={4} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      No custom fields defined
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={handleEditCustomFields}
                      sx={{ mt: 2 }}
                      startIcon={<EditIcon />}
                    >
                      Add Custom Fields
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle2">Custom Fields</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleEditCustomFields}
                        startIcon={<EditIcon />}
                      >
                        Edit
                      </Button>
                    </Box>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {JSON.stringify(customFields, null, 2)}
                      </Box>
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <Divider />

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {onEdit && (
          <Button variant="contained" onClick={() => onEdit(user)} startIcon={<EditIcon />}>
            Edit User
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default UserDetailDialog;
