import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
  Paper,
  FormControl,
  InputAdornment,
  Checkbox,
  FormGroup,
} from '@mui/material';
import {
  Save as SaveIcon,
  Science as TestIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  getSiteSettings,
  updateSiteSettings,
  getSecuritySettings,
  updateSecuritySettings,
  getEmailSettings,
  updateEmailSettings,
  testEmailSettings,
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getExternalApiSettings,
  updateExternalApiSettings,
  type SiteSettings,
  type SecuritySettings,
  type EmailSettings,
  type ExternalApiSettings,
  type ApiKey,
  type CreateApiKeyRequest,
} from '../services/settingsService';
import axios from 'axios';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const Settings: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Loading states
  const [loadingSite, setLoadingSite] = useState(false);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingExternalApis, setLoadingExternalApis] = useState(false);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // Form data
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    site_name: '',
    site_description: '',
    site_url: '',
    timezone: 'UTC',
    language: 'en',
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_special: false,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    require_2fa: false,
  });

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    email_provider: 'brevo',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_from_email: '',
    smtp_from_name: '',
    smtp_password: '',
    brevo_api_key: '',
    brevo_api_key_configured: false,
    brevo_from_email: '',
    brevo_from_name: '',
  });

  const [externalApiSettings, setExternalApiSettings] = useState<ExternalApiSettings>({
    google_maps_api_key: '',
    google_maps_api_key_configured: false,
    usps_api_key: '',
    usps_api_key_configured: false,
    census_gov_api_key: '',
    census_gov_api_key_configured: false,
  });

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // Dialog states
  const [showPassword, setShowPassword] = useState(false);
  const [showGoogleMapsKey, setShowGoogleMapsKey] = useState(false);
  const [showUspsKey, setShowUspsKey] = useState(false);
  const [showCensusKey, setShowCensusKey] = useState(false);
  const [createKeyDialogOpen, setCreateKeyDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState<CreateApiKeyRequest>({
    name: '',
    scopes: [],
    expires_at: undefined,
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreatedKeyDialog, setShowCreatedKeyDialog] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for race condition and memory leak prevention
  const isMountedRef = useRef(true);
  const siteSettingsAbortController = useRef<AbortController | null>(null);
  const securitySettingsAbortController = useRef<AbortController | null>(null);
  const emailSettingsAbortController = useRef<AbortController | null>(null);
  const externalApisAbortController = useRef<AbortController | null>(null);
  const apiKeysAbortController = useRef<AbortController | null>(null);

  // Loading state refs (synchronous checks to prevent race conditions)
  const loadingSiteRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;  // Reset to true on mount

    return () => {
      isMountedRef.current = false;

      // DON'T abort requests on unmount - let them complete naturally
      // The isMountedRef check in callbacks prevents state updates after unmount
      // Aborting here causes issues with React StrictMode double-mounting
    };
  }, []);

  // Snackbar helper
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // Safe integer parsing helper
  const parseIntSafe = (value: string, defaultValue = 0): number => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const loadSiteSettings = useCallback(async () => {
    // Prevent concurrent loads using ref (synchronous check)
    if (loadingSiteRef.current) {
      return;
    }

    // Mark as loading immediately
    loadingSiteRef.current = true;
    setLoadingSite(true);

    // Create new AbortController
    siteSettingsAbortController.current = new AbortController();

    try {
      const data = await getSiteSettings(siteSettingsAbortController.current.signal);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setSiteSettings(data);
      }
    } catch (error) {
      // Don't set error if request was aborted
      if (axios.isCancel(error)) {
        return;
      }

      if (isMountedRef.current) {
        showSnackbar('Failed to load site settings', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        loadingSiteRef.current = false;
        setLoadingSite(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnackbar]);

  const loadSecuritySettings = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingSecurity) {
      return;
    }

    // Cancel previous request if still running
    securitySettingsAbortController.current?.abort();

    // Create new AbortController
    securitySettingsAbortController.current = new AbortController();

    setLoadingSecurity(true);

    try {
      const data = await getSecuritySettings(securitySettingsAbortController.current.signal);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setSecuritySettings(data);
      }
    } catch (error) {
      // Don't set error if request was aborted
      if (axios.isCancel(error)) {
        console.log('Security settings request canceled');
        return;
      }

      if (isMountedRef.current) {
        showSnackbar('Failed to load security settings', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingSecurity(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnackbar]);

  const loadEmailSettings = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingEmail) {
      return;
    }

    // Cancel previous request if still running
    emailSettingsAbortController.current?.abort();

    // Create new AbortController
    emailSettingsAbortController.current = new AbortController();

    setLoadingEmail(true);

    try {
      const data = await getEmailSettings(emailSettingsAbortController.current.signal);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setEmailSettings(data);
      }
    } catch (error) {
      // Don't set error if request was aborted
      if (axios.isCancel(error)) {
        console.log('Email settings request canceled');
        return;
      }

      if (isMountedRef.current) {
        showSnackbar('Failed to load email settings', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingEmail(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnackbar]);

  const loadExternalApiSettings = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingExternalApis) {
      return;
    }

    // Cancel previous request if still running
    externalApisAbortController.current?.abort();

    // Create new AbortController
    externalApisAbortController.current = new AbortController();

    setLoadingExternalApis(true);

    try {
      const data = await getExternalApiSettings(externalApisAbortController.current.signal);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setExternalApiSettings(data);
      }
    } catch (error) {
      // Don't set error if request was aborted
      if (axios.isCancel(error)) {
        console.log('External API settings request canceled');
        return;
      }

      if (isMountedRef.current) {
        showSnackbar('Failed to load external API settings', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingExternalApis(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnackbar]);

  const loadApiKeys = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingApiKeys) {
      return;
    }

    // Cancel previous request if still running
    apiKeysAbortController.current?.abort();

    // Create new AbortController
    apiKeysAbortController.current = new AbortController();

    setLoadingApiKeys(true);

    try {
      const data = await getApiKeys(apiKeysAbortController.current.signal);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setApiKeys(data);
      }
    } catch (error) {
      // Don't set error if request was aborted
      if (axios.isCancel(error)) {
        console.log('API keys request canceled');
        return;
      }

      if (isMountedRef.current) {
        showSnackbar('Failed to load API keys', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingApiKeys(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnackbar]);

  // Load settings on mount and tab change
  useEffect(() => {
    // Track which tab this effect is for
    const currentTab = activeTab;

    // Load data for active tab
    if (currentTab === 0) {
      loadSiteSettings();
    } else if (currentTab === 1) {
      loadSecuritySettings();
    } else if (currentTab === 2) {
      loadEmailSettings();
    } else if (currentTab === 3) {
      loadExternalApiSettings();
    } else if (currentTab === 4) {
      loadApiKeys();
    }

    // Cleanup function - NO ABORT needed here
    // The loadingSiteRef guard prevents concurrent requests
    // Aborting here causes "request canceled" errors during re-renders
    return () => {
      // No cleanup needed - let requests complete naturally
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Validation functions
  const validateSiteSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!siteSettings.site_name || siteSettings.site_name.length < 1 || siteSettings.site_name.length > 100) {
      newErrors.site_name = 'Site name must be between 1 and 100 characters';
    }

    if (siteSettings.site_description && siteSettings.site_description.length > 500) {
      newErrors.site_description = 'Site description must not exceed 500 characters';
    }

    if (siteSettings.site_url && !isValidUrl(siteSettings.site_url)) {
      newErrors.site_url = 'Site URL must be a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSecuritySettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (securitySettings.password_min_length < 8 || securitySettings.password_min_length > 128) {
      newErrors.password_min_length = 'Password minimum length must be between 8 and 128';
    }

    if (securitySettings.session_timeout_minutes < 15 || securitySettings.session_timeout_minutes > 1440) {
      newErrors.session_timeout_minutes = 'Session timeout must be between 15 and 1440 minutes';
    }

    if (securitySettings.max_login_attempts < 3 || securitySettings.max_login_attempts > 10) {
      newErrors.max_login_attempts = 'Max login attempts must be between 3 and 10';
    }

    if (securitySettings.lockout_duration_minutes < 5 || securitySettings.lockout_duration_minutes > 60) {
      newErrors.lockout_duration_minutes = 'Lockout duration must be between 5 and 60 minutes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateEmailSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    const provider = emailSettings.email_provider || 'brevo';

    if (provider === 'smtp') {
      // SMTP validation
      if (!emailSettings.smtp_host) {
        newErrors.smtp_host = 'SMTP host is required';
      }

      if (emailSettings.smtp_port < 1 || emailSettings.smtp_port > 65535) {
        newErrors.smtp_port = 'SMTP port must be between 1 and 65535';
      }

      if (emailSettings.smtp_from_email && !isValidEmail(emailSettings.smtp_from_email)) {
        newErrors.smtp_from_email = 'From email must be a valid email address';
      }
    } else if (provider === 'brevo') {
      // Brevo validation
      if (emailSettings.brevo_from_email && !isValidEmail(emailSettings.brevo_from_email)) {
        newErrors.brevo_from_email = 'From email must be a valid email address';
      }

      // API key is optional for validation - user might just be updating from email/name
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Save handlers
  const handleSaveSiteSettings = async () => {
    if (!validateSiteSettings()) {return;}

    setSavingSettings(true);
    try {
      const updated = await updateSiteSettings(siteSettings);
      setSiteSettings(updated);
      showSnackbar('Site settings saved successfully', 'success');
      setErrors({});
    } catch (error) {
      showSnackbar('Failed to save site settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveSecuritySettings = async () => {
    if (!validateSecuritySettings()) {return;}

    setSavingSettings(true);
    try {
      const updated = await updateSecuritySettings(securitySettings);
      setSecuritySettings(updated);
      showSnackbar('Security settings saved successfully', 'success');
      setErrors({});
    } catch (error) {
      showSnackbar('Failed to save security settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!validateEmailSettings()) {return;}

    setSavingSettings(true);
    try {
      const updated = await updateEmailSettings(emailSettings);
      // Clear sensitive fields after save
      setEmailSettings({ ...updated, smtp_password: '', brevo_api_key: '' });
      showSnackbar('Email settings saved successfully', 'success');
      setErrors({});
    } catch (error) {
      showSnackbar('Failed to save email settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveExternalApiSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await updateExternalApiSettings(externalApiSettings);
      // Clear sensitive fields after save
      setExternalApiSettings({
        ...updated,
        google_maps_api_key: '',
        usps_api_key: '',
        census_gov_api_key: '',
      });
      showSnackbar('External API settings saved successfully', 'success');
      setErrors({});
    } catch (error) {
      showSnackbar('Failed to save external API settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const result = await testEmailSettings();
      showSnackbar(result.message, result.success ? 'success' : 'error');
    } catch (error) {
      showSnackbar('Failed to test email settings', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  // API Key handlers
  const handleCreateApiKey = async () => {
    if (!newKeyData.name || newKeyData.name.length < 3 || newKeyData.name.length > 100) {
      showSnackbar('API key name must be between 3 and 100 characters', 'error');
      return;
    }

    try {
      const result = await createApiKey(newKeyData);
      setCreatedKey(result.key);
      setShowCreatedKeyDialog(true);
      setCreateKeyDialogOpen(false);
      setNewKeyData({ name: '', scopes: [], expires_at: undefined });
      loadApiKeys();
      showSnackbar('API key created successfully', 'success');
    } catch (error) {
      showSnackbar('Failed to create API key', 'error');
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await revokeApiKey(id);
      loadApiKeys();
      showSnackbar('API key revoked successfully', 'success');
      setShowDeleteDialog(false);
      setDeleteKeyId(null);
    } catch (error) {
      showSnackbar('Failed to revoke API key', 'error');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    showSnackbar('API key copied to clipboard', 'success');
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setErrors({}); // Clear errors when changing tabs
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Configure your application settings and preferences.
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="settings tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Site Configuration" id="settings-tab-0" aria-controls="settings-tabpanel-0" />
          <Tab label="Security Settings" id="settings-tab-1" aria-controls="settings-tabpanel-1" />
          <Tab label="Email Settings" id="settings-tab-2" aria-controls="settings-tabpanel-2" />
          <Tab label="External APIs" id="settings-tab-3" aria-controls="settings-tabpanel-3" />
          <Tab label="API Keys" id="settings-tab-4" aria-controls="settings-tabpanel-4" />
        </Tabs>

        {/* Site Configuration Tab */}
        <TabPanel value={activeTab} index={0}>
          {loadingSite ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Site Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure basic site information and settings
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Site Name"
                    fullWidth
                    value={siteSettings.site_name}
                    onChange={(e) => setSiteSettings({ ...siteSettings, site_name: e.target.value })}
                    error={!!errors.site_name}
                    helperText={errors.site_name || 'The name of your site (1-100 characters)'}
                    required
                  />

                  <TextField
                    label="Site Description"
                    fullWidth
                    multiline
                    rows={3}
                    value={siteSettings.site_description}
                    onChange={(e) => setSiteSettings({ ...siteSettings, site_description: e.target.value })}
                    error={!!errors.site_description}
                    helperText={errors.site_description || 'A brief description of your site (max 500 characters)'}
                  />

                  <TextField
                    label="Site URL"
                    fullWidth
                    value={siteSettings.site_url}
                    onChange={(e) => setSiteSettings({ ...siteSettings, site_url: e.target.value })}
                    error={!!errors.site_url}
                    helperText={errors.site_url || 'The public URL where your site is accessible'}
                    placeholder="https://example.com"
                  />

                  <TextField
                    label="Timezone"
                    fullWidth
                    value={siteSettings.timezone}
                    onChange={(e) => setSiteSettings({ ...siteSettings, timezone: e.target.value })}
                    helperText="Timezone for date/time display (e.g., UTC, America/New_York)"
                  />

                  <TextField
                    label="Language"
                    fullWidth
                    value={siteSettings.language}
                    onChange={(e) => setSiteSettings({ ...siteSettings, language: e.target.value })}
                    helperText="Default language code (e.g., en, es, fr)"
                  />

                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={savingSettings ? <CircularProgress size={20} /> : <SaveIcon />}
                      onClick={handleSaveSiteSettings}
                      disabled={savingSettings}
                    >
                      Save Changes
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* Security Settings Tab */}
        <TabPanel value={activeTab} index={1}>
          {loadingSecurity ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Security Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure password policies and authentication settings
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Password Requirements
                    </Typography>
                    <TextField
                      label="Minimum Length"
                      type="number"
                      fullWidth
                      value={securitySettings.password_min_length}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, password_min_length: parseIntSafe(e.target.value, 8) })}
                      error={!!errors.password_min_length}
                      helperText={errors.password_min_length || 'Minimum password length (8-128 characters)'}
                      InputProps={{ inputProps: { min: 8, max: 128 } }}
                    />

                    <FormGroup sx={{ mt: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={securitySettings.password_require_uppercase}
                            onChange={(e) => setSecuritySettings({ ...securitySettings, password_require_uppercase: e.target.checked })}
                          />
                        }
                        label="Require uppercase letters"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={securitySettings.password_require_lowercase}
                            onChange={(e) => setSecuritySettings({ ...securitySettings, password_require_lowercase: e.target.checked })}
                          />
                        }
                        label="Require lowercase letters"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={securitySettings.password_require_numbers}
                            onChange={(e) => setSecuritySettings({ ...securitySettings, password_require_numbers: e.target.checked })}
                          />
                        }
                        label="Require numbers"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={securitySettings.password_require_special}
                            onChange={(e) => setSecuritySettings({ ...securitySettings, password_require_special: e.target.checked })}
                          />
                        }
                        label="Require special characters"
                      />
                    </FormGroup>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Session & Login Settings
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Session Timeout (minutes)"
                        type="number"
                        fullWidth
                        value={securitySettings.session_timeout_minutes}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, session_timeout_minutes: parseIntSafe(e.target.value, 30) })}
                        error={!!errors.session_timeout_minutes}
                        helperText={errors.session_timeout_minutes || 'User session timeout in minutes (15-1440)'}
                        InputProps={{ inputProps: { min: 15, max: 1440 } }}
                      />

                      <TextField
                        label="Max Login Attempts"
                        type="number"
                        fullWidth
                        value={securitySettings.max_login_attempts}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, max_login_attempts: parseIntSafe(e.target.value, 5) })}
                        error={!!errors.max_login_attempts}
                        helperText={errors.max_login_attempts || 'Maximum failed login attempts before lockout (3-10)'}
                        InputProps={{ inputProps: { min: 3, max: 10 } }}
                      />

                      <TextField
                        label="Lockout Duration (minutes)"
                        type="number"
                        fullWidth
                        value={securitySettings.lockout_duration_minutes}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, lockout_duration_minutes: parseIntSafe(e.target.value, 15) })}
                        error={!!errors.lockout_duration_minutes}
                        helperText={errors.lockout_duration_minutes || 'Account lockout duration in minutes (5-60)'}
                        InputProps={{ inputProps: { min: 5, max: 60 } }}
                      />
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Two-Factor Authentication
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={securitySettings.require_2fa}
                          onChange={(e) => setSecuritySettings({ ...securitySettings, require_2fa: e.target.checked })}
                        />
                      }
                      label="Require 2FA for all users"
                    />
                    {securitySettings.require_2fa && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        2FA enforcement is enabled but the 2FA system is not yet fully implemented. This setting is for future use.
                      </Alert>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={savingSettings ? <CircularProgress size={20} /> : <SaveIcon />}
                      onClick={handleSaveSecuritySettings}
                      disabled={savingSettings}
                    >
                      Save Changes
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* Email Settings Tab */}
        <TabPanel value={activeTab} index={2}>
          {loadingEmail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Email Settings
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure email provider settings for sending emails
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Email Provider Selection */}
                  <FormControl fullWidth>
                    <Typography variant="subtitle2" gutterBottom>
                      Email Provider
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={(emailSettings.email_provider || 'brevo') === 'brevo'}
                            onChange={(e) => setEmailSettings({
                              ...emailSettings,
                              email_provider: e.target.checked ? 'brevo' : 'smtp'
                            })}
                          />
                        }
                        label={(emailSettings.email_provider || 'brevo') === 'brevo' ? 'Brevo (Recommended)' : 'SMTP'}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {(emailSettings.email_provider || 'brevo') === 'brevo'
                        ? 'Using Brevo transactional email service'
                        : 'Using custom SMTP server'}
                    </Typography>
                  </FormControl>

                  {/* Brevo Settings */}
                  {(emailSettings.email_provider || 'brevo') === 'brevo' && (
                    <>
                      <Alert severity="info" sx={{ mt: 1 }}>
                        Brevo provides reliable transactional email delivery. Get your API key from{' '}
                        <a href="https://app.brevo.com" target="_blank" rel="noopener noreferrer">
                          app.brevo.com
                        </a>
                      </Alert>

                      <TextField
                        label="Brevo API Key"
                        fullWidth
                        type={showPassword ? 'text' : 'password'}
                        value={emailSettings.brevo_api_key || ''}
                        onChange={(e) => setEmailSettings({ ...emailSettings, brevo_api_key: e.target.value })}
                        helperText={
                          emailSettings.brevo_api_key_configured
                            ? 'API key is configured. Leave blank to keep existing key, or enter new key to update.'
                            : 'Enter your Brevo API key'
                        }
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                aria-label="toggle api key visibility"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />

                      {emailSettings.brevo_api_key_configured && (
                        <Chip
                          label="API Key Configured"
                          color="success"
                          size="small"
                          sx={{ alignSelf: 'flex-start' }}
                        />
                      )}

                      <TextField
                        label="From Email"
                        fullWidth
                        value={emailSettings.brevo_from_email || ''}
                        onChange={(e) => setEmailSettings({ ...emailSettings, brevo_from_email: e.target.value })}
                        error={!!errors.brevo_from_email}
                        helperText={errors.brevo_from_email || 'Email address to send from'}
                        placeholder="noreply@example.com"
                      />

                      <TextField
                        label="From Name"
                        fullWidth
                        value={emailSettings.brevo_from_name || ''}
                        onChange={(e) => setEmailSettings({ ...emailSettings, brevo_from_name: e.target.value })}
                        helperText="Display name for outgoing emails"
                      />
                    </>
                  )}

                  {/* SMTP Settings */}
                  {emailSettings.email_provider === 'smtp' && (
                    <>
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        SMTP configuration requires valid server credentials. Brevo is recommended for most users.
                      </Alert>

                      <TextField
                        label="SMTP Host"
                        fullWidth
                        value={emailSettings.smtp_host}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                        error={!!errors.smtp_host}
                        helperText={errors.smtp_host || 'SMTP server hostname'}
                        required
                      />

                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          label="SMTP Port"
                          type="number"
                          value={emailSettings.smtp_port}
                          onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseIntSafe(e.target.value, 587) })}
                          error={!!errors.smtp_port}
                          helperText={errors.smtp_port || 'Port number (e.g., 587)'}
                          InputProps={{ inputProps: { min: 1, max: 65535 } }}
                          sx={{ flex: 1 }}
                        />

                        <FormControl sx={{ flex: 1, mt: 1 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emailSettings.smtp_secure}
                                onChange={(e) => setEmailSettings({ ...emailSettings, smtp_secure: e.target.checked })}
                              />
                            }
                            label="Use SSL/TLS"
                          />
                        </FormControl>
                      </Box>

                      <TextField
                        label="SMTP User"
                        fullWidth
                        value={emailSettings.smtp_user}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })}
                        helperText="SMTP authentication username"
                      />

                      <TextField
                        label="SMTP Password"
                        fullWidth
                        type={showPassword ? 'text' : 'password'}
                        value={emailSettings.smtp_password}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })}
                        helperText="Leave blank to keep existing password"
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                aria-label="toggle password visibility"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />

                      <TextField
                        label="From Email"
                        fullWidth
                        value={emailSettings.smtp_from_email}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_from_email: e.target.value })}
                        error={!!errors.smtp_from_email}
                        helperText={errors.smtp_from_email || 'Email address to send from'}
                        placeholder="noreply@example.com"
                      />

                      <TextField
                        label="From Name"
                        fullWidth
                        value={emailSettings.smtp_from_name}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_from_name: e.target.value })}
                        helperText="Display name for outgoing emails"
                      />
                    </>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={savingSettings ? <CircularProgress size={20} /> : <SaveIcon />}
                      onClick={handleSaveEmailSettings}
                      disabled={savingSettings}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={testingEmail ? <CircularProgress size={20} /> : <TestIcon />}
                      onClick={handleTestEmail}
                      disabled={testingEmail}
                    >
                      Test Email
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* External APIs Tab */}
        <TabPanel value={activeTab} index={3}>
          {loadingExternalApis ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  External API Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure API keys for external services
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Google Maps API Key"
                    fullWidth
                    type={showGoogleMapsKey ? 'text' : 'password'}
                    value={externalApiSettings.google_maps_api_key || ''}
                    onChange={(e) => setExternalApiSettings({ ...externalApiSettings, google_maps_api_key: e.target.value })}
                    helperText={
                      externalApiSettings.google_maps_api_key_configured
                        ? 'API key is configured. Leave blank to keep existing key, or enter new key to update.'
                        : 'Enter your Google Maps API key'
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle google maps key visibility"
                            onClick={() => setShowGoogleMapsKey(!showGoogleMapsKey)}
                            edge="end"
                          >
                            {showGoogleMapsKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  {externalApiSettings.google_maps_api_key_configured && (
                    <Chip
                      label="Google Maps API Key Configured"
                      color="success"
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  )}

                  <TextField
                    label="USPS API Key"
                    fullWidth
                    type={showUspsKey ? 'text' : 'password'}
                    value={externalApiSettings.usps_api_key || ''}
                    onChange={(e) => setExternalApiSettings({ ...externalApiSettings, usps_api_key: e.target.value })}
                    helperText={
                      externalApiSettings.usps_api_key_configured
                        ? 'API key is configured. Leave blank to keep existing key, or enter new key to update.'
                        : 'Enter your USPS API key'
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle usps key visibility"
                            onClick={() => setShowUspsKey(!showUspsKey)}
                            edge="end"
                          >
                            {showUspsKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  {externalApiSettings.usps_api_key_configured && (
                    <Chip
                      label="USPS API Key Configured"
                      color="success"
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  )}

                  <TextField
                    label="Census.gov API Key"
                    fullWidth
                    type={showCensusKey ? 'text' : 'password'}
                    value={externalApiSettings.census_gov_api_key || ''}
                    onChange={(e) => setExternalApiSettings({ ...externalApiSettings, census_gov_api_key: e.target.value })}
                    helperText={
                      externalApiSettings.census_gov_api_key_configured
                        ? 'API key is configured. Leave blank to keep existing key, or enter new key to update.'
                        : 'Enter your Census.gov API key'
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle census key visibility"
                            onClick={() => setShowCensusKey(!showCensusKey)}
                            edge="end"
                          >
                            {showCensusKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  {externalApiSettings.census_gov_api_key_configured && (
                    <Chip
                      label="Census.gov API Key Configured"
                      color="success"
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={savingSettings ? <CircularProgress size={20} /> : <SaveIcon />}
                      onClick={handleSaveExternalApiSettings}
                      disabled={savingSettings}
                    >
                      Save Changes
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* API Keys Tab */}
        <TabPanel value={activeTab} index={4}>
          {loadingApiKeys ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      API Keys
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage API keys for external integrations
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateKeyDialogOpen(true)}
                  >
                    Create API Key
                  </Button>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Key Prefix</TableCell>
                        <TableCell>Scopes</TableCell>
                        <TableCell>Last Used</TableCell>
                        <TableCell>Expires</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apiKeys.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No API keys created yet. Create one to get started.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        apiKeys.map((key) => (
                          <TableRow key={key.id}>
                            <TableCell>{key.name}</TableCell>
                            <TableCell>
                              <Box component="span" sx={{ fontFamily: 'monospace' }}>
                                {key.key_prefix}...
                              </Box>
                            </TableCell>
                            <TableCell>
                              {key.scopes.length > 0 ? (
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {key.scopes.map((scope) => (
                                    <Chip key={scope} label={scope} size="small" />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No scopes
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {key.last_used_at
                                ? new Date(key.last_used_at).toLocaleDateString()
                                : 'Never'}
                            </TableCell>
                            <TableCell>
                              {key.expires_at
                                ? new Date(key.expires_at).toLocaleDateString()
                                : 'Never'}
                            </TableCell>
                            <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                            <TableCell align="right">
                              <Tooltip title="Revoke">
                                <IconButton
                                  onClick={() => {
                                    setDeleteKeyId(key.id);
                                    setShowDeleteDialog(true);
                                  }}
                                  color="error"
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </TabPanel>
      </Paper>

      {/* Create API Key Dialog */}
      <Dialog open={createKeyDialogOpen} onClose={() => setCreateKeyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={newKeyData.name}
              onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
              helperText="A descriptive name for this API key (3-100 characters)"
              required
            />

            <TextField
              label="Scopes"
              fullWidth
              value={newKeyData.scopes?.join(', ') || ''}
              onChange={(e) => setNewKeyData({ ...newKeyData, scopes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              helperText="Comma-separated list of scopes (e.g., read, write, admin)"
            />

            <TextField
              label="Expires At"
              type="datetime-local"
              fullWidth
              value={newKeyData.expires_at || ''}
              onChange={(e) => setNewKeyData({ ...newKeyData, expires_at: e.target.value || undefined })}
              helperText="Leave blank for no expiration"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateKeyDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateApiKey}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Show Created Key Dialog */}
      <Dialog open={showCreatedKeyDialog} onClose={() => setShowCreatedKeyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>API Key Created</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is the only time you will see this key. Please copy it and store it securely.
          </Alert>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Box
              component="code"
              sx={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                overflowX: 'auto',
                wordBreak: 'break-all',
              }}
            >
              {createdKey}
            </Box>
            <IconButton onClick={() => createdKey && handleCopyKey(createdKey)} color="primary">
              <CopyIcon />
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setShowCreatedKeyDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete API Key Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Revoke API Key</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke this API key? This action cannot be undone and any applications using this key will lose access.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteKeyId && handleRevokeApiKey(deleteKeyId)}
          >
            Revoke
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
