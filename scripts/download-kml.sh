#!/bin/bash

# Download KML files for all Congressional districts
# URL format: https://kml.house.gov/current/STATE-DISTRICT/shape.kml

BASE_URL="https://kml.house.gov/current"
OUTPUT_DIR="kml"

# All US state abbreviations
STATES=(
  AL AK AZ AR CA CO CT DE FL GA
  HI ID IL IN IA KS KY LA ME MD
  MA MI MN MS MO MT NE NV NH NJ
  NM NY NC ND OH OK OR PA RI SC
  SD TN TX UT VT VA WA WV WI WY
)

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Starting download of Congressional district KML files..."
echo "Output directory: $OUTPUT_DIR"
echo ""

TOTAL_DOWNLOADED=0
TOTAL_FAILED=0

# Loop through each state
for STATE in "${STATES[@]}"; do
  echo "Processing $STATE..."

  # Try districts 1-60 (covers all possible districts)
  for DISTRICT in {1..60}; do
    # Construct URL and filename
    URL="$BASE_URL/$STATE-$DISTRICT/shape.kml"
    FILENAME="$OUTPUT_DIR/${STATE}-${DISTRICT}.kml"

    # Download with curl, suppress output, follow redirects
    HTTP_CODE=$(curl -s -o "$FILENAME" -w "%{http_code}" "$URL")

    if [ "$HTTP_CODE" = "200" ]; then
      echo "  ✓ Downloaded: $STATE-$DISTRICT"
      ((TOTAL_DOWNLOADED++))
    elif [ "$HTTP_CODE" = "404" ]; then
      # Remove empty file and stop trying higher districts for this state
      rm -f "$FILENAME"
      break
    else
      # Other error - remove file and continue
      rm -f "$FILENAME"
      echo "  ✗ Error $HTTP_CODE: $STATE-$DISTRICT"
      ((TOTAL_FAILED++))
    fi
  done
done

echo ""
echo "Download complete!"
echo "Total downloaded: $TOTAL_DOWNLOADED"
echo "Total failed: $TOTAL_FAILED"
echo "Files saved in: $OUTPUT_DIR/"
