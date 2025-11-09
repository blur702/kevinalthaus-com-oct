/**
 * SSDD Validator Plugin - TypeScript Type Definitions
 */

// GeoJSON types - simplified for frontend use
export interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties?: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ValidationResult {
  success: boolean;
  standardizedAddress: Address;
  coordinates: Coordinates;
  ssdd: string;
  district: {
    state: string;
    districtNumber: number;
    representative?: {
      name: string;
      party: string;
      phone?: string;
      website?: string;
    };
  };
  boundary?: GeoJSONFeatureCollection | GeoJSONFeature;
}

export interface AddressHistoryItem {
  id: string;
  address: Address;
  ssdd: string;
  districtState: string;
  districtNumber: number;
  validatedAt: string;
}

export interface DistrictInfo {
  ssdd: string;
  state: string;
  districtNumber: number;
  representativeName?: string;
  representativeParty?: string;
  representativePhone?: string;
  representativeWebsite?: string;
}

export interface SettingsData {
  uspsApiKeyConfigured: boolean;
  lastMemberSync?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
