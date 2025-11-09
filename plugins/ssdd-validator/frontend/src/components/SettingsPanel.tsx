/**
 * SettingsPanel - Admin settings for SSDD Validator plugin
 *
 * Features:
 * - USPS API key configuration
 * - Congressional member sync
 * - Status display
 * - Success/error messaging
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Divider,
} from '@mui/material';
import { Save as SaveIcon, Sync as SyncIcon } from '@mui/icons-material';
import type { SettingsData, ApiError } from '../types';

const SettingsPanel: React.FC = () => {
  const [uspsApiKey, setUspsApiKey] = useState('');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ssdd-validator/settings', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || 'Failed to load settings');
      }

      const data: SettingsData = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!uspsApiKey.trim()) {
      setError('API key cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ssdd-validator/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ uspsApiKey }),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || 'Failed to save API key');
      }

      setSuccess('USPS API key saved successfully');
      setUspsApiKey('');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMembers = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ssdd-validator/sync-members', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || 'Failed to sync members');
      }

      const data = await response.json();
      setSuccess(`Successfully synced ${data.count} congressional members`);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync members');
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !settings) {
    return (
      <Paper elevation={3} sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        SSDD Validator Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure USPS API integration and sync congressional member data
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* USPS API Key Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          USPS API Configuration
        </Typography>

        {settings?.uspsApiKeyConfigured && (
          <Alert severity="info" sx={{ mb: 2 }}>
            USPS API key is configured
          </Alert>
        )}

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              type="password"
              label="USPS API Key"
              value={uspsApiKey}
              onChange={(e) => setUspsApiKey(e.target.value)}
              disabled={loading}
              placeholder="Enter your USPS API key"
              helperText="Get your API key from https://www.usps.com/business/web-tools-apis/"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSaveApiKey}
              disabled={loading || !uspsApiKey.trim()}
            >
              Save API Key
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Congressional Members Sync Section */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Congressional Members Data
        </Typography>

        {settings?.lastMemberSync && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Last synced: {new Date(settings.lastMemberSync).toLocaleString()}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sync the latest congressional member information from the official House of Representatives API.
          This updates representative names, party affiliations, contact information, and district assignments.
        </Typography>

        <Button
          variant="contained"
          color="secondary"
          startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
          onClick={handleSyncMembers}
          disabled={syncing}
        >
          {syncing ? 'Syncing Members...' : 'Sync Congressional Members'}
        </Button>
      </Box>
    </Paper>
  );
};

export default SettingsPanel;
