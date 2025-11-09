# SSDD Validator Frontend - Quick Reference

## Installation

```bash
cd plugins/ssdd-validator/frontend
npm install
```

## Import Components

```tsx
import {
  ValidatorPage,
  AddressValidatorForm,
  DistrictMap,
  SettingsPanel,
  AddressHistory,
  DistrictList,
} from '@monorepo/plugin-ssdd-validator-frontend';

// Import types
import type {
  ValidationResult,
  AddressHistoryItem,
  DistrictInfo,
  Address,
  Coordinates,
} from '@monorepo/plugin-ssdd-validator-frontend';
```

## Quick Start (Full Page)

```tsx
import { ThemeProvider, createTheme } from '@mui/material';
import { ValidatorPage } from '@monorepo/plugin-ssdd-validator-frontend';

const theme = createTheme();

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ValidatorPage isAdmin={true} />
    </ThemeProvider>
  );
}
```

## Component Cheat Sheet

### AddressValidatorForm
```tsx
<AddressValidatorForm
  onValidationComplete={(result) => {
    console.log(result.ssdd);
    console.log(result.coordinates);
  }}
/>
```

### DistrictMap
```tsx
<DistrictMap
  center={[38.9072, -77.0369]}
  zoom={12}
  districtBoundary={geoJsonData}
  markerPosition={[38.9072, -77.0369]}
  height={600}
/>
```

### SettingsPanel
```tsx
<SettingsPanel />  {/* Admin only */}
```

### AddressHistory
```tsx
<AddressHistory
  onViewOnMap={(item) => {
    // Switch to map tab
  }}
/>
```

### DistrictList
```tsx
<DistrictList
  onViewOnMap={(district) => {
    // Load boundary on map
  }}
/>
```

### ValidatorPage
```tsx
<ValidatorPage isAdmin={false} />
```

## API Endpoints

| Method | Endpoint | Component | Purpose |
|--------|----------|-----------|---------|
| POST | `/api/ssdd-validator/validate` | AddressValidatorForm | Validate address |
| GET | `/api/ssdd-validator/addresses` | AddressHistory | Get history |
| GET | `/api/ssdd-validator/districts` | DistrictList | List districts |
| GET | `/api/ssdd-validator/districts/:ssdd` | ValidatorPage | Get boundary |
| GET | `/api/ssdd-validator/settings` | SettingsPanel | Load settings |
| PUT | `/api/ssdd-validator/settings` | SettingsPanel | Save API key |
| POST | `/api/ssdd-validator/sync-members` | SettingsPanel | Sync members |

## Key Props

```typescript
// AddressValidatorForm
interface AddressValidatorFormProps {
  onValidationComplete?: (result: ValidationResult) => void;
}

// DistrictMap
interface DistrictMapProps {
  center?: [number, number];
  zoom?: number;
  districtBoundary?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  markerPosition?: [number, number] | null;
  height?: number | string;
}

// AddressHistory
interface AddressHistoryProps {
  onViewOnMap?: (item: AddressHistoryItem) => void;
}

// DistrictList
interface DistrictListProps {
  onViewOnMap?: (district: DistrictInfo) => void;
}

// ValidatorPage
interface ValidatorPageProps {
  isAdmin?: boolean;
}
```

## Common Patterns

### State Management
```tsx
const [result, setResult] = useState<ValidationResult | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### API Call Pattern
```tsx
try {
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Operation failed');
  }

  const data = await response.json();
  // Handle success
} catch (err) {
  setError(err instanceof Error ? err.message : 'Error');
} finally {
  setLoading(false);
}
```

### Loading State
```tsx
{loading ? (
  <CircularProgress />
) : (
  <Button>Submit</Button>
)}
```

### Error Display
```tsx
{error && (
  <Alert severity="error" onClose={() => setError(null)}>
    {error}
  </Alert>
)}
```

## Material-UI Components

```tsx
import {
  Box,           // Container
  Paper,         // Card
  Typography,    // Text
  TextField,     // Input
  Button,        // Button
  Alert,         // Message
  CircularProgress, // Spinner
  Grid,          // Layout
  Table,         // Data table
  Tabs, Tab,     // Navigation
  Chip,          // Tag
  IconButton,    // Icon button
  Tooltip,       // Hover text
} from '@mui/material';
```

## Leaflet Basics

```tsx
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Initialize map
const map = L.map(ref.current).setView([lat, lng], zoom);

// Add tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Add GeoJSON
L.geoJSON(boundary, { style: { color: '#2196f3' } }).addTo(map);

// Add marker
L.marker([lat, lng]).addTo(map).bindPopup('Text');

// Fit bounds
map.fitBounds(geoJsonLayer.getBounds());
```

## Type Definitions

```typescript
// Address
{
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

// Coordinates
{
  latitude: number;
  longitude: number;
}

// ValidationResult
{
  success: boolean;
  standardizedAddress: Address;
  coordinates: Coordinates;
  ssdd: string;
  district: {
    state: string;
    districtNumber: number;
    representative?: {
      name: string;
      party: string;
      phone?: string;
      website?: string;
    };
  };
  boundary?: GeoJSON.FeatureCollection | GeoJSON.Feature;
}
```

## Responsive Grid

```tsx
<Grid container spacing={3}>
  <Grid item xs={12} sm={6} md={4}>
    {/* Content */}
  </Grid>
  <Grid item xs={12} sm={6} md={8}>
    {/* Content */}
  </Grid>
</Grid>
```

## Tabs Pattern

```tsx
const [tab, setTab] = useState(0);

<Tabs value={tab} onChange={(e, val) => setTab(val)}>
  <Tab label="One" />
  <Tab label="Two" />
</Tabs>

{tab === 0 && <div>Content 1</div>}
{tab === 1 && <div>Content 2</div>}
```

## Table Pattern

```tsx
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Column 1</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {data.map((row) => (
        <TableRow key={row.id}>
          <TableCell>{row.value}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

## Theming

```tsx
import { createTheme, ThemeProvider } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

## File Structure

```
frontend/
├── src/
│   ├── index.tsx                 # Exports
│   ├── types.ts                  # Types
│   ├── components/
│   │   ├── AddressValidatorForm.tsx
│   │   ├── DistrictMap.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── AddressHistory.tsx
│   │   └── DistrictList.tsx
│   └── pages/
│       └── ValidatorPage.tsx
├── package.json
├── tsconfig.json
├── .eslintrc.json
└── README.md
```

## Troubleshooting

### Issue: Map not rendering
```tsx
// Add height to container
<DistrictMap height={500} />

// Import CSS
import 'leaflet/dist/leaflet.css';
```

### Issue: Marker icons missing
```tsx
// Fix in DistrictMap.tsx - uses CDN icons
// Already included in component
```

### Issue: API calls fail
```tsx
// Check credentials: 'include' is set
fetch(url, { credentials: 'include' });

// Check backend CORS settings
// Verify cookie auth is working
```

### Issue: Type errors
```tsx
// Import types explicitly
import type { ValidationResult } from './types';

// Use proper type annotations
const [result, setResult] = useState<ValidationResult | null>(null);
```

## Browser DevTools

```javascript
// Check API calls
fetch('/api/ssdd-validator/validate', {...})

// Check state in React DevTools
// Component -> AddressValidatorForm -> Hooks -> useState

// Check Leaflet map
L.map._targets  // Active maps
```

## Accessibility

```tsx
// Always include aria labels
<Button aria-label="Submit form">Submit</Button>

// Use semantic HTML
<main>
<nav>
<section>

// Test keyboard navigation
// Tab through all interactive elements
```

## Performance

```tsx
// Memoize expensive computations
const filtered = useMemo(() => data.filter(...), [data]);

// Memoize callbacks
const handleClick = useCallback(() => {...}, [deps]);

// Lazy load components
const Settings = lazy(() => import('./SettingsPanel'));
```

## Testing Commands

```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint src --ext .ts,.tsx

# Format
npx prettier --write src

# Build
npm run build
```

## Resources

- Full docs: `README.md`
- Examples: `example-integration.tsx`
- Summary: `COMPONENT_SUMMARY.md`
- Types: `src/types.ts`
