import axios from 'axios';

const API_BASE_URL = '/api/themes';

export interface ThemeConfig {
  [key: string]: unknown;
}

export interface SaveThemeRequest {
  target: 'admin' | 'frontend' | 'both';
  config: ThemeConfig;
  css: string;
}

export interface ResetThemeRequest {
  target: 'admin' | 'frontend' | 'both';
}

export const getThemeConfig = async (): Promise<ThemeConfig> => {
  const response = await axios.get<ThemeConfig>(`${API_BASE_URL}/config`);
  return response.data;
};

export const saveTheme = async (request: SaveThemeRequest): Promise<{ message: string; cssPath: string }> => {
  const response = await axios.post(`${API_BASE_URL}/save`, request);
  return response.data;
};

export const resetTheme = async (request: ResetThemeRequest): Promise<{ message: string }> => {
  const response = await axios.post(`${API_BASE_URL}/reset`, request);
  return response.data;
};
