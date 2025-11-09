# SSDD Validator Frontend

React frontend components for the SSDD Validator plugin, built with Material-UI v5 and Leaflet.

## Components

### Core Components

#### AddressValidatorForm
Main address validation form with:
- Street address, city, state, ZIP input fields
- Form validation and error handling
- Loading states with Material-UI CircularProgress
- Success alerts with validation results
- Callback support for parent components

**Usage:**
```tsx
import { AddressValidatorForm } from '@monorepo/plugin-ssdd-validator-frontend';

<AddressValidatorForm
  onValidationComplete={(result) => {
    console.log('Validated:', result);
  }}
/>
```

#### DistrictMap
Interactive Leaflet map displaying:
- OpenStreetMap tiles
- Congressional district boundaries (GeoJSON)
- Address location markers
- Auto-fit bounds to district
- Responsive sizing

**Usage:**
```tsx
import { DistrictMap } from '@monorepo/plugin-ssdd-validator-frontend';

<DistrictMap
  center={[38.9072, -77.0369]}
  zoom={12}
  districtBoundary={geoJsonData}
  markerPosition={[38.9072, -77.0369]}
  height={600}
/>
```

#### SettingsPanel
Admin settings interface for:
- USPS API key configuration
- Congressional member data sync
- Status displays and timestamps
- Success/error messaging

**Usage:**
```tsx
import { SettingsPanel } from '@monorepo/plugin-ssdd-validator-frontend';

<SettingsPanel />
```

#### AddressHistory
User's validation history table with:
- Paginated list view
- Address, district, SSDD display
- Click to view on map
- Date formatting

**Usage:**
```tsx
import { AddressHistory } from '@monorepo/plugin-ssdd-validator-frontend';

<AddressHistory
  onViewOnMap={(item) => {
    // Handle map view
  }}
/>
```

#### DistrictList
Browse all congressional districts:
- Filterable by state
- Paginated table view
- Representative information
- Party affiliation chips
- Click to view boundary

**Usage:**
```tsx
import { DistrictList } from '@monorepo/plugin-ssdd-validator-frontend';

<DistrictList
  onViewOnMap={(district) => {
    // Handle map view
  }}
/>
```

### Pages

#### ValidatorPage
Complete page combining all components:
- Tab-based navigation (Validator, History, Districts, Settings)
- Grid layout with form + map
- State management for map updates
- Role-based settings access

**Usage:**
```tsx
import { ValidatorPage } from '@monorepo/plugin-ssdd-validator-frontend';

<ValidatorPage isAdmin={true} />
```

## API Integration

All components use the Fetch API with:
- Cookie-based authentication (`credentials: 'include'`)
- Proper error handling
- TypeScript type safety
- Loading state management

### Endpoints Used

- `POST /api/ssdd-validator/validate` - Validate address
- `GET /api/ssdd-validator/addresses` - Get address history
- `GET /api/ssdd-validator/districts` - List all districts
- `GET /api/ssdd-validator/districts/:ssdd` - Get district boundary
- `GET /api/ssdd-validator/settings` - Get plugin settings
- `PUT /api/ssdd-validator/settings` - Update settings
- `POST /api/ssdd-validator/sync-members` - Sync congressional members

## TypeScript Types

```typescript
interface ValidationResult {
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

interface AddressHistoryItem {
  id: string;
  address: Address;
  ssdd: string;
  districtState: string;
  districtNumber: number;
  validatedAt: string;
}

interface DistrictInfo {
  ssdd: string;
  state: string;
  districtNumber: number;
  representativeName?: string;
  representativeParty?: string;
  representativePhone?: string;
  representativeWebsite?: string;
}
```

## Material-UI Integration

Components use Material-UI v5 with:
- Box, Paper, Typography for layout
- Grid for responsive layouts
- TextField, Button for forms
- Table components for data display
- Alert for messaging
- CircularProgress for loading
- Tabs for navigation
- Chip for tags
- Icons from @mui/icons-material

## Leaflet Integration

Map component features:
- OpenStreetMap tile layer
- GeoJSON layer rendering
- Custom marker icons
- Auto-fit bounds
- Popup support
- Responsive container

**Required CSS:**
```tsx
import 'leaflet/dist/leaflet.css';
```

## Accessibility Features

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management
- Screen reader friendly alerts
- Proper form labels

## Performance Optimizations

- Lazy loading with React.lazy (recommended)
- Memoization with React.memo for pure components
- useCallback for event handlers
- Pagination for large datasets
- Debounced search (if implemented)
- Code splitting at page level

## Error Handling

All components include:
- Try-catch blocks for async operations
- User-friendly error messages
- Network error handling
- Loading state management
- Graceful degradation

## Development

```bash
# Install dependencies
npm install

# Type checking
npx tsc --noEmit

# Build (if needed)
npm run build
```

## Integration Example

```tsx
import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ValidatorPage } from '@monorepo/plugin-ssdd-validator-frontend';

const theme = createTheme();

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ValidatorPage isAdmin={false} />
    </ThemeProvider>
  );
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## Dependencies

- react ^18.2.0
- react-dom ^18.2.0
- @mui/material ^5.14.0
- @mui/icons-material ^5.14.0
- @emotion/react ^11.11.0
- @emotion/styled ^11.11.0
- leaflet ^1.9.4

## Notes

- All components are fully typed with TypeScript
- Components follow React hooks patterns
- No class components used
- All state is managed with useState/useEffect
- No external state management library required (Redux, etc.)
- Components are presentational and can be composed
- API calls use native Fetch API (no axios)
