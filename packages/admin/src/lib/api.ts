// Centralized axios API client configured for cookie-based auth

import axios from 'axios';

// Base URL configuration - use environment variable or default to /api
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// TypeScript interfaces for API responses
export interface ApiErrorResponse {
  error: string;
  message: string;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

// Create axios instance that sends cookies with requests
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Plugins API helpers
export interface PluginListResponse {
  plugins: Array<{
    id: string;
    name: string;
    version?: string;
    description?: string;
    status: 'installed' | 'active' | 'inactive' | 'error' | string;
  }>;
}

export async function fetchPlugins(signal?: AbortSignal): Promise<PluginListResponse> {
  const { data } = await api.get<PluginListResponse>('/api/plugins', { signal });
  return data;
}

export async function installPlugin(id: string): Promise<void> {
  await api.post(`/api/plugins/${encodeURIComponent(id)}/install`);
}

export async function activatePlugin(id: string): Promise<void> {
  await api.post(`/api/plugins/${encodeURIComponent(id)}/activate`);
}

export async function deactivatePlugin(id: string): Promise<void> {
  await api.post(`/api/plugins/${encodeURIComponent(id)}/deactivate`);
}

export async function uninstallPlugin(id: string): Promise<void> {
  await api.post(`/api/plugins/${encodeURIComponent(id)}/uninstall`);
}

export interface UploadPluginOptions {
  manifestJson?: string; // JSON string
  signatureBase64?: string;
}

export async function uploadPluginPackage(file: File, options: UploadPluginOptions = {}): Promise<unknown> {
  const form = new FormData();
  form.append('package', file);
  if (options.manifestJson) form.append('manifest', options.manifestJson);
  if (options.signatureBase64) form.append('signature', options.signatureBase64);
  const { data } = await api.post('/api/plugins/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export default api;
