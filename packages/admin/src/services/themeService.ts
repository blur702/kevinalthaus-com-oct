import axios from 'axios';

const API_BASE_URL = '/api/themes';

export type PaletteModeOption = 'light' | 'dark';

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2';

export interface PaletteSection {
  main?: string;
  light?: string;
  dark?: string;
  contrastText?: string;
}

export interface BackgroundPalette {
  default?: string;
  paper?: string;
}

export interface TextPalette {
  primary?: string;
  secondary?: string;
  disabled?: string;
}

export interface TypographyScale {
  fontSize?: string;
  fontWeight?: number;
  lineHeight?: number;
}

export type ThemeTypography = Partial<Record<TypographyVariant, TypographyScale>> & {
  fontFamily?: string;
};

export interface ThemeConfig {
  palette?: {
    mode?: PaletteModeOption;
    primary?: PaletteSection;
    secondary?: PaletteSection;
    error?: PaletteSection;
    warning?: PaletteSection;
    info?: PaletteSection;
    success?: PaletteSection;
    background?: BackgroundPalette;
    text?: TextPalette;
  };
  typography?: ThemeTypography;
  spacing?: number;
  shape?: {
    borderRadius?: number;
  };
  customCSS?: string;
}

export interface SaveThemeRequest {
  target: 'admin' | 'frontend' | 'both';
  config: ThemeConfig;
  css: string;
}

export interface ResetThemeRequest {
  target: 'admin' | 'frontend' | 'both';
}

/**
 * Fetches the stored theme configuration for the current tenant.
 * Returns the serialized theme object from the backend.
 */
export const getThemeConfig = async (): Promise<ThemeConfig> => {
  const response = await axios.get<ThemeConfig>(`${API_BASE_URL}/config`);
  return response.data;
};

/**
 * Persists a new theme configuration and CSS bundle for the requested target(s).
 * Returns the API acknowledgement along with the published CSS path.
 */
export const saveTheme = async (request: SaveThemeRequest): Promise<{ message: string; cssPath: string }> => {
  const response = await axios.post(`${API_BASE_URL}/save`, request);
  return response.data;
};

/**
 * Restores the default theme for the specified target(s).
 * Returns the API acknowledgement message after the reset completes.
 */
export const resetTheme = async (request: ResetThemeRequest): Promise<{ message: string }> => {
  const response = await axios.post(`${API_BASE_URL}/reset`, request);
  return response.data;
};
