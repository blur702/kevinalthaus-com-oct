/**
 * DistrictMap - Leaflet map component for displaying congressional districts
 *
 * Features:
 * - OpenStreetMap tiles
 * - GeoJSON district boundary rendering
 * - Address marker placement
 * - Auto-fit bounds to boundary
 * - Responsive map container
 */

import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Bundle marker assets locally via Leaflet package images
// Vite resolves these imports to URLs at build-time
import markerIcon2x from '../assets/leaflet/marker-icon-2x.png';
import markerIcon from '../assets/leaflet/marker-icon.png';
import markerShadow from '../assets/leaflet/marker-shadow.png';

// Merge default icon options; cast to any to avoid prototype private access
(L.Icon.Default as any).mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface DistrictMapProps {
  center?: [number, number];
  zoom?: number;
  districtBoundary?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  markerPosition?: [number, number] | null;
  height?: number | string;
}

const DistrictMap: React.FC<DistrictMapProps> = ({
  center = [39.8283, -98.5795], // Geographic center of USA
  zoom = 4,
  districtBoundary = null,
  markerPosition = null,
  height = 500,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialize map on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(center, zoom);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update district boundary
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing boundary layer
    if (boundaryLayerRef.current) {
      mapRef.current.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    // Add new boundary if provided
    if (districtBoundary) {
      const geoJsonLayer = L.geoJSON(districtBoundary as any, {
        style: {
          color: '#2196f3',
          weight: 2,
          opacity: 0.8,
          fillColor: '#2196f3',
          fillOpacity: 0.2,
        },
      }).addTo(mapRef.current);

      boundaryLayerRef.current = geoJsonLayer;

      // Fit map bounds to boundary
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [districtBoundary]);

  // Update marker position
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing marker
    if (markerRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    // Add new marker if provided
    if (markerPosition) {
      const marker = L.marker(markerPosition).addTo(mapRef.current);
      marker.bindPopup('Validated Address Location');
      markerRef.current = marker;

      // Pan to marker if no boundary
      if (!districtBoundary) {
        mapRef.current.setView(markerPosition, 13);
      }
    }
  }, [markerPosition, districtBoundary]);

  return (
    <Paper elevation={3} sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">
          Congressional District Map
        </Typography>
      </Box>
      <Box
        ref={mapContainerRef}
        sx={{
          height: typeof height === 'number' ? `${height}px` : height,
          width: '100%',
          position: 'relative',
        }}
      />
    </Paper>
  );
};

export default DistrictMap;
