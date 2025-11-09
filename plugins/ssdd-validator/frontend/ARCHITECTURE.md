# SSDD Validator Frontend - Architecture

## Component Hierarchy

```
ValidatorPage (Main Container)
├── Tabs Navigation
│   ├── Tab 1: Validator
│   │   ├── Grid Layout
│   │   │   ├── AddressValidatorForm (5 cols)
│   │   │   │   ├── TextField (street1)
│   │   │   │   ├── TextField (street2)
│   │   │   │   ├── TextField (city)
│   │   │   │   ├── TextField (state)
│   │   │   │   ├── TextField (zip)
│   │   │   │   ├── Button (Submit)
│   │   │   │   └── Alert (Success/Error)
│   │   │   └── DistrictMap (7 cols)
│   │   │       ├── Leaflet Map Instance
│   │   │       ├── OpenStreetMap Tiles
│   │   │       ├── GeoJSON Layer (boundary)
│   │   │       └── Marker Layer (address)
│   ├── Tab 2: History
│   │   └── AddressHistory
│   │       ├── Table
│   │       │   ├── TableHead
│   │       │   └── TableBody (rows)
│   │       └── TablePagination
│   ├── Tab 3: Districts
│   │   └── DistrictList
│   │       ├── FormControl (State Filter)
│   │       ├── Table
│   │       │   ├── TableHead
│   │       │   └── TableBody (rows)
│   │       └── TablePagination
│   └── Tab 4: Settings (Admin Only)
│       └── SettingsPanel
│           ├── TextField (USPS API Key)
│           ├── Button (Save)
│           ├── Button (Sync Members)
│           └── Alert (Status)
```

## Data Flow

### Validation Flow
```
User Input (Form)
    ↓
AddressValidatorForm State
    ↓
POST /api/ssdd-validator/validate
    ↓
Backend Processing
    ↓
ValidationResult Response
    ↓
onValidationComplete Callback
    ↓
ValidatorPage State Update
    ↓
DistrictMap Props Update
    ↓
Map Re-renders with Boundary + Marker
```

### History View Flow
```
User Clicks "History" Tab
    ↓
AddressHistory Mounts
    ↓
useEffect Hook Triggers
    ↓
GET /api/ssdd-validator/addresses
    ↓
Backend Query
    ↓
AddressHistoryItem[] Response
    ↓
Component State Update
    ↓
Table Renders with Data
    ↓
User Clicks "View on Map"
    ↓
onViewOnMap Callback
    ↓
ValidatorPage Switches to Tab 1
    ↓
Fetches District Boundary
    ↓
Map Updates
```

### District Browser Flow
```
User Clicks "Districts" Tab
    ↓
DistrictList Mounts
    ↓
useEffect Hook Triggers
    ↓
GET /api/ssdd-validator/districts
    ↓
Backend Query (All 435 Districts)
    ↓
DistrictInfo[] Response
    ↓
Component State Update
    ↓
Table Renders
    ↓
User Selects State Filter
    ↓
Client-side Filtering
    ↓
Table Re-renders with Filtered Data
    ↓
User Clicks "View Boundary"
    ↓
onViewOnMap Callback
    ↓
ValidatorPage Switches to Tab 1
    ↓
Fetches District Boundary
    ↓
Map Updates
```

### Settings Flow
```
Admin Clicks "Settings" Tab
    ↓
SettingsPanel Mounts
    ↓
useEffect Hook Triggers
    ↓
GET /api/ssdd-validator/settings
    ↓
Backend Query
    ↓
SettingsData Response
    ↓
Component State Update
    ↓
Form Renders with Status
    ↓
Admin Enters API Key
    ↓
Clicks "Save API Key"
    ↓
PUT /api/ssdd-validator/settings
    ↓
Backend Updates DB
    ↓
Success Response
    ↓
Alert Shows Success
    ↓
Settings Reload
```

## State Management

### ValidatorPage State
```typescript
{
  currentTab: number,                           // Active tab index
  mapCenter: [number, number] | undefined,      // Map center coords
  mapZoom: number | undefined,                  // Map zoom level
  districtBoundary: GeoJSON | null,             // District boundary
  markerPosition: [number, number] | null,      // Address marker
}
```

### AddressValidatorForm State
```typescript
{
  formData: Address,                            // Form input values
  loading: boolean,                             // Submit in progress
  error: string | null,                         // Error message
  result: ValidationResult | null,              // Validation result
}
```

### DistrictMap State
```typescript
{
  mapRef: L.Map | null,                         // Leaflet map instance
  boundaryLayerRef: L.GeoJSON | null,           // Boundary layer ref
  markerRef: L.Marker | null,                   // Marker ref
}
```

### AddressHistory State
```typescript
{
  history: AddressHistoryItem[],                // History data
  loading: boolean,                             // Fetch in progress
  error: string | null,                         // Error message
  page: number,                                 // Current page
  rowsPerPage: number,                          // Items per page
}
```

### DistrictList State
```typescript
{
  districts: DistrictInfo[],                    // All districts
  filteredDistricts: DistrictInfo[],            // Filtered districts
  loading: boolean,                             // Fetch in progress
  error: string | null,                         // Error message
  page: number,                                 // Current page
  rowsPerPage: number,                          // Items per page
  selectedState: string,                        // State filter
}
```

### SettingsPanel State
```typescript
{
  uspsApiKey: string,                           // API key input
  settings: SettingsData | null,                // Current settings
  loading: boolean,                             // Operation in progress
  syncing: boolean,                             // Sync in progress
  error: string | null,                         // Error message
  success: string | null,                       // Success message
}
```

## Event Flow

### Form Submission
```
1. User fills form fields
2. onChange handlers update formData state
3. User clicks "Validate Address"
4. handleSubmit prevents default
5. Sets loading=true
6. Fetch POST /api/ssdd-validator/validate
7. Awaits response
8. Sets result state
9. Calls onValidationComplete callback
10. Sets loading=false
11. Alert renders with result
```

### Map Interaction
```
1. User scrolls/zooms map
2. Leaflet updates internal state
3. No React state update needed
4. User clicks marker
5. Popup displays
6. No API call needed
```

### Pagination
```
1. User clicks "Next Page"
2. handleChangePage updates page state
3. Component re-renders
4. paginatedData computed from slice
5. Table re-renders with new data
6. No API call needed (client-side)
```

### Filter Update
```
1. User selects state from dropdown
2. onChange updates selectedState
3. useEffect triggers
4. filteredDistricts computed
5. page reset to 0
6. Component re-renders
7. Table shows filtered data
```

## API Contract

### Request Format
```typescript
// POST /api/ssdd-validator/validate
{
  street1: string,
  street2?: string,
  city: string,
  state: string,
  zip: string,
}

// PUT /api/ssdd-validator/settings
{
  uspsApiKey: string,
}
```

### Response Format
```typescript
// ValidationResult
{
  success: boolean,
  standardizedAddress: Address,
  coordinates: { latitude: number, longitude: number },
  ssdd: string,
  district: {
    state: string,
    districtNumber: number,
    representative?: {
      name: string,
      party: string,
      phone?: string,
      website?: string,
    },
  },
  boundary?: GeoJSON,
}

// ApiError
{
  error: string,
  details?: string,
}
```

## Lifecycle Hooks

### Component Mount
```typescript
useEffect(() => {
  // Runs once on mount
  loadData();
}, []); // Empty dependency array
```

### State Change
```typescript
useEffect(() => {
  // Runs when dependency changes
  updateMap();
}, [districtBoundary]); // Dependency array
```

### Component Unmount
```typescript
useEffect(() => {
  return () => {
    // Cleanup function
    if (mapRef.current) {
      mapRef.current.remove();
    }
  };
}, []);
```

## Performance Considerations

### Optimization Points
1. **Pagination** - Only render visible rows
2. **Conditional Rendering** - Hidden tabs not mounted
3. **Debouncing** - Form submission throttled by user
4. **Memoization** - Can add useMemo for filtered data
5. **Lazy Loading** - Can add React.lazy for code splitting
6. **Map Cleanup** - Remove map instance on unmount

### Bundle Size
```
react: ~100KB
react-dom: ~120KB
@mui/material: ~400KB
@emotion: ~50KB
leaflet: ~150KB
--------------------
Total: ~820KB (uncompressed)
Gzipped: ~250KB
```

### Network Requests
```
On Page Load:
- GET /api/ssdd-validator/addresses (History tab)
- GET /api/ssdd-validator/districts (Districts tab)
- GET /api/ssdd-validator/settings (Settings tab)

On User Action:
- POST /api/ssdd-validator/validate (Form submit)
- GET /api/ssdd-validator/districts/:ssdd (View boundary)
- PUT /api/ssdd-validator/settings (Save settings)
- POST /api/ssdd-validator/sync-members (Sync)
```

## Error Handling Strategy

### Network Errors
```
Fetch Error
    ↓
Catch Block
    ↓
setError(message)
    ↓
Alert Component Shows Error
    ↓
User Dismisses Alert
    ↓
setError(null)
```

### Validation Errors
```
API Returns 400
    ↓
response.ok === false
    ↓
Parse Error JSON
    ↓
Throw Error with Message
    ↓
Catch Block
    ↓
Display in Alert
```

### Component Errors
```
Component Throws
    ↓
Error Boundary (if implemented)
    ↓
Fallback UI
    ↓
Log Error
```

## Security Considerations

### Authentication
- All requests include `credentials: 'include'`
- httpOnly cookies used for JWT tokens
- No tokens stored in localStorage
- No sensitive data in URL params

### Input Validation
- Client-side validation (UX)
- Server-side validation (security)
- No SQL injection risk (parameterized queries)
- XSS protection via React escaping

### Data Exposure
- No API keys in frontend code
- Settings panel shows key configured status only
- Representative data is public information
- User addresses stored with user association

## Testing Strategy

### Unit Tests
```typescript
// Component rendering
test('renders form fields', () => {...});

// User interactions
test('submits form on click', () => {...});

// API mocking
test('handles API errors', () => {...});

// State updates
test('updates map on validation', () => {...});
```

### Integration Tests
```typescript
// Multi-component flows
test('validation updates map', () => {...});

// Tab switching
test('switches tabs correctly', () => {...});

// Pagination
test('paginates history', () => {...});
```

### E2E Tests
```typescript
// Full user flows
test('complete validation flow', () => {...});

// Admin workflows
test('admin can sync members', () => {...});
```

## Accessibility Tree

```
ValidatorPage (main)
├── Tabs (navigation)
│   ├── Tab (button, role=tab)
│   └── Tab (button, role=tab)
├── TabPanel (region, role=tabpanel)
│   ├── Form (form)
│   │   ├── TextField (textbox, aria-label)
│   │   └── Button (button, aria-label)
│   └── Map (region, aria-label)
└── Table (table, role=table)
    ├── TableHead (rowgroup, role=rowgroup)
    └── TableBody (rowgroup, role=rowgroup)
```

## Deployment Checklist

- [ ] npm install completes
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] All components render
- [ ] API endpoints accessible
- [ ] Authentication working
- [ ] Map tiles load
- [ ] Form validation works
- [ ] Pagination works
- [ ] Tabs switch correctly
- [ ] Loading states show
- [ ] Error messages display
- [ ] Mobile responsive
- [ ] Accessibility audit passes
- [ ] Browser compatibility tested

## Monitoring Points

### Metrics to Track
1. **Performance**
   - Time to first render
   - Time to interactive
   - API response times
   - Map load time

2. **Errors**
   - API failures
   - Component errors
   - Map rendering errors
   - Network timeouts

3. **Usage**
   - Validations per day
   - Most searched states
   - Settings changes
   - Tab navigation patterns

## Future Architecture Considerations

### Scalability
- Add Redux for complex state management
- Implement WebSockets for real-time updates
- Add service worker for offline support
- Implement virtual scrolling for large tables

### Maintainability
- Add Storybook for component documentation
- Implement design system tokens
- Create shared component library
- Add visual regression tests

### Features
- Add export functionality (CSV, PDF)
- Implement map clustering for multiple addresses
- Add address autocomplete
- Implement batch validation
