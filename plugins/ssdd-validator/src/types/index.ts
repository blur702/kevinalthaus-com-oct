/**
 * TypeScript interfaces for SSDD Validator Plugin
 */

import type { Geometry } from 'geojson';

export interface Address {
  id: string;
  userId: string;
  originalStreet1: string;
  originalStreet2?: string;
  originalCity: string;
  originalState: string;
  originalZip: string;
  standardizedStreet1: string;
  standardizedStreet2?: string;
  standardizedCity: string;
  standardizedState: string;
  standardizedZip: string;
  standardizedZip4?: string;
  coordinates: { lat: number; lng: number };
  districtId?: string;
  validatedAt: Date;
  validationStatus: 'valid' | 'invalid' | 'alternative_suggested' | 'pending';
  validationSource?: string;
  alternativeAddresses?: AlternativeAddress[];
}

export interface AlternativeAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  zip4?: string;
}

export interface District {
  id: string;
  ssdd: string;
  state: string;
  districtNumber: string;
  name: string;
  boundary: Geometry;
  areaSquareKm?: number;
  centroid?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  representative?: Representative;
}

export interface Representative {
  id: string;
  districtId: string;
  ssdd: string;
  memberId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  party: string;
  state: string;
  districtNumber: string;
  officeAddress?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  committeeAssignments?: CommitteeAssignment[];
  leadershipPosition?: string;
  termStartDate?: string;
  termEndDate?: string;
  photoUrl?: string;
  bio?: string;
  lastSyncedAt: Date;
}

export interface CommitteeAssignment {
  name: string;
  role?: string;
  subcommittees?: string[];
}

export interface PluginSettings {
  uspsApiKeyConfigured: boolean;
  lastMemberSync?: Date;
  pythonServiceUrl: string;
}

export interface ValidateAddressRequest {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface ValidateAddressResponse {
  success: boolean;
  address?: Address;
  district?: District;
  representative?: Representative;
  error?: string;
  alternativeAddresses?: AlternativeAddress[];
}

export interface USPSValidationResponse {
  success: boolean;
  validated?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    zip4?: string;
  };
  alternatives?: AlternativeAddress[];
  error?: string;
}

export interface GeocodeResponse {
  success: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  error?: string;
}

export interface DistrictQueryResult {
  id: string;
  ssdd: string;
  state: string;
  district_number: string;
  name: string;
  boundary: string; // GeoJSON as text
  area_sq_km?: number;
  centroid?: string; // PostGIS point as text
  metadata?: Record<string, unknown>;
}

export interface MemberQueryResult {
  id: string;
  district_id: string;
  ssdd: string;
  member_id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  party: string;
  state: string;
  district_number: string;
  office_address?: string;
  phone?: string;
  email?: string;
  website_url?: string;
  twitter_handle?: string;
  facebook_url?: string;
  youtube_url?: string;
  committee_assignments?: CommitteeAssignment[];
  leadership_position?: string;
  term_start_date?: string;
  term_end_date?: string;
  photo_url?: string;
  bio?: string;
  raw_data?: Record<string, unknown>;
  last_synced_at: Date;
}

export interface KMLImportRequest {
  file: {
    originalname: string;
    buffer: Buffer;
    size: number;
    mimetype: string;
  };
  state: string;
  districtNumber: string;
}

export interface KMLImportResponse {
  success: boolean;
  district?: District;
  error?: string;
}

export interface SyncMembersResponse {
  success: boolean;
  syncedCount: number;
  errors?: string[];
  lastSyncedAt: Date;
}

