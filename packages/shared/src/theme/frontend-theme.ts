export interface FrontendTheme {
  name: string;
  version: string;
  author: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  components?: ThemeComponents;
  customProperties?: Record<string, string>;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent?: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    disabled?: string;
  };
  error: string;
  warning: string;
  info: string;
  success: string;
  border?: string;
  divider?: string;
}

export interface ThemeTypography {
  fontFamily: {
    base: string;
    heading?: string;
    monospace?: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeSpacing {
  unit: number;
  scale: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
}

export interface ThemeComponents {
  button?: ComponentTheme;
  input?: ComponentTheme;
  card?: ComponentTheme;
  modal?: ComponentTheme;
  [componentName: string]: ComponentTheme | undefined;
}

export interface ComponentTheme {
  baseStyles?: Record<string, string | number>;
  variants?: Record<string, Record<string, string | number>>;
  sizes?: Record<string, Record<string, string | number>>;
}

export interface ThemeOverride {
  colors?: Partial<ThemeColors>;
  typography?: Partial<ThemeTypography>;
  spacing?: Partial<ThemeSpacing>;
  components?: Partial<ThemeComponents>;
  customProperties?: Record<string, string>;
}

export type ThemeModeVariant = 'light' | 'dark' | 'auto';

export interface ThemeConfig {
  defaultMode: ThemeModeVariant;
  allowUserOverride: boolean;
  storageKey: string;
}
