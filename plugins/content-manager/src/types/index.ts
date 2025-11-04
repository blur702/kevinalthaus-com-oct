/**
 * Content Manager Plugin Type Definitions
 */

// Import and re-export shared taxonomy types
import type { Category, Tag } from '@monorepo/taxonomy';
export type { Category, Tag };

export type ContentStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export type MediaType = 'image' | 'document' | 'video' | 'audio' | 'archive' | 'other';

export interface Content {
  id: string;
  title: string;
  slug: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  featured_image_id?: string;
  status: ContentStatus;
  publish_at?: Date;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
  deleted_at?: Date;
  deleted_by?: string;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version_number: number;
  title: string;
  slug: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  status: ContentStatus;
  change_summary?: string;
  created_at: Date;
  created_by: string;
}

export interface Media {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  storage_path: string;
  media_type: MediaType;
  width?: number;
  height?: number;
  duration?: number;
  alt_text?: string;
  caption?: string;
  content_id?: string;
  uploaded_by: string;
  created_at: Date;
  deleted_at?: Date;
  deleted_by?: string;
}

export interface AllowedFileType {
  id: string;
  mime_type: string;
  file_extension: string;
  category: string;
  description?: string;
  max_file_size?: number;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
}

export interface ContentWithRelations extends Content {
  categories?: Category[];
  tags?: Tag[];
  featured_image?: Media;
  media?: Media[];
}

export interface CreateContentInput {
  title: string;
  slug?: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  featured_image_id?: string;
  status?: ContentStatus;
  publish_at?: Date;
  category_ids?: string[];
  tag_ids?: string[];
}

export interface UpdateContentInput extends Partial<CreateContentInput> {
  change_summary?: string;
}

export interface ContentListFilters {
  status?: ContentStatus;
  category_id?: string;
  tag_id?: string;
  search?: string;
  created_by?: string;
  from_date?: Date;
  to_date?: Date;
}

export interface ContentListOptions {
  page?: number;
  page_size?: number;
  sort_by?: 'created_at' | 'updated_at' | 'published_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

export interface MediaUploadOptions {
  content_id?: string;
  alt_text?: string;
  caption?: string;
}

export interface FileTypeValidationResult {
  allowed: boolean;
  max_size?: number;
  reason?: string;
}
