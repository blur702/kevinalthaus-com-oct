/**
 * File Share Dialog Component
 *
 * Allows users to create and manage file sharing links with options for:
 * - Expiration dates
 * - Download limits
 * - Password protection
 * - Copy share URL to clipboard
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  Chip,
  Tooltip,
  InputAdornment,
  FormControlLabel,
  Switch,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import {
  createFileShare,
  listFileShares,
  revokeFileShare,
  getPublicShareUrl,
  type FileShare,
  type CreateShareOptions,
} from '../services/filesService';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
}

export function ShareDialog({ open, onClose, fileId, fileName }: ShareDialogProps): JSX.Element {
  const [shares, setShares] = useState<FileShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New share form state
  const [expiresAt, setExpiresAt] = useState('');
  const [maxDownloads, setMaxDownloads] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enableExpiration, setEnableExpiration] = useState(false);
  const [enableDownloadLimit, setEnableDownloadLimit] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);

  // Load existing shares
  useEffect(() => {
    if (open) {
      void loadShares();
    }
  }, [open, fileId]);

  const loadShares = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const loadedShares = await listFileShares(fileId);
      setShares(loadedShares);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const options: CreateShareOptions = {};

      if (enableExpiration && expiresAt) {
        options.expiresAt = new Date(expiresAt).toISOString();
      }

      if (enableDownloadLimit && maxDownloads !== '') {
        options.maxDownloads = Number(maxDownloads);
      }

      if (enablePassword && password) {
        options.password = password;
      }

      const share = await createFileShare(fileId, options);
      setShares([share, ...shares]);
      setSuccess('Share link created successfully!');

      // Reset form
      setExpiresAt('');
      setMaxDownloads('');
      setPassword('');
      setEnableExpiration(false);
      setEnableDownloadLimit(false);
      setEnablePassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: string): Promise<void> => {
    if (!confirm('Are you sure you want to revoke this share link?')) {
      return;
    }

    try {
      await revokeFileShare(shareId);
      setShares(shares.filter((s) => s.id !== shareId));
      setSuccess('Share link revoked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share');
    }
  };

  const handleCopyUrl = (shareToken: string): void => {
    const url = getPublicShareUrl(shareToken);
    void navigator.clipboard.writeText(url);
    setSuccess('Share URL copied to clipboard!');
    setTimeout(() => setSuccess(null), 3000);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) {return 'Never';}
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (share: FileShare): boolean => {
    if (!share.expiresAt) {return false;}
    return new Date(share.expiresAt) < new Date();
  };

  const isDownloadLimitReached = (share: FileShare): boolean => {
    if (share.maxDownloads === null) {return false;}
    return share.downloadCount >= share.maxDownloads;
  };

  const getShareStatus = (share: FileShare): { label: string; color: 'success' | 'error' | 'warning' } => {
    if (!share.isActive) {
      return { label: 'Revoked', color: 'error' };
    }
    if (isExpired(share)) {
      return { label: 'Expired', color: 'error' };
    }
    if (isDownloadLimitReached(share)) {
      return { label: 'Limit Reached', color: 'warning' };
    }
    return { label: 'Active', color: 'success' };
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Share File: {fileName}
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Create New Share */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Create New Share Link
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Expiration Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={enableExpiration}
                  onChange={(e) => setEnableExpiration(e.target.checked)}
                />
              }
              label="Set Expiration Date"
            />

            {enableExpiration && (
              <TextField
                label="Expires At"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: new Date().toISOString().slice(0, 16),
                }}
              />
            )}

            {/* Download Limit Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={enableDownloadLimit}
                  onChange={(e) => setEnableDownloadLimit(e.target.checked)}
                />
              }
              label="Set Download Limit"
            />

            {enableDownloadLimit && (
              <TextField
                label="Max Downloads"
                type="number"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                inputProps={{ min: 1 }}
              />
            )}

            {/* Password Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.checked)}
                />
              }
              label="Protect with Password"
            />

            {enablePassword && (
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}

            <Button
              variant="contained"
              startIcon={<LinkIcon />}
              onClick={() => void handleCreateShare()}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Create Share Link'}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Existing Shares */}
        <Typography variant="h6" gutterBottom>
          Existing Share Links
        </Typography>

        {loading && shares.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : shares.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No share links created yet
          </Typography>
        ) : (
          <List>
            {shares.map((share) => {
              const status = getShareStatus(share);
              return (
                <ListItem key={share.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 1 }}>
                    <Box>
                      <Chip label={status.label} color={status.color} size="small" sx={{ mr: 1 }} />
                      {share.passwordHash && <Chip label="Password Protected" size="small" sx={{ mr: 1 }} />}
                    </Box>
                    <Box>
                      <Tooltip title="Copy Share URL">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyUrl(share.shareToken)}
                          disabled={!share.isActive || isExpired(share)}
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Revoke Share">
                        <IconButton
                          size="small"
                          onClick={() => void handleRevokeShare(share.id)}
                          disabled={!share.isActive}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                      >
                        {getPublicShareUrl(share.shareToken)}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" display="block">
                          Created: {formatDate(share.createdAt)}
                        </Typography>
                        {share.expiresAt && (
                          <Typography variant="caption" display="block">
                            Expires: {formatDate(share.expiresAt)}
                          </Typography>
                        )}
                        {share.maxDownloads !== null && (
                          <Typography variant="caption" display="block">
                            Downloads: {share.downloadCount} / {share.maxDownloads}
                          </Typography>
                        )}
                        {share.lastAccessedAt && (
                          <Typography variant="caption" display="block">
                            Last Accessed: {formatDate(share.lastAccessedAt)}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
