/**
 * ValidatorPage - Main page combining all SSDD Validator components
 *
 * Features:
 * - Tab-based navigation
 * - Grid layout for validator + map
 * - Role-based settings access
 * - State management for map updates
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Grid,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  History as HistoryIcon,
  Map as MapIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import AddressValidatorForm from '../components/AddressValidatorForm';
import DistrictMap from '../components/DistrictMap';
import AddressHistory from '../components/AddressHistory';
import DistrictList from '../components/DistrictList';
import SettingsPanel from '../components/SettingsPanel';
import type {
  ValidationResult,
  AddressHistoryItem,
  DistrictInfo,
} from '../types';

interface ValidatorPageProps {
  isAdmin?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`validator-tabpanel-${index}`}
      aria-labelledby={`validator-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const ValidatorPage: React.FC<ValidatorPageProps> = ({ isAdmin = false }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined);
  const [districtBoundary, setDistrictBoundary] = useState<
    GeoJSON.FeatureCollection | GeoJSON.Feature | null
  >(null);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleValidationComplete = (result: ValidationResult) => {
    // Update map with validation results
    const { coordinates, boundary } = result;
    if (!coordinates) return;
    setMarkerPosition([coordinates.latitude, coordinates.longitude]);
    setMapCenter([coordinates.latitude, coordinates.longitude]);
    setMapZoom(12);

    if (boundary) {
      setDistrictBoundary(boundary as GeoJSON.FeatureCollection | GeoJSON.Feature);
    }
  };

  const fetchDistrictBoundary = async (ssdd: string) => {
    setBoundaryLoading(true);
    setBoundaryError(null);
    try {
      const response = await fetch(`/api/ssdd-validator/districts/${ssdd}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to load district boundary (${response.status})`);
      }
      const data = await response.json();
      if (data && data.boundary) {
        setDistrictBoundary(data.boundary);
      } else {
        setDistrictBoundary(null);
      }
    } catch (err: any) {
      console.error('Failed to load district boundary:', err);
      setBoundaryError(err?.message || 'Failed to load district boundary');
    } finally {
      setBoundaryLoading(false);
    }
  };

  const handleViewAddressOnMap = async (item: AddressHistoryItem) => {
    // Switch to validator tab to show map
    setCurrentTab(0);
    await fetchDistrictBoundary(item.ssdd);

    // Note: We don't have coordinates in history, so just center on district
    setMarkerPosition(null);
    setMapCenter(undefined);
    setMapZoom(undefined);
  };

  const handleViewDistrictOnMap = async (district: DistrictInfo) => {
    // Switch to validator tab to show map
    setCurrentTab(0);
    await fetchDistrictBoundary(district.ssdd);

    // Clear marker
    setMarkerPosition(null);
    setMapCenter(undefined);
    setMapZoom(undefined);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="SSDD Validator tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<SearchIcon />} label="Validator" />
          <Tab icon={<HistoryIcon />} label="History" />
          <Tab icon={<MapIcon />} label="Districts" />
          {isAdmin && <Tab icon={<SettingsIcon />} label="Settings" />}
        </Tabs>
      </Paper>

      {/* Validator Tab */}
      <TabPanel value={currentTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={5}>
            <AddressValidatorForm onValidationComplete={handleValidationComplete} />
          </Grid>
          <Grid item xs={12} lg={7}>
            <Box position="relative">
              {boundaryLoading && (
                <Box position="absolute" top={8} right={8} zIndex={2}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {boundaryError && (
                <Box mb={1}>
                  <Alert severity="error">{boundaryError}</Alert>
                </Box>
              )}
              <DistrictMap
                center={mapCenter}
                zoom={mapZoom}
                districtBoundary={districtBoundary}
                markerPosition={markerPosition}
                height={600}
              />
            </Box>
          </Grid>
        </Grid>
      </TabPanel>

      {/* History Tab */}
      <TabPanel value={currentTab} index={1}>
        <AddressHistory onViewOnMap={handleViewAddressOnMap} />
      </TabPanel>

      {/* Districts Tab */}
      <TabPanel value={currentTab} index={2}>
        <DistrictList onViewOnMap={handleViewDistrictOnMap} />
      </TabPanel>

      {/* Settings Tab (Admin only) */}
      {isAdmin && (
        <TabPanel value={currentTab} index={3}>
          <SettingsPanel />
        </TabPanel>
      )}
    </Container>
  );
};

export default ValidatorPage;


