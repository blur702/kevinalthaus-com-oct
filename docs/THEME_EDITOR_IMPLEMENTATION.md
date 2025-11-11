# Theme Editor Implementation Guide

## Overview
This document describes the theme customization system that has been partially implemented. The system allows admins to customize the look and feel of both the admin panel and frontend by modifying Material-UI theme properties and generating CSS overrides.

## What's Been Completed

### Backend (✅ Complete)
1. **Theme API Routes** (`packages/main-app/src/routes/themes.ts`)
   - `GET /api/themes/config` - Get current theme configuration
   - `POST /api/themes/save` - Save theme configuration and CSS
   - `POST /api/themes/reset` - Reset theme to defaults

2. **Route Registration** (`packages/main-app/src/index.ts`)
   - Theme routes registered at `/api/themes`

3. **Frontend Service** (`packages/admin/src/services/themeService.ts`)
   - TypeScript service for API calls

## What Needs to Be Built

### Theme Editor Component
Create `packages/admin/src/components/ThemeEditor.tsx` with these features:

#### Categories of Customizable Elements

1. **Colors** (Material-UI Palette)
   - Primary Color (main, light, dark)
   - Secondary Color (main, light, dark)
   - Error, Warning, Info, Success colors
   - Background colors (default, paper)
   - Text colors (primary, secondary, disabled)
   - Mode toggle (light/dark)

2. **Typography**
   - Font Family selector
   - Headings (H1-H6): fontSize, fontWeight, lineHeight
   - Body text (body1, body2)
   - Button text style

3. **Spacing & Shape**
   - Base spacing unit (px)
   - Border radius (px)

4. **MUI Components**
   - Button styles (colors, padding, border-radius)
   - Card styles (shadow, border, padding)
   - AppBar styles (background, height)
   - Table styles (header background, row hover)

5. **Custom CSS Overrides**
   - HTML element overrides (body, a, p, etc.)
   - Custom class definitions
   - Media query responsive styles

#### Component Structure

```tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Snackbar,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Palette as PaletteIcon,
  TextFields as TextFieldsIcon,
  Widgets as WidgetsIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { ChromePicker } from 'react-color';
import { getThemeConfig, saveTheme, resetTheme } from '../services/themeService';

interface ThemeEditorProps {
  target: 'admin' | 'frontend';
}

export const ThemeEditor: React.FC<ThemeEditorProps> = ({ target }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({});
  const [message, setMessage] = useState('');

  // Load theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    setLoading(true);
    try {
      const data = await getThemeConfig();
      setConfig(data);
    } catch (error) {
      setMessage('Failed to load theme configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Generate CSS from config
      const css = generateCSS(config);

      await saveTheme({
        target,
        config,
        css,
      });

      setMessage('Theme saved successfully! Refresh to see changes.');
    } catch (error) {
      setMessage('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset theme to defaults? This cannot be undone.')) return;

    try {
      await resetTheme({ target });
      setConfig({});
      setMessage('Theme reset successfully! Refresh to see changes.');
    } catch (error) {
      setMessage('Failed to reset theme');
    }
  };

  const generateCSS = (config: any): string => {
    // Convert theme config to CSS
    let css = '/* Theme Overrides */\n\n';

    // Add CSS generation logic here
    // Example: Convert palette.primary.main to CSS variables
    if (config.palette?.primary?.main) {
      css += `:root {\n  --primary-color: ${config.palette.primary.main};\n}\n\n`;
    }

    return css;
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">
          Customize {target === 'admin' ? 'Admin Panel' : 'Frontend'} Appearance
        </Typography>
        <Box>
          <Button onClick={handleReset} sx={{ mr: 1 }}>Reset</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {/* Colors Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <PaletteIcon sx={{ mr: 1 }} />
          <Typography>Colors</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Add color pickers for primary, secondary, etc. */}
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2">Primary Color</Typography>
              <ChromePicker
                color={config.palette?.primary?.main || '#2563eb'}
                onChange={(color) => {
                  setConfig({
                    ...config,
                    palette: {
                      ...config.palette,
                      primary: { ...config.palette?.primary, main: color.hex },
                    },
                  });
                }}
              />
            </Grid>
            {/* Repeat for other colors */}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Typography Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TextFieldsIcon sx={{ mr: 1 }} />
          <Typography>Typography</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Add font family selector, size inputs, etc. */}
        </AccordionDetails>
      </Accordion>

      {/* Components Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <WidgetsIcon sx={{ mr: 1 }} />
          <Typography>MUI Components</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Add component style overrides */}
        </AccordionDetails>
      </Accordion>

      {/* Custom CSS Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <CodeIcon sx={{ mr: 1 }} />
          <Typography>Custom CSS</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            multiline
            rows={10}
            label="Custom CSS"
            value={config.customCSS || ''}
            onChange={(e) => setConfig({ ...config, customCSS: e.target.value })}
            helperText="Add custom CSS to override any styles"
          />
        </AccordionDetails>
      </Accordion>

      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage('')}
        message={message}
      />
    </Box>
  );
};
```

### Integration with Settings Page

Update `packages/admin/src/pages/Settings.tsx`:

1. Add new tab:
```tsx
<Tab label="Appearance" id="settings-tab-5" aria-controls="settings-tabpanel-5" />
```

2. Add tab panel:
```tsx
<TabPanel value={activeTab} index={5}>
  <ThemeEditor target="admin" />
</TabPanel>
```

### Frontend Theme Loading

Update `packages/admin/src/main.tsx` and `packages/frontend/src/main.tsx` to load theme overrides:

```tsx
// Add link to theme CSS in index.html or dynamically load
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/admin-theme-overrides.css';
  document.head.appendChild(link);
}, []);
```

## Required NPM Package
Install color picker:
```bash
npm install react-color @types/react-color --workspace=@monorepo/admin
```

## Testing
1. Navigate to Admin > Settings > Appearance
2. Modify colors, typography, or add custom CSS
3. Click "Save Changes"
4. Refresh page to see changes applied
5. Test "Reset" button to restore defaults

## Future Enhancements
- Live preview without page refresh
- Theme presets (Dark mode, High contrast, etc.)
- Import/export theme configurations
- Theme marketplace/gallery
- A/B testing for themes
