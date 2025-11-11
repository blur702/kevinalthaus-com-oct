import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Paper,
  Slider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Palette as PaletteIcon,
  TextFields as TextFieldsIcon,
  Category as CategoryIcon,
  Code as CodeIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { ChromePicker, ColorResult } from 'react-color';
import { getThemeConfig, saveTheme, resetTheme } from '../services/themeService';

interface ThemeEditorProps {
  target: 'admin' | 'frontend';
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          onClick={() => setShowPicker(!showPicker)}
          sx={{
            width: 60,
            height: 36,
            backgroundColor: value,
            border: '2px solid',
            borderColor: 'divider',
            borderRadius: 1,
            cursor: 'pointer',
          }}
        />
        <TextField
          size="small"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 120 }}
        />
      </Box>
      {showPicker && (
        <Box sx={{ position: 'relative', zIndex: 2, mt: 1 }}>
          <Box
            sx={{ position: 'fixed', inset: 0 }}
            onClick={() => setShowPicker(false)}
          />
          <Box sx={{ position: 'absolute' }}>
            <ChromePicker
              color={value}
              onChange={(color: ColorResult) => onChange(color.hex)}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const ThemeEditor: React.FC<ThemeEditorProps> = ({ target }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    palette: {
      mode: 'light',
      primary: { main: '#2563eb', light: '#60a5fa', dark: '#1d4ed8' },
      secondary: { main: '#7c3aed', light: '#a78bfa', dark: '#5b21b6' },
      error: { main: '#dc2626' },
      warning: { main: '#d97706' },
      info: { main: '#0284c7' },
      success: { main: '#059669' },
      background: { default: '#f8fafc', paper: '#ffffff' },
      text: { primary: '#0f172a', secondary: '#475569', disabled: '#94a3b8' },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2 },
      h2: { fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.3 },
      h3: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },
      h4: { fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.4 },
      h5: { fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.4 },
      h6: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
      body1: { fontSize: '0.875rem', lineHeight: 1.5 },
      body2: { fontSize: '0.75rem', lineHeight: 1.4 },
    },
    spacing: 4,
    shape: { borderRadius: 6 },
    customCSS: '',
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    setLoading(true);
    try {
      const data = await getThemeConfig();
      if (Object.keys(data).length > 0) {
        setConfig({ ...config, ...data });
      }
    } catch (error) {
      setMessageType('error');
      setMessage('Failed to load theme configuration');
    } finally {
      setLoading(false);
    }
  };

  const generateCSS = (cfg: any): string => {
    let css = `/* ${target === 'admin' ? 'Admin Panel' : 'Frontend'} Theme Overrides - Auto-generated */\n\n`;

    // CSS Variables
    css += ':root {\n';
    if (cfg.palette?.primary?.main) css += `  --primary-color: ${cfg.palette.primary.main};\n`;
    if (cfg.palette?.secondary?.main) css += `  --secondary-color: ${cfg.palette.secondary.main};\n`;
    if (cfg.palette?.background?.default) css += `  --background-default: ${cfg.palette.background.default};\n`;
    if (cfg.palette?.background?.paper) css += `  --background-paper: ${cfg.palette.background.paper};\n`;
    if (cfg.palette?.text?.primary) css += `  --text-primary: ${cfg.palette.text.primary};\n`;
    if (cfg.palette?.text?.secondary) css += `  --text-secondary: ${cfg.palette.text.secondary};\n`;
    if (cfg.typography?.fontFamily) css += `  --font-family: ${cfg.typography.fontFamily};\n`;
    css += '}\n\n';

    // MUI Component Overrides
    if (cfg.palette?.primary?.main) {
      css += `.MuiButton-containedPrimary {\n  background-color: ${cfg.palette.primary.main} !important;\n}\n\n`;
    }

    if (cfg.palette?.background?.paper) {
      css += `.MuiPaper-root {\n  background-color: ${cfg.palette.background.paper} !important;\n}\n\n`;
    }

    if (cfg.palette?.background?.default) {
      css += `body {\n  background-color: ${cfg.palette.background.default} !important;\n}\n\n`;
    }

    // Custom CSS
    if (cfg.customCSS) {
      css += `/* Custom CSS */\n${cfg.customCSS}\n`;
    }

    return css;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const css = generateCSS(config);

      await saveTheme({
        target,
        config,
        css,
      });

      setMessageType('success');
      setMessage('Theme saved successfully! Refresh the page to see changes.');
    } catch (error) {
      setMessageType('error');
      setMessage('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset theme to defaults? This cannot be undone.')) return;

    try {
      await resetTheme({ target });
      await loadTheme();
      setMessageType('success');
      setMessage('Theme reset successfully! Refresh the page to see changes.');
    } catch (error) {
      setMessageType('error');
      setMessage('Failed to reset theme');
    }
  };

  const updatePalette = (path: string, value: string) => {
    const keys = path.split('.');
    const newConfig = { ...config };
    let current: any = newConfig.palette;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setConfig(newConfig);
  };

  const updateTypography = (element: string, property: string, value: any) => {
    setConfig({
      ...config,
      typography: {
        ...config.typography,
        [element]: {
          ...config.typography[element],
          [property]: value,
        },
      },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Customize {target === 'admin' ? 'Admin Panel' : 'Frontend'} Appearance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Customize colors, typography, and component styles. Changes will override the default Material-UI theme.
            </Typography>
          </Box>
          <Box>
            <Button
              startIcon={<RefreshIcon />}
              onClick={handleReset}
              sx={{ mr: 1 }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Colors Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <PaletteIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Colors</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Theme Mode
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Mode</InputLabel>
                <Select
                  value={config.palette?.mode || 'light'}
                  label="Mode"
                  onChange={(e) => updatePalette('mode', e.target.value)}
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Primary Colors
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Primary Main"
                value={config.palette?.primary?.main || '#2563eb'}
                onChange={(color) => updatePalette('primary.main', color)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Primary Light"
                value={config.palette?.primary?.light || '#60a5fa'}
                onChange={(color) => updatePalette('primary.light', color)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Primary Dark"
                value={config.palette?.primary?.dark || '#1d4ed8'}
                onChange={(color) => updatePalette('primary.dark', color)}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Secondary Colors
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Secondary Main"
                value={config.palette?.secondary?.main || '#7c3aed'}
                onChange={(color) => updatePalette('secondary.main', color)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Secondary Light"
                value={config.palette?.secondary?.light || '#a78bfa'}
                onChange={(color) => updatePalette('secondary.light', color)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Secondary Dark"
                value={config.palette?.secondary?.dark || '#5b21b6'}
                onChange={(color) => updatePalette('secondary.dark', color)}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Status Colors
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <ColorPicker
                label="Error"
                value={config.palette?.error?.main || '#dc2626'}
                onChange={(color) => updatePalette('error.main', color)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <ColorPicker
                label="Warning"
                value={config.palette?.warning?.main || '#d97706'}
                onChange={(color) => updatePalette('warning.main', color)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <ColorPicker
                label="Info"
                value={config.palette?.info?.main || '#0284c7'}
                onChange={(color) => updatePalette('info.main', color)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <ColorPicker
                label="Success"
                value={config.palette?.success?.main || '#059669'}
                onChange={(color) => updatePalette('success.main', color)}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Background & Text
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <ColorPicker
                label="Background Default"
                value={config.palette?.background?.default || '#f8fafc'}
                onChange={(color) => updatePalette('background.default', color)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ColorPicker
                label="Background Paper"
                value={config.palette?.background?.paper || '#ffffff'}
                onChange={(color) => updatePalette('background.paper', color)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Text Primary"
                value={config.palette?.text?.primary || '#0f172a'}
                onChange={(color) => updatePalette('text.primary', color)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Text Secondary"
                value={config.palette?.text?.secondary || '#475569'}
                onChange={(color) => updatePalette('text.secondary', color)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ColorPicker
                label="Text Disabled"
                value={config.palette?.text?.disabled || '#94a3b8'}
                onChange={(color) => updatePalette('text.disabled', color)}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Typography Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TextFieldsIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Typography</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Font Family"
                value={config.typography?.fontFamily || ''}
                onChange={(e) =>
                  setConfig({ ...config, typography: { ...config.typography, fontFamily: e.target.value } })
                }
                helperText='e.g., "Inter", "Roboto", "Helvetica", sans-serif'
              />
            </Grid>

            {['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2'].map((element) => (
              <Grid item xs={12} key={element}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" gutterBottom fontWeight={600} textTransform="uppercase">
                  {element}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Font Size"
                      value={config.typography?.[element]?.fontSize || ''}
                      onChange={(e) => updateTypography(element, 'fontSize', e.target.value)}
                      helperText="e.g., 1.5rem, 24px"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Font Weight"
                      value={config.typography?.[element]?.fontWeight || ''}
                      onChange={(e) => updateTypography(element, 'fontWeight', parseInt(e.target.value))}
                      helperText="100-900"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Line Height"
                      value={config.typography?.[element]?.lineHeight || ''}
                      onChange={(e) => updateTypography(element, 'lineHeight', parseFloat(e.target.value))}
                      helperText="e.g., 1.5"
                      inputProps={{ step: 0.1 }}
                    />
                  </Grid>
                </Grid>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Spacing & Shape Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <CategoryIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Spacing & Shape</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Spacing Unit: {config.spacing || 4}px</Typography>
              <Slider
                value={config.spacing || 4}
                onChange={(e, value) => setConfig({ ...config, spacing: value })}
                min={2}
                max={12}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Base spacing unit used throughout the app
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Border Radius: {config.shape?.borderRadius || 6}px</Typography>
              <Slider
                value={config.shape?.borderRadius || 6}
                onChange={(e, value) =>
                  setConfig({ ...config, shape: { ...config.shape, borderRadius: value } })
                }
                min={0}
                max={24}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Default border radius for components
              </Typography>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Custom CSS Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <CodeIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Custom CSS</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            multiline
            rows={12}
            label="Custom CSS"
            value={config.customCSS || ''}
            onChange={(e) => setConfig({ ...config, customCSS: e.target.value })}
            helperText="Add custom CSS to override any styles. This CSS will be loaded last."
            placeholder="/* Your custom CSS here */&#10;.my-custom-class {&#10;  color: #ff0000;&#10;}"
            sx={{
              '& textarea': {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              },
            }}
          />
        </AccordionDetails>
      </Accordion>

      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage('')}
      >
        <Alert onClose={() => setMessage('')} severity={messageType} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
