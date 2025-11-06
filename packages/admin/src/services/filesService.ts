/**
 * File Management API Service
 *
 * Client-side API service for file upload, management, and retrieval.
 * Used by the admin Files UI component.
 */

import api from '../lib/api';

// TypeScript interfaces for file management
export interface FileMetadata {
  id: string;
  pluginId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  storagePath: string;
  storageProvider: string;
  width?: number;
  height?: number;
  duration?: number;
  altText?: string;
  caption?: string;
  tags?: string[];
  uploadedBy: string;
  createdAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface FileListOptions {
  pluginId?: string;
  mimeType?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'filename' | 'file_size';
  orderDirection?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface FileListResult {
  files: FileMetadata[];
  total: number;
  limit: number;
  offset: number;
}

export interface FileUploadResult {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  storagePath: string;
  url: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface AllowedFileType {
  id: string;
  mimeType: string;
  fileExtension: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
  description?: string;
  maxFileSize?: number;
  isEnabled: boolean;
}

export interface UploadOptions {
  pluginId: string;
  generateThumbnail?: boolean;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  quality?: number;
}

export interface BulkUploadOptions {
  pluginId: string;
  generateThumbnails?: boolean;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  quality?: number;
  continueOnError?: boolean;
}

export interface BulkUploadResult {
  successful: FileUploadResult[];
  failed: Array<{ filename: string; error: string }>;
  total: number;
}

/**
 * List files with filters and pagination
 */
export async function listFiles(
  options: FileListOptions = {},
  signal?: AbortSignal
): Promise<FileListResult> {
  const params = new URLSearchParams();

  if (options.pluginId) params.append('pluginId', options.pluginId);
  if (options.mimeType) params.append('mimeType', options.mimeType);
  if (options.tags) params.append('tags', options.tags.join(','));
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.orderBy) params.append('orderBy', options.orderBy);
  if (options.orderDirection) params.append('orderDirection', options.orderDirection);
  if (options.includeDeleted) params.append('includeDeleted', 'true');

  const response = await api.get<FileListResult>(`/admin/files?${params.toString()}`, {
    signal,
  });

  return response.data;
}

/**
 * Get file metadata by ID
 */
export async function getFile(fileId: string, signal?: AbortSignal): Promise<FileMetadata> {
  const response = await api.get<FileMetadata>(`/admin/files/${fileId}`, { signal });
  return response.data;
}

/**
 * Upload a file
 */
export async function uploadFile(
  file: File,
  options: UploadOptions
): Promise<FileUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pluginId', options.pluginId);

  if (options.generateThumbnail !== undefined) {
    formData.append('generateThumbnail', options.generateThumbnail.toString());
  }
  if (options.thumbnailWidth) {
    formData.append('thumbnailWidth', options.thumbnailWidth.toString());
  }
  if (options.thumbnailHeight) {
    formData.append('thumbnailHeight', options.thumbnailHeight.toString());
  }
  if (options.quality) {
    formData.append('quality', options.quality.toString());
  }

  const response = await api.post<FileUploadResult>('/admin/files', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Upload multiple files at once (bulk upload)
 */
export async function bulkUploadFiles(
  files: File[],
  options: BulkUploadOptions
): Promise<BulkUploadResult> {
  const formData = new FormData();

  // Append all files with the same field name 'files'
  files.forEach((file) => {
    formData.append('files', file);
  });

  formData.append('pluginId', options.pluginId);

  if (options.generateThumbnails !== undefined) {
    formData.append('generateThumbnails', options.generateThumbnails.toString());
  }
  if (options.thumbnailWidth) {
    formData.append('thumbnailWidth', options.thumbnailWidth.toString());
  }
  if (options.thumbnailHeight) {
    formData.append('thumbnailHeight', options.thumbnailHeight.toString());
  }
  if (options.quality) {
    formData.append('quality', options.quality.toString());
  }
  if (options.continueOnError !== undefined) {
    formData.append('continueOnError', options.continueOnError.toString());
  }

  const response = await api.post<BulkUploadResult>('/admin/files/bulk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Update file metadata
 */
export async function updateFileMetadata(
  fileId: string,
  metadata: {
    altText?: string;
    caption?: string;
    tags?: string[];
  }
): Promise<FileMetadata> {
  const response = await api.patch<FileMetadata>(`/admin/files/${fileId}`, metadata);
  return response.data;
}

/**
 * Soft delete a file
 */
export async function deleteFile(fileId: string): Promise<void> {
  await api.delete(`/admin/files/${fileId}`);
}

/**
 * Permanently delete a file
 */
export async function hardDeleteFile(fileId: string): Promise<void> {
  await api.delete(`/admin/files/${fileId}/permanent`);
}

/**
 * Get list of allowed file types
 */
export async function getAllowedFileTypes(
  category?: string,
  signal?: AbortSignal
): Promise<AllowedFileType[]> {
  const params = category ? `?category=${category}` : '';
  const response = await api.get<{ allowedTypes: AllowedFileType[] }>(
    `/admin/files/allowed-types${params}`,
    { signal }
  );
  return response.data.allowedTypes;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file category from MIME type
 */
export function getCategoryFromMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/pdf')) return 'document';
  if (mimeType.startsWith('application/zip') || mimeType.startsWith('application/x-')) {
    return 'archive';
  }
  if (mimeType.startsWith('text/') || mimeType.includes('document') || mimeType.includes('word')) {
    return 'document';
  }
  return 'other';
}

/**
 * Get icon name for file type (for Material-UI icons)
 */
export function getFileIcon(mimeType: string): string {
  const category = getCategoryFromMimeType(mimeType);

  switch (category) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Movie';
    case 'audio':
      return 'AudioFile';
    case 'document':
      return 'Description';
    case 'archive':
      return 'Archive';
    default:
      return 'InsertDriveFile';
  }
}

// =============================================================================
// File Sharing
// =============================================================================

export interface FileShare {
  id: string;
  fileId: string;
  shareToken: string;
  createdBy: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  passwordHash: string | null;
  isActive: boolean;
  createdAt: string;
  lastAccessedAt: string | null;
}

export interface CreateShareOptions {
  expiresAt?: string;
  maxDownloads?: number;
  password?: string;
}

export interface ShareListResult {
  shares: FileShare[];
  total: number;
}

/**
 * Create a share link for a file
 */
export async function createFileShare(
  fileId: string,
  options: CreateShareOptions = {}
): Promise<FileShare> {
  const response = await api.post<FileShare>(`/admin/files/${fileId}/share`, options);
  return response.data;
}

/**
 * List all shares for a specific file
 */
export async function listFileShares(fileId: string): Promise<FileShare[]> {
  const response = await api.get<{ shares: FileShare[] }>(`/admin/files/${fileId}/shares`);
  return response.data.shares;
}

/**
 * List all shares created by the current user
 */
export async function listMyShares(options: {
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<ShareListResult> {
  const params = new URLSearchParams();
  if (options.includeInactive) params.append('includeInactive', 'true');
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());

  const response = await api.get<ShareListResult>(`/admin/shares?${params.toString()}`);
  return response.data;
}

/**
 * Update share settings
 */
export async function updateFileShare(
  shareId: string,
  updates: {
    expiresAt?: string | null;
    maxDownloads?: number | null;
    isActive?: boolean;
  }
): Promise<FileShare> {
  const response = await api.patch<FileShare>(`/admin/shares/${shareId}`, updates);
  return response.data;
}

/**
 * Revoke (deactivate) a share
 */
export async function revokeFileShare(shareId: string): Promise<void> {
  await api.delete(`/admin/shares/${shareId}`);
}

/**
 * Permanently delete a share
 */
export async function deleteFileShare(shareId: string): Promise<void> {
  await api.delete(`/admin/shares/${shareId}/permanent`);
}

/**
 * Generate public share URL
 */
export function getPublicShareUrl(shareToken: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${shareToken}`;
}

/**
 * Generate public share download URL
 */
export function getPublicShareDownloadUrl(shareToken: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${shareToken}/download`;
}

// =============================================================================
// File Versioning
// =============================================================================

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  checksum: string | null;
  createdBy: string;
  createdAt: string;
}

export interface FileVersionListResult {
  versions: FileVersion[];
  total: number;
}

/**
 * List all versions of a file
 */
export async function listFileVersions(
  fileId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<FileVersionListResult> {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());

  const queryString = params.toString();
  const url = `/admin/files/${fileId}/versions${queryString ? `?${queryString}` : ''}`;

  const response = await api.get<FileVersionListResult>(url);
  return response.data;
}

/**
 * Manually create a version of a file
 */
export async function createFileVersion(fileId: string): Promise<FileVersion> {
  const response = await api.post<FileVersion>(`/admin/files/${fileId}/versions`);
  return response.data;
}

/**
 * Restore a file to a specific version
 */
export async function restoreFileVersion(
  versionId: string,
  fileId: string
): Promise<{
  restoredVersion: FileVersion;
  newVersionOfCurrent: FileVersion;
}> {
  const response = await api.post(`/admin/versions/${versionId}/restore`, { fileId });
  return response.data;
}

/**
 * Delete a specific version
 */
export async function deleteFileVersion(versionId: string, fileId: string): Promise<void> {
  await api.delete(`/admin/versions/${versionId}?fileId=${fileId}`);
}

/**
 * Clean up old versions (apply retention policy)
 */
export async function cleanupOldVersions(
  fileId: string,
  keepCount: number = 10
): Promise<{ deletedCount: number }> {
  const response = await api.post<{ deletedCount: number }>(
    `/admin/files/${fileId}/versions/cleanup`,
    { keepCount }
  );
  return response.data;
}
