/**
 * SSDD Validator Plugin - Frontend Entry Point
 *
 * Exports all components for integration with the main application
 */

// Components
export { default as AddressValidatorForm } from './components/AddressValidatorForm';
export { default as DistrictMap } from './components/DistrictMap';
export { default as SettingsPanel } from './components/SettingsPanel';
export { default as AddressHistory } from './components/AddressHistory';
export { default as DistrictList } from './components/DistrictList';

// Pages
export { default as ValidatorPage } from './pages/ValidatorPage';

// Types
export type {
  Address,
  Coordinates,
  ValidationResult,
  AddressHistoryItem,
  DistrictInfo,
  SettingsData,
  ApiError,
} from './types';
