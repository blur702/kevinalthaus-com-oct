#!/bin/bash

# Download KML files for US territories
# URL format: https://kml.house.gov/current/STATE-DISTRICT/shape.kml

BASE_URL="https://kml.house.gov/current"
OUTPUT_DIR="kml"

# US Territories
# PR = Puerto Rico
# GU = Guam
# VI = US Virgin Islands
# AS = American Samoa
# MP = Northern Mariana Islands
# DC = District of Columbia (not a state, but has a delegate)
TERRITORIES=(PR GU VI AS MP DC)

echo "Starting download of US territory KML files..."
echo "Output directory: $OUTPUT_DIR"
echo ""

TOTAL_DOWNLOADED=0
TOTAL_FAILED=0

# Loop through each territory
for TERRITORY in "${TERRITORIES[@]}"; do
  echo "Processing $TERRITORY..."

  # Try at-large (0) and regular districts (1-5)
  for DISTRICT in 0 {1..5}; do
    # Construct URL and filename
    URL="$BASE_URL/$TERRITORY-$DISTRICT/shape.kml"
    FILENAME="$OUTPUT_DIR/${TERRITORY}-${DISTRICT}.kml"

    # Download with curl, suppress output, follow redirects
    HTTP_CODE=$(curl -s -o "$FILENAME" -w "%{http_code}" "$URL")

    if [ "$HTTP_CODE" = "200" ]; then
      echo "  ✓ Downloaded: $TERRITORY-$DISTRICT"
      ((TOTAL_DOWNLOADED++))
    elif [ "$HTTP_CODE" = "404" ]; then
      # Remove empty file and stop trying higher districts for this territory
      rm -f "$FILENAME"
      if [ "$DISTRICT" -gt 0 ]; then
        break
      fi
    else
      # Other error - remove file and continue
      rm -f "$FILENAME"
      echo "  ✗ Error $HTTP_CODE: $TERRITORY-$DISTRICT"
      ((TOTAL_FAILED++))
    fi
  done
done

echo ""
echo "Download complete!"
echo "Total downloaded: $TOTAL_DOWNLOADED"
echo "Total failed: $TOTAL_FAILED"
echo "Files saved in: $OUTPUT_DIR/"
