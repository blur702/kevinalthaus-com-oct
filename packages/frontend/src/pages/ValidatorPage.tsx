/**
 * ValidatorPage - Wrapper for SSDD Validator Plugin
 *
 * Features:
 * - Imports ValidatorPage from plugin directory
 * - Includes Leaflet CSS for map functionality
 * - Passes user role for admin features
 */

import React from 'react';
import { ValidatorPage as PluginValidatorPage } from '../../../../plugins/ssdd-validator/frontend/src';
import { useAuth } from '../contexts/AuthContext';

// Import Leaflet CSS for map components
import 'leaflet/dist/leaflet.css';

const ValidatorPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return <PluginValidatorPage isAdmin={isAdmin} />;
};

export default ValidatorPage;
