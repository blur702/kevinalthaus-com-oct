/**
 * File Version History Dialog Component
 *
 * Displays version history timeline for a file with options to:
 * - View version details (number, date, size, checksum)
 * - Restore to a previous version
 * - Delete specific versions
 * - Manually create a new version
 * - Clean up old versions (retention policy)
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  IconButton,
  Alert,
  Chip,
  Tooltip,
  CircularProgress,
  Divider,
  TextField,
  Card,
  CardContent,
} from '@mui/material';
import {
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CleaningServices as CleanupIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import {
  listFileVersions,
  createFileVersion,
  restoreFileVersion,
  deleteFileVersion,
  cleanupOldVersions,
  formatFileSize,
  type FileVersion,
} from '../services/filesService';

interface VersionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  onVersionRestored?: () => void;
}

export function VersionHistoryDialog({
  open,
  onClose,
  fileId,
  fileName,
  onVersionRestored,
}: VersionHistoryDialogProps): JSX.Element {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [cleanupCount, setCleanupCount] = useState<number>(10);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  // Load versions
  useEffect(() => {
    if (open) {
      void loadVersions();
    }
  }, [open, fileId]);

  const loadVersions = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await listFileVersions(fileId);
      setVersions(result.versions);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const version = await createFileVersion(fileId);
      setVersions([version, ...versions]);
      setTotal(total + 1);
      setSuccess('New version created successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string, versionNumber: number): Promise<void> => {
    if (!confirm(`Restore to version ${versionNumber}? This will create a backup of the current file first.`)) {
      return;
    }

    setRestoringVersionId(versionId);
    setError(null);
    setSuccess(null);

    try {
      await restoreFileVersion(versionId, fileId);
      setSuccess(`File restored to version ${versionNumber}`);

      // Reload versions to show the new backup version
      await loadVersions();

      // Notify parent component
      if (onVersionRestored) {
        onVersionRestored();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore version');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleDeleteVersion = async (versionId: string, versionNumber: number): Promise<void> => {
    if (!confirm(`Delete version ${versionNumber}? This action cannot be undone.`)) {
      return;
    }

    setDeletingVersionId(versionId);
    setError(null);
    setSuccess(null);

    try {
      await deleteFileVersion(versionId, fileId);
      setVersions(versions.filter((v) => v.id !== versionId));
      setTotal(total - 1);
      setSuccess(`Version ${versionNumber} deleted`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete version');
    } finally {
      setDeletingVersionId(null);
    }
  };

  const handleCleanupVersions = async (): Promise<void> => {
    if (!confirm(`Keep only the ${cleanupCount} most recent versions and delete older ones?`)) {
      setShowCleanupDialog(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await cleanupOldVersions(fileId, cleanupCount);
      setSuccess(`Cleaned up ${result.deletedCount} old version(s)`);
      setShowCleanupDialog(false);

      // Reload versions
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup versions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const formatChecksum = (checksum: string | null): string => {
    if (!checksum) {return 'N/A';}
    return `${checksum.substring(0, 8)}...${checksum.substring(checksum.length - 8)}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Version History: {fileName}
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

        {/* Action Buttons */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => void handleCreateVersion()}
            disabled={loading}
          >
            Create Version
          </Button>
          <Button
            variant="outlined"
            startIcon={<CleanupIcon />}
            onClick={() => setShowCleanupDialog(!showCleanupDialog)}
            disabled={loading || versions.length === 0}
          >
            Cleanup Old Versions
          </Button>
        </Box>

        {/* Cleanup Dialog */}
        {showCleanupDialog && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Version Retention Policy
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  label="Keep Most Recent"
                  type="number"
                  value={cleanupCount}
                  onChange={(e) => setCleanupCount(Math.max(1, parseInt(e.target.value) || 1))}
                  inputProps={{ min: 1 }}
                  sx={{ width: 150 }}
                />
                <Typography variant="body2" color="text.secondary">
                  versions (delete older ones)
                </Typography>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => void handleCleanupVersions()}
                  disabled={loading}
                >
                  Apply Cleanup
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowCleanupDialog(false)}
                >
                  Cancel
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Version List */}
        <Typography variant="h6" gutterBottom>
          Version Timeline ({total} total)
        </Typography>

        {loading && versions.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : versions.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No versions created yet
          </Typography>
        ) : (
          <List>
            {versions.map((version, index) => (
              <ListItem
                key={version.id}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: index === 0 ? 'action.hover' : 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">
                      Version {version.versionNumber}
                    </Typography>
                    {index === 0 && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Latest"
                        color="success"
                        size="small"
                      />
                    )}
                  </Box>
                  <Box>
                    <Tooltip title="Restore to this version">
                      <IconButton
                        size="small"
                        onClick={() => void handleRestoreVersion(version.id, version.versionNumber)}
                        disabled={restoringVersionId === version.id || deletingVersionId === version.id}
                      >
                        {restoringVersionId === version.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <RestoreIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete version">
                      <IconButton
                        size="small"
                        onClick={() => void handleDeleteVersion(version.id, version.versionNumber)}
                        disabled={restoringVersionId === version.id || deletingVersionId === version.id}
                      >
                        {deletingVersionId === version.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Created: {formatDate(version.createdAt)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Size: {formatFileSize(version.fileSize)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Type: {version.mimeType}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                  >
                    Checksum: {formatChecksum(version.checksum)}
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
