// Browser-safe exports from shared package
// This entry point excludes server-only dependencies like bcrypt

// Export only types and browser-safe enums
export { Role, Capability } from './security/rbac-types';
export type {
  User,
  BaseEntity,
  ApiResponse,
  Result,
} from './types';

// Export browser-safe utilities
export type { PluginManifest, PluginMetadata } from './plugin';
export * from './theme';
export * from './constants';

// Export components
export { RichTextEditor } from './components/editor/RichTextEditor';
export type { RichTextEditorProps } from './components/editor/RichTextEditor';
export { TaxonomyField } from './components/TaxonomyField';
export type { TaxonomyFieldProps } from './components/TaxonomyField';
