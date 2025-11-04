/**
 * Shared Taxonomy Types
 */

export interface Category {
  id: string;
  namespace: string;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: string | null;
  display_order: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string | null;
}

export interface Tag {
  id: string;
  namespace: string;
  name: string;
  slug: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  created_by: string;
}

export interface EntityCategory {
  namespace: string;
  entity_id: string;
  category_id: string;
  created_at: Date;
}

export interface EntityTag {
  namespace: string;
  entity_id: string;
  tag_id: string;
  created_at: Date;
}

export interface CreateCategoryInput {
  namespace: string;
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string;
  display_order?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  parent_id?: string;
  display_order?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateTagInput {
  namespace: string;
  name: string;
  slug?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTagInput {
  name?: string;
  slug?: string;
  metadata?: Record<string, unknown>;
}

export interface CategoryTree extends Category {
  children?: CategoryTree[];
  level?: number;
}

export interface TaxonomyQueryOptions {
  namespace?: string;
  parent_id?: string | null;
  search?: string;
  page?: number;
  page_size?: number;
  sort?: 'name' | 'created_at' | 'display_order';
  direction?: 'ASC' | 'DESC';
}
