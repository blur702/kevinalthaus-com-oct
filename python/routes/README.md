# SSDD Validator API Routes

This directory contains FastAPI route handlers for the SSDD Validator plugin.

## Endpoints

### 1. USPS Address Validation (`/usps`)

**Endpoint:** `POST /usps/validate`

Validates and standardizes US addresses using the USPS Web Tools API.

**Environment Variables Required:**
- `USPS_API_USER_ID` - USPS API user ID (required)

**Request Body:**
```json
{
  "street1": "123 Main St",
  "street2": "Apt 4",
  "city": "Springfield",
  "state": "IL",
  "zip": "62701"
}
```

**Response:**
```json
{
  "success": true,
  "standardized_address": {
    "street1": "123 MAIN ST",
    "street2": "APT 4",
    "city": "SPRINGFIELD",
    "state": "IL",
    "zip": "62701-1234"
  },
  "error": null
}
```

**Features:**
- XML request/response parsing
- Address standardization
- ZIP+4 code resolution
- Comprehensive error handling

---

### 2. Geocoding (`/geocode`)

**Endpoint:** `POST /geocode`

Converts addresses to latitude/longitude coordinates using Nominatim (OpenStreetMap).

**Rate Limiting:** 1 request per second (Nominatim policy)

**Request Body:**
```json
{
  "address": "1600 Pennsylvania Avenue NW, Washington, DC 20500"
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "lat": 38.8976763,
      "lng": -77.0365298,
      "display_name": "The White House, 1600, Pennsylvania Avenue Northwest, ...",
      "place_id": "12345",
      "osm_type": "way",
      "osm_id": "67890",
      "importance": 0.951
    }
  ],
  "error": null,
  "query": "1600 Pennsylvania Avenue NW, Washington, DC 20500"
}
```

**Features:**
- Rate limiting (1 req/sec with async lock)
- Multiple result support (up to 5)
- Proper User-Agent header
- Result importance scoring

---

### 3. KML Boundary Parser (`/kml`)

**Endpoint:** `POST /kml/parse`

Parses KML files to extract district boundaries and convert to GeoJSON format.

**Request:** Multipart form-data with KML file upload

**Response:**
```json
{
  "success": true,
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "District 1",
        "description": "Congressional District 1"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-77.0365, 38.8977],
            [-77.0364, 38.8976],
            [-77.0365, 38.8975]
          ]
        ]
      }
    }
  ],
  "error": null,
  "metadata": {
    "document_name": "US Congressional Districts"
  }
}
```

**Features:**
- Polygon and MultiPolygon support
- KML to GeoJSON conversion
- Coordinate format transformation (KML: lng,lat,alt → GeoJSON: [lng, lat])
- Extended data extraction
- Document metadata parsing

**Coordinate Format:**
- **KML Input:** `lng,lat,alt lng,lat,alt ...` (space-separated)
- **GeoJSON Output:** `[[lng, lat], [lng, lat], ...]` (array of coordinate pairs)

---

### 4. Congressional Members API (`/house`)

**Endpoint:** `GET /house/members`

Fetches US House of Representatives member data from Congress.gov API.

**Environment Variables (Optional):**
- `CONGRESS_API_KEY` - Congress.gov API key (may be required for production)

**Query Parameters:**
- `state` (optional) - Two-letter state code filter
- `current_only` (default: true) - Only return current members

**Response:**
```json
{
  "success": true,
  "members": [
    {
      "bioguide_id": "S000510",
      "name": "Adam Smith",
      "first_name": "Adam",
      "last_name": "Smith",
      "state": "WA",
      "district": 9,
      "party": "Democrat",
      "chamber": "House",
      "url": "https://www.congress.gov/member/S000510",
      "image_url": "https://www.congress.gov/img/member/s000510_200.jpg"
    }
  ],
  "total_count": 435,
  "error": null
}
```

**Features:**
- Filters to House members only (excludes Senators)
- State filtering
- Party affiliation parsing
- Member URLs and portrait images
- Handles 403 errors (API key requirement)

---

## Development

### Install Dependencies

```bash
cd python
pip install -r requirements.txt
```

### Run Locally

```bash
cd python
python main.py
```

The service will start on `http://localhost:8000`.

### API Documentation

When running in development mode, interactive API docs are available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Docker

The service runs in Docker via the main `docker-compose.yml` file:

```bash
docker compose up -d python-service
```

---

## Error Handling

All endpoints include comprehensive error handling:

- **400 Bad Request** - Invalid input data
- **500 Internal Server Error** - Configuration errors (missing API keys)
- **502 Bad Gateway** - External API returned error
- **503 Service Unavailable** - Unable to connect to external API

Error responses include structured error messages:
```json
{
  "success": false,
  "error": "Detailed error message",
  "...": null
}
```

---

## Type Safety

All endpoints use Pydantic models for request/response validation:
- Automatic validation
- Type coercion
- Schema documentation
- OpenAPI generation

---

## Logging

All routes use Python's `logging` module:
- INFO level: Successful operations
- WARNING level: Expected errors (e.g., address not found)
- ERROR level: Unexpected errors with stack traces

Log level is controlled by `PYTHON_ENV` environment variable:
- `development` → DEBUG
- `production` → INFO

---

## Testing

To test the endpoints, use the interactive docs at `/docs` or `curl`:

```bash
# Test USPS validation
curl -X POST http://localhost:8000/usps/validate \
  -H "Content-Type: application/json" \
  -d '{"street1":"123 Main St","city":"Springfield","state":"IL","zip":"62701"}'

# Test geocoding
curl -X POST http://localhost:8000/geocode \
  -H "Content-Type: application/json" \
  -d '{"address":"1600 Pennsylvania Ave NW, Washington DC"}'

# Test House members
curl http://localhost:8000/house/members?state=WA
```
