/**
 * PostGIS utilities
 */

/**
 * Parse PostGIS POINT text to coordinates
 * Example: "POINT(-122.4194 37.7749)" -> { lat: 37.7749, lng: -122.4194 }
 */
export function parseCentroid(centroidText: string): { lat: number; lng: number } | undefined {
  const match = centroidText.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (!match) {
    return undefined;
  }

  const lng = parseFloat(match[1]);
  const lat = parseFloat(match[2]);

  if (isNaN(lng) || isNaN(lat)) {
    return undefined;
  }

  return { lat, lng };
}

