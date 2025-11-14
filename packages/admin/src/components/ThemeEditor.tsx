import React, { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
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
import type { SelectChangeEvent } from '@mui/material/Select';
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
import type {
  PaletteModeOption,
  ThemeConfig,
  TypographyScale,
  TypographyVariant,
} from '../services/themeService';

interface ThemeEditorProps {
  target: 'admin' | 'frontend';
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}
// Define types for easier access to nested theme properties. 
type ThemePalette = NonNullable<ThemeConfig['palette']>;
type PaletteSectionKey = Exclude<keyof ThemePalette, 'mode'>;
type PaletteShade = 'main' | 'light' | 'dark' | 'default' | 'paper' | 'primary' | 'secondary' | 'disabled';
type PalettePath = 'mode' | `${PaletteSectionKey}.${PaletteShade}`;
type TypographyProperty = keyof TypographyScale;

const typographyElements: TypographyVariant[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2'];

const defaultThemeConfig: ThemeConfig = {
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
};

const ensureSectionRecord = (
  section: ThemePalette[PaletteSectionKey] | undefined,
): Record<string, string | undefined> =>
  section && typeof section === 'object' ? { ...section } : {};

/**
 * Renders a labeled color picker control for a single theme token.
 * Returns a controlled React element that emits the selected color value.
 */
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

/**
 * Provides the full theme editing experience for the requested target surface.
 * Returns the interactive editor UI so administrators can view and adjust tokens.
 */
export const ThemeEditor: React.FC<ThemeEditorProps> = ({ target }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ThemeConfig>(defaultThemeConfig);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    void loadTheme();
  }, []);

  /**
   * Loads the saved theme configuration from the API into local state.
   * Returns a Promise that resolves after state has been updated.
   */
  const loadTheme = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await getThemeConfig();
      if (Object.keys(data).length > 0) {
        setConfig((prev) => ({ ...prev, ...data }));
      }
    } catch (error) {
      setMessageType('error');
      setMessage('Failed to load theme configuration');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Converts a theme configuration object into distributable CSS overrides.
   * Returns a string containing the CSS bundle for the current target.
   */
  const generateCSS = (cfg: ThemeConfig): string => {
    const palette = cfg.palette ?? {};
    const typography = cfg.typography ?? {};
    let css = `/* ${target === 'admin' ? 'Admin Panel' : 'Frontend'} Theme Overrides - Auto-generated */\n\n`;

    // Define CSS variable overrides
    css += ':root {\n';
    if (palette.primary?.main) {css += `  --primary-color: ${palette.primary.main};\n`;}
    if (palette.secondary?.main) {css += `  --secondary-color: ${palette.secondary.main};\n`;}
    if (palette.background?.default) {css += `  --background-default: ${palette.background.default};\n`;}
    if (palette.background?.paper) {css += `  --background-paper: ${palette.background.paper};\n`;}
    if (palette.text?.primary) {css += `  --text-primary: ${palette.text.primary};\n`;}
    if (palette.text?.secondary) {css += `  --text-secondary: ${palette.text.secondary};\n`;}
    if (typography.fontFamily) {css += `  --font-family: ${typography.fontFamily};\n`;}
    css += '}\n\n';

    // Apply key MUI component overrides
    if (palette.primary?.main) {
      css += `.MuiButton-containedPrimary {\n  background-color: ${palette.primary.main} !important;\n}\n\n`;
    }

    if (palette.background?.paper) {
      css += `.MuiPaper-root {\n  background-color: ${palette.background.paper} !important;\n}\n\n`;
    }

    if (palette.background?.default) {
      css += `body {\n  background-color: ${palette.background.default} !important;\n}\n\n`;
    }

    // Append any custom CSS provided by the user
    if (cfg.customCSS) {
      css += `/* Custom CSS overrides */\n${cfg.customCSS}\n`;
    }

    return css;
  };

  /**
   * Persists the current theme to the backend and publishes the generated CSS.
   * Returns a Promise that resolves when the save request completes.
   */
  const handleSave = async (): Promise<void> => {
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

  /**
   * Restores the default theme configuration for the active target.
   * Returns a Promise that resolves after the reset API call finishes.
   */
  const handleReset = async (): Promise<void> => {
    if (!window.confirm('Reset theme to defaults? This cannot be undone.')) {return;}

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

  /**
   * Updates a nested palette path with a new color token.
   * Returns void after updating local state immutably.
   */
  const updatePalette = (path: PalettePath, value: string): void => {
    if (path === 'mode') {
      const nextMode: PaletteModeOption = value === 'dark' ? 'dark' : 'light';
      setConfig((prev) => ({
        ...prev,
        palette: {
          ...(prev.palette ?? {}),
          mode: nextMode,
        },
      }));
      return;
    }

    // Validate path format
    if (!path || typeof path !== 'string') {
      console.error('Invalid path: must be a non-empty string', path);
      return;
    }

    const parts = path.split('.');
    if (parts.length !== 2) {
      console.error('Invalid path format: expected exactly one dot', path);
      return;
    }

    const [section, shade] = parts;
    if (!section || !shade) {
      console.error('Invalid path: section and shade must be non-empty', path);
      return;
    }

    // Type assertion after validation
    const validSection = section as PaletteSectionKey;
    const validShade = shade as PaletteShade;

    setConfig((prev) => {
      const palette: ThemePalette = prev.palette ?? {};
      const normalizedSection = ensureSectionRecord(palette[validSection]);
      const nextSection = {
        ...normalizedSection,
        [validShade]: value,
      } as ThemePalette[PaletteSectionKey];

      return {
        ...prev,
        palette: {
          ...palette,
          [validSection]: nextSection,
        },
      };
    });
  };

  /**
   * Updates a single typography property (e.g., fontSize) for the given element.
   * Returns void after merging the change into the current config state.
   */
  const updateTypography = (
    element: TypographyVariant,
    property: TypographyProperty,
    value: TypographyScale[TypographyProperty],
  ): void => {
    setConfig((prev) => {
      const prevTypography = prev.typography ?? {};
      const elementSettings: TypographyScale = prevTypography[element] ?? {};
      const nextElementSettings: TypographyScale = {
        ...elementSettings,
        [property]: value,
      };

      return {
        ...prev,
        typography: {
          ...prevTypography,
          [element]: nextElementSettings,
        },
      };
    });
  };

  const handleSpacingChange = (_: Event, value: number | number[]): void => {
    setConfig((prev) => ({
      ...prev,
      spacing: typeof value === 'number' ? value : prev.spacing ?? 4,
    }));
  };

  const handleBorderRadiusChange = (_: Event, value: number | number[]): void => {
    setConfig((prev) => ({
      ...prev,
      shape: {
        ...(prev.shape ?? {}),
        borderRadius: typeof value === 'number' ? value : prev.shape?.borderRadius ?? 6,
      },
    }));
  };

  const handleFontFamilyChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value } = event.target;
    setConfig((prev) => ({
      ...prev,
      typography: {
        ...(prev.typography ?? {}),
        fontFamily: value,
      },
    }));
  };

  const handleCustomCssChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    const { value } = event.target;
    setConfig((prev) => ({
      ...prev,
      customCSS: value,
    }));
  };

  const handleModeChange = (event: SelectChangeEvent<PaletteModeOption>): void => {
    updatePalette('mode', event.target.value);
  };

  const handleSaveClick = (): void => {
    void handleSave();
  };

  const handleResetClick = (): void => {
    void handleReset();
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
              onClick={handleResetClick}
              sx={{ mr: 1 }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveClick}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Colors section */}
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
                  value={config.palette?.mode ?? 'light'}
                  label="Mode"
                  onChange={handleModeChange}
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

      {/* Typography section */}
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
                value={config.typography?.fontFamily ?? ''}
                onChange={handleFontFamilyChange}
                helperText='e.g., "Inter", "Roboto", "Helvetica", sans-serif'
              />
            </Grid>

            {typographyElements.map((element) => (
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
                      value={config.typography?.[element]?.fontSize ?? ''}
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
                      value={config.typography?.[element]?.fontWeight ?? ''}
                      onChange={(e) => {
                        const trimmed = e.target.value.trim();
                        if (!trimmed) {
                          updateTypography(element, 'fontWeight', undefined);
                          return;
                        }
                        const parsed = parseInt(trimmed, 10);
                        updateTypography(
                          element,
                          'fontWeight',
                          Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : undefined
                        );
                      }}
                      helperText="100-900"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Line Height"
                      value={config.typography?.[element]?.lineHeight ?? ''}
                      onChange={(e) =>
                        updateTypography(
                          element,
                          'lineHeight',
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
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

      {/* Spacing & shape section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <CategoryIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Spacing & Shape</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Spacing Unit: {config.spacing ?? 4}px</Typography>
              <Slider
                value={config.spacing ?? 4}
                onChange={handleSpacingChange}
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
              <Typography gutterBottom>Border Radius: {config.shape?.borderRadius ?? 6}px</Typography>
              <Slider
                value={config.shape?.borderRadius ?? 6}
                onChange={handleBorderRadiusChange}
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

      {/* Custom CSS section */}
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
            value={config.customCSS ?? ''}
            onChange={handleCustomCssChange}
            helperText="Add custom CSS to override any styles. This CSS will be loaded last."
            placeholder="/* Add custom CSS overrides here */&#10;.my-custom-class {&#10;  color: #ff0000;&#10;}"
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
