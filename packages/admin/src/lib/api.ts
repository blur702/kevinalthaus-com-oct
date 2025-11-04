// Centralized axios API client configured for cookie-based auth

import axios from 'axios';

// Base URL configuration - use environment variable or default to /api
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Timeout configuration - longer timeout for file uploads
const DEFAULT_TIMEOUT = 60000; // 60 seconds default timeout
const UPLOAD_TIMEOUT = 300000; // 5 minutes for large file uploads

// TypeScript interfaces for API responses
export interface ApiErrorResponse {
  error: string;
  message: string;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

// Helper: Get CSRF token from cookie
function getCSRFToken(): string | null {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Fetch CSRF token from server after authentication
export async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await api.get('/auth/csrf-token');
    return response.data.csrfToken || null;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
}

// Create axios instance that sends cookies with requests
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: DEFAULT_TIMEOUT, // Configurable timeout to prevent hanging requests
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: Attach CSRF token to state-changing requests
api.interceptors.request.use(
  (config) => {
    // Attach CSRF token for POST, PUT, PATCH, DELETE requests
    const methodsRequiringCSRF = ['post', 'put', 'patch', 'delete'];

    // Exclude public endpoints that don't need CSRF protection
    const publicEndpoints = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => config.url?.includes(endpoint));

    if (config.method && methodsRequiringCSRF.includes(config.method.toLowerCase()) && !isPublicEndpoint) {
      const csrfToken = getCSRFToken();

      if (csrfToken) {
        // Attach CSRF token as header
        config.headers['X-CSRF-Token'] = csrfToken;
      } else {
        console.warn('CSRF token not found for state-changing request');
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle CSRF token refresh
api.interceptors.response.use(
  (response) => {
    // Check if server sent a new CSRF token in response headers
    const newToken = response.headers['x-csrf-token'];

    if (newToken) {
      // CSRF token is automatically updated via Set-Cookie header
      // No action needed here, just log for debugging
      console.debug('CSRF token refreshed from server');
    }

    return response;
  },
  (error) => {
    // Handle 403 CSRF token errors specifically
    if (error.response?.status === 403 && error.response?.data?.error === 'Invalid CSRF token') {
      console.error('CSRF token validation failed. Please refresh the page.');

      // Optionally: Show a user-friendly error message or auto-refresh
      // window.location.reload(); // Uncomment to auto-reload on CSRF failure
    }

    return Promise.reject(error);
  }
);

// Plugins API helpers
export interface PluginListResponse {
  plugins: Array<{
    id: string;
    name: string;
    version?: string;
    description?: string;
    status: 'installed' | 'active' | 'inactive' | 'error';
  }>;
}

export async function fetchPlugins(signal?: AbortSignal): Promise<PluginListResponse> {
  const { data } = await api.get<PluginListResponse>('/plugins', { signal });
  return data;
}

export async function installPlugin(id: string): Promise<void> {
  await api.post(`/plugins/${encodeURIComponent(id)}/install`);
}

export async function activatePlugin(id: string): Promise<void> {
  await api.post(`/plugins/${encodeURIComponent(id)}/activate`);
}

export async function deactivatePlugin(id: string): Promise<void> {
  await api.post(`/plugins/${encodeURIComponent(id)}/deactivate`);
}

export async function uninstallPlugin(id: string): Promise<void> {
  await api.post(`/plugins/${encodeURIComponent(id)}/uninstall`);
}

export interface UploadPluginOptions {
  manifestJson?: string; // JSON string
  signatureBase64?: string;
}

export async function uploadPluginPackage(file: File, options: UploadPluginOptions = {}): Promise<unknown> {
  const form = new FormData();
  form.append('package', file);
  if (options.manifestJson) {
    form.append('manifest', options.manifestJson);
  }
  if (options.signatureBase64) {
    form.append('signature', options.signatureBase64);
  }
  const response = await api.post<unknown>('/plugins/upload', form, {
    // Do not set Content-Type for FormData; let the browser/axios set the boundary
    timeout: UPLOAD_TIMEOUT, // Extended timeout for large file uploads
  });
  return response.data;
}

export default api;
