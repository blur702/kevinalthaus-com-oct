// Settings management API service layer

import api from '../lib/api';

const BASE_URL = '/settings';

// TypeScript interfaces for settings
export interface SiteSettings {
  site_name: string;
  site_description: string;
  site_url: string;
  timezone: string;
  language: string;
}

export interface SecuritySettings {
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  require_2fa: boolean;
}

export interface EmailSettings {
  email_provider?: 'smtp' | 'brevo';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_password?: string; // Optional for updates
  brevo_api_key?: string; // Optional for updates
  brevo_api_key_configured?: boolean; // Read-only, indicates if key is set
  brevo_from_email?: string;
  brevo_from_name?: string;
}

export interface ExternalApiSettings {
  google_maps_api_key?: string;
  google_maps_api_key_configured?: boolean;
  usps_api_key?: string;
  usps_api_key_configured?: boolean;
  census_gov_api_key?: string;
  census_gov_api_key_configured?: boolean;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: string[];
  expires_at?: string;
}

export interface CreateApiKeyResponse extends ApiKey {
  key: string; // Full key - only returned once
}

export interface TestEmailResponse {
  success: boolean;
  message: string;
}

/**
 * Get site configuration settings
 */
export async function getSiteSettings(signal?: AbortSignal): Promise<SiteSettings> {
  const response = await api.get<SiteSettings>(`${BASE_URL}/site`, { signal });
  return response.data;
}

/**
 * Update site configuration settings
 */
export async function updateSiteSettings(data: Partial<SiteSettings>): Promise<SiteSettings> {
  const response = await api.put<SiteSettings>(`${BASE_URL}/site`, data);
  return response.data;
}

/**
 * Get security settings
 */
export async function getSecuritySettings(signal?: AbortSignal): Promise<SecuritySettings> {
  const response = await api.get<SecuritySettings>(`${BASE_URL}/security`, { signal });
  return response.data;
}

/**
 * Update security settings
 */
export async function updateSecuritySettings(data: Partial<SecuritySettings>): Promise<SecuritySettings> {
  const response = await api.put<SecuritySettings>(`${BASE_URL}/security`, data);
  return response.data;
}

/**
 * Get email settings
 */
export async function getEmailSettings(signal?: AbortSignal): Promise<EmailSettings> {
  const response = await api.get<EmailSettings>(`${BASE_URL}/email`, { signal });
  return response.data;
}

/**
 * Update email settings
 */
export async function updateEmailSettings(data: Partial<EmailSettings>): Promise<EmailSettings> {
  const response = await api.put<EmailSettings>(`${BASE_URL}/email`, data);
  return response.data;
}

/**
 * Test email settings by sending a test email
 */
export async function testEmailSettings(): Promise<TestEmailResponse> {
  const response = await api.post<TestEmailResponse>(`${BASE_URL}/email/test`);
  return response.data;
}

/**
 * Get list of API keys
 */
export async function getApiKeys(signal?: AbortSignal): Promise<ApiKey[]> {
  const response = await api.get<{ api_keys: ApiKey[] }>(`${BASE_URL}/api-keys`, { signal });
  return response.data.api_keys;
}

/**
 * Create a new API key
 */
export async function createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
  const response = await api.post<CreateApiKeyResponse>(`${BASE_URL}/api-keys`, data);
  return response.data;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/api-keys/${encodeURIComponent(id)}`);
}

/**
 * Get external API settings
 */
export async function getExternalApiSettings(signal?: AbortSignal): Promise<ExternalApiSettings> {
  const response = await api.get<ExternalApiSettings>(`${BASE_URL}/external-apis`, { signal });
  return response.data;
}

/**
 * Update external API settings
 */
export async function updateExternalApiSettings(data: Partial<ExternalApiSettings>): Promise<ExternalApiSettings> {
  const response = await api.put<ExternalApiSettings>(`${BASE_URL}/external-apis`, data);
  return response.data;
}
