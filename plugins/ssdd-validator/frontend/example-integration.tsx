import type * as GeoJSON from 'geojson';
/**
 * SSDD Validator Plugin - Integration Example
 *
 * This file demonstrates how to integrate the SSDD Validator components
 * into your React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import {
  ValidatorPage,
  AddressValidatorForm,
  DistrictMap,
  SettingsPanel,
} from './src/index';
import type { ValidationResult } from './src/types';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

// Example 1: Full Page Integration
function FullPageExample() {
  // Determine if user is admin (from your auth context/state)
  const isAdmin = true; // Replace with actual auth check

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ValidatorPage isAdmin={isAdmin} />
    </ThemeProvider>
  );
}

// Example 2: Custom Layout with Individual Components
function CustomLayoutExample() {
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);

  const handleValidation = (result: ValidationResult) => {
    console.log('Address validated:', result);
    setValidationResult(result);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
        <div style={{ flex: 1 }}>
          <AddressValidatorForm onValidationComplete={handleValidation} />
        </div>
        <div style={{ flex: 2 }}>
          {validationResult && (
            <DistrictMap
              center={[
                validationResult.coordinates.latitude,
                validationResult.coordinates.longitude,
              ]}
              zoom={12}
              districtBoundary={validationResult.boundary || null}
              markerPosition={[
                validationResult.coordinates.latitude,
                validationResult.coordinates.longitude,
              ]}
              height={500}
            />
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

// Example 3: Embedded in Existing Application
function EmbeddedExample() {
  return (
    <div className="my-app">
      <header>
        <h1>My Application</h1>
      </header>
      <main>
        {/* Wrap only the plugin components with ThemeProvider if not already in your app */}
        <ThemeProvider theme={theme}>
          <AddressValidatorForm
            onValidationComplete={(result) => {
              console.log('Validation complete:', result);
              // Handle result in your application
            }}
          />
        </ThemeProvider>
      </main>
    </div>
  );
}

// Example 4: Admin Settings Integration
function AdminSettingsExample() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h1>Admin Settings</h1>
        <SettingsPanel />
      </div>
    </ThemeProvider>
  );
}

// Example 5: React Router Integration
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function RouterIntegrationExample() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <nav>
          <Link to="/">Home</Link>
          <Link to="/validator">Address Validator</Link>
          <Link to="/admin/settings">Settings</Link>
        </nav>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/validator" element={<ValidatorPage isAdmin={false} />} />
          <Route path="/admin/settings" element={<SettingsPanel />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

// Example 6: With Custom Theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

function DarkThemeExample() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ValidatorPage isAdmin={false} />
    </ThemeProvider>
  );
}

// Example 7: Standalone Map Component
function StandaloneMapExample() {
  const sampleBoundary: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.1, 38.85],
        [-77.0, 38.85],
        [-77.0, 38.95],
        [-77.1, 38.95],
        [-77.1, 38.85],
      ]],
    },
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DistrictMap
        center={[38.9, -77.05]}
        zoom={11}
        districtBoundary={sampleBoundary}
        markerPosition={[38.9072, -77.0369]}
        height={600}
      />
    </ThemeProvider>
  );
}

// Example 8: Error Handling
function ErrorHandlingExample() {
  const [error, setError] = React.useState<string | null>(null);

  const handleValidation = async (result: ValidationResult) => {
    try {
      // Process result
      console.log('Processing:', result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <AddressValidatorForm onValidationComplete={handleValidation} />
    </ThemeProvider>
  );
}

// Mount the application
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<FullPageExample />);

// Export examples for documentation
export {
  FullPageExample,
  CustomLayoutExample,
  EmbeddedExample,
  AdminSettingsExample,
  RouterIntegrationExample,
  DarkThemeExample,
  StandaloneMapExample,
  ErrorHandlingExample,
};
