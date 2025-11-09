# SSDD Validator Plugin

A comprehensive address validation, geocoding, and congressional district mapping plugin for the Kevin Althaus platform.

## Features

- **Address Validation**: Validate and standardize US postal addresses using USPS Web Tools API
- **Geocoding**: Convert addresses to latitude/longitude coordinates using Nominatim (OpenStreetMap)
- **District Mapping**: Map addresses to congressional districts using PostGIS spatial queries
- **Representative Information**: Display congressional representative contact details
- **Interactive Maps**: Visualize district boundaries and validated addresses with Leaflet.js
- **KML Import**: Import congressional district boundary data from KML files
- **Member Synchronization**: Sync congressional member data from official House API

## Architecture

### Database Schema (PostgreSQL + PostGIS)

The plugin uses an isolated PostgreSQL schema (`plugin_ssdd_validator`) with the following tables:

- **addresses**: Validated addresses with PostGIS Point geometry for geocoded locations
- **districts**: Congressional district boundaries with PostGIS MultiPolygon geometry
- **members**: Congressional representative information
- **settings**: Plugin configuration with encrypted API key storage
- **member_sync_log**: Audit trail for data synchronization operations

### Technology Stack

**Backend (TypeScript)**
- Express.js route handlers
- PostgreSQL with PostGIS extension
- Type-safe database queries
- Integration with Python microservice

**Python Microservice**
- FastAPI endpoints for external API integrations
- USPS Web Tools API client
- Nominatim geocoding client
- KML/XML parsing
- Congress.gov API integration

**Frontend (React + TypeScript)**
- Material-UI v5 components
- Leaflet.js for interactive maps
- Real-time address validation
- District boundary visualization
- Admin settings panel

## Installation

### Prerequisites

1. **PostgreSQL 16** with PostGIS extension enabled
2. **USPS Web Tools API Account** (free at https://www.usps.com/business/web-tools-apis/)
3. **Node.js 20+** and **Python 3.9+**

### Setup Steps

1. **Enable PostGIS** (already configured in `docker/postgres/init/01-init.sql`):
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

2. **Install the plugin** via the admin UI:
   - Navigate to Admin → Plugins
   - Find "SSDD Validator" in available plugins
   - Click "Install"

3. **Configure USPS API credentials**:
   - Go to Settings tab in the plugin
   - Enter your USPS API User ID
   - Save settings

4. **(Optional) Import district boundaries**:
   - KML files are available in `media/kml/`
   - Use the Import KML feature in Settings

5. **Sync congressional members**:
   - Click "Sync Congressional Members" in Settings
   - Data fetches from official House API

## Usage

### For End Users

1. **Validate an Address**:
   - Enter street address, city, state, ZIP code
   - Click "Validate Address"
   - View standardized address, coordinates, and district info

2. **View on Map**:
   - Interactive map shows your address location
   - District boundary displayed in blue
   - Representative information shown in popup

3. **Browse History**:
   - Access previously validated addresses
   - Re-display results on map
   - Filter by date or district

### For Administrators

1. **Configure API Keys**:
   - Settings → USPS API User ID
   - Keys are encrypted in database

2. **Import District Data**:
   - Upload KML files with district boundaries
   - Automatic geometry parsing and validation

3. **Sync Member Data**:
   - One-click sync from House API
   - Automatic matching to districts
   - Audit log of all changes

## API Endpoints

### Public Endpoints (Authenticated Users)

#### POST `/api/ssdd-validator/validate`
Validate address and find congressional district.

**Request:**
```json
{
  "street1": "1600 Pennsylvania Ave NW",
  "street2": "",
  "city": "Washington",
  "state": "DC",
  "zip": "20500"
}
```

**Response:**
```json
{
  "valid": true,
  "addressId": "uuid",
  "standardized": {
    "street1": "1600 PENNSYLVANIA AVE NW",
    "city": "WASHINGTON",
    "state": "DC",
    "zip": "20500",
    "zip4": "0005"
  },
  "coordinates": {
    "lat": 38.8977,
    "lng": -77.0365
  },
  "district": {
    "id": "uuid",
    "ssdd": "DC-AL",
    "state": "DC",
    "districtNumber": "AL",
    "name": "District of Columbia At-Large",
    "representative": {
      "name": "Eleanor Holmes Norton",
      "party": "Democrat",
      "phone": "(202) 225-8050",
      "websiteUrl": "https://norton.house.gov"
    }
  }
}
```

#### GET `/api/ssdd-validator/district/:lat/:lng`
Find congressional district by coordinates.

#### GET `/api/ssdd-validator/addresses`
List user's validated address history.

#### GET `/api/ssdd-validator/districts`
List all congressional districts.

#### GET `/api/ssdd-validator/district/:state/:number/representative`
Get representative information for specific district.

### Admin Endpoints (Admin Role Required)

#### GET `/api/ssdd-validator/settings`
Get plugin settings (API key status, last sync timestamp).

#### PUT `/api/ssdd-validator/settings`
Update plugin settings (USPS API key).

#### POST `/api/ssdd-validator/import-kml`
Import district boundary KML files.

#### POST `/api/ssdd-validator/sync-members`
Sync congressional member data from House API.

## Development

### Build the Plugin

```bash
cd plugins/ssdd-validator
npm install
npm run build
```

### Run Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration
```

### Project Structure

```
plugins/ssdd-validator/
├── plugin.yaml                 # Plugin manifest
├── package.json                # Backend dependencies
├── tsconfig.json               # TypeScript config
├── migrations/                 # Database migrations
│   ├── 01-create-schema.sql
│   ├── 02-create-addresses-table.sql
│   ├── 03-create-districts-table.sql
│   ├── 04-create-settings-table.sql
│   ├── 05-create-member-sync-log-table.sql
│   ├── 06-add-foreign-keys.sql
│   └── 07-create-members-table.sql
├── src/                        # Backend TypeScript
│   ├── index.ts                # Main plugin class
│   ├── types/
│   │   └── index.ts            # Type definitions
│   └── routes/
│       ├── index.ts            # Route factory
│       ├── validateAddress.ts  # Address validation
│       ├── getDistrict.ts      # District lookup
│       ├── importKML.ts        # KML import
│       ├── syncMembers.ts      # Member sync
│       ├── settings.ts         # Settings CRUD
│       ├── listAddresses.ts    # Address history
│       ├── listDistricts.ts    # District list
│       └── getRepresentative.ts # Rep info
└── frontend/                   # React components
    ├── package.json
    └── src/
        ├── components/
        │   ├── AddressValidatorForm.tsx
        │   ├── DistrictMap.tsx
        │   ├── SettingsPanel.tsx
        │   ├── AddressHistory.tsx
        │   └── DistrictList.tsx
        └── pages/
            └── ValidatorPage.tsx
```

## Security Features

- **RBAC**: Admin-only endpoints protected with role checks
- **Input Sanitization**: All user inputs sanitized with `stripAllHTML()`
- **SQL Injection Prevention**: Parameterized queries throughout
- **API Key Encryption**: USPS credentials encrypted in database
- **PostGIS Safety**: All geometries use SRID 4326 (WGS84)
- **Rate Limiting**: Geocoding respects Nominatim usage policy (1 req/sec)
- **User Isolation**: Address history scoped to authenticated user

## Database Queries

### Find District by Point

```sql
SELECT
  d.id,
  d.ssdd,
  d.state,
  d.district_number,
  d.name,
  ST_AsGeoJSON(d.boundary) as boundary_geojson
FROM plugin_ssdd_validator.districts d
WHERE ST_Contains(d.boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LIMIT 1;
```

### Import KML Geometry

```sql
INSERT INTO plugin_ssdd_validator.districts (
  ssdd,
  state,
  district_number,
  name,
  boundary,
  kml_file_name,
  created_by
) VALUES (
  $1,
  $2,
  $3,
  $4,
  ST_GeomFromGeoJSON($5),
  $6,
  $7
)
ON CONFLICT (ssdd) DO UPDATE SET
  boundary = EXCLUDED.boundary,
  updated_at = CURRENT_TIMESTAMP;
```

## Troubleshooting

### "USPS API credentials not configured"
- Admin must configure USPS API key in Settings panel
- Verify key is valid at https://www.usps.com/business/web-tools-apis/

### "Address not found in geocoding service"
- Address may be too new or not in OpenStreetMap database
- Try slightly different address format
- Geocoding service may be temporarily unavailable

### "No congressional district found"
- Coordinates may fall outside US congressional districts
- District boundaries may not be imported yet
- Use Import KML feature to load boundary data

### PostGIS Errors
- Ensure PostGIS extension is enabled: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Verify geometry types are correct (Point for addresses, MultiPolygon for districts)
- Check SRID is 4326 for all geometries

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- GitHub Issues: https://github.com/kevinalthaus/kevinalthaus-com-oct/issues
- Email: contact@kevinalthaus.com

## Acknowledgments

- **USPS Web Tools API** for address validation
- **OpenStreetMap/Nominatim** for geocoding
- **PostGIS** for spatial database capabilities
- **Congress.gov API** for congressional member data
- **US Census Bureau** for district boundary KML files

