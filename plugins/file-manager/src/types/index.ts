/**
 * Type definitions for file-manager plugin
 */

// =============================================================================
// Enums
// =============================================================================

export type FolderType = 'root' | 'standard' | 'system';
export type PermissionType = 'read' | 'write' | 'delete' | 'share' | 'admin';
export type AccessAction = 'view' | 'download' | 'upload' | 'delete' | 'share' | 'permission_change';

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Folder interface representing a hierarchical folder structure
 */
export interface Folder {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  folder_type: FolderType;
  path: string;
  depth: number;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
}

/**
 * Folder with children (for hierarchical queries)
 */
export interface FolderWithChildren extends Folder {
  children?: FolderWithChildren[];
  file_count?: number;
}

/**
 * File-folder association (junction table record)
 */
export interface FileFolderAssociation {
  id: string;
  file_id: string;
  folder_id: string;
  added_by: string;
  added_at: Date;
  position: number | null;
}

/**
 * Folder permission record
 */
export interface FolderPermission {
  id: string;
  folder_id: string;
  user_id: string | null;
  role: string | null;
  permission_type: PermissionType;
  granted_by: string;
  granted_at: Date;
  expires_at: Date | null;
  inherit_to_children: boolean;
}

/**
 * File access log record
 */
export interface FileAccessLog {
  id: string;
  file_id: string | null;
  folder_id: string | null;
  user_id: string | null;
  action: AccessAction;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  accessed_at: Date;
}

/**
 * Batch operation request
 */
export interface BatchOperationRequest {
  file_ids?: string[];
  folder_ids?: string[];
  target_folder_id?: string | null;
  tags?: string[];
  operation?: 'add' | 'remove' | 'replace'; // For tag operations
  hard_delete?: boolean; // For delete operations
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  successful: string[];
  failed: Array<{ id: string; error: string }>;
  total: number;
}

/**
 * Create folder input
 */
export interface CreateFolderInput {
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
}

/**
 * Update folder input
 */
export interface UpdateFolderInput {
  name?: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
}

/**
 * File metadata (from public.files table)
 */
export interface FileMetadata {
  id: string;
  plugin_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  storage_path: string;
  storage_provider: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  alt_text: string | null;
  caption: string | null;
  tags: string[] | null;
  uploaded_by: string;
  created_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
}
