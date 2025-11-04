export enum BlogStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  SCHEDULED = 'scheduled',
  ARCHIVED = 'archived',
}

export enum PreviewTokenStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  author_id: string;
  reading_time_minutes?: number;
  allow_comments: boolean;
  comment_count: number;
  featured_image_id?: string;
  status: BlogStatus;
  publish_at?: Date;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
  deleted_at?: Date;
  deleted_by?: string;
}

export interface BlogPostVersion {
  id: string;
  blog_post_id: string;
  version_number: number;
  title: string;
  slug: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  status: BlogStatus;
  change_summary?: string;
  created_at: Date;
  created_by: string;
}

export interface AuthorProfile {
  user_id: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  website_url?: string;
  twitter_handle?: string;
  linkedin_url?: string;
  github_username?: string;
  social_links: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface BlogSeoMetadata {
  blog_post_id: string;
  og_title?: string;
  og_description?: string;
  og_image_url?: string;
  og_type: string;
  twitter_card_type: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image_url?: string;
  canonical_url?: string;
  robots_meta: string;
  structured_data?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface PreviewToken {
  id: string;
  blog_post_id: string;
  token: string;
  status: PreviewTokenStatus;
  expires_at: Date;
  created_by: string;
  created_at: Date;
  last_used_at?: Date;
}

// Request/Response types
export interface CreateBlogPostRequest {
  title: string;
  slug?: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  reading_time_minutes?: number;
  allow_comments?: boolean;
  featured_image_id?: string;
  status?: BlogStatus;
  publish_at?: string;
  category_ids?: string[];
  tag_ids?: string[];
  seo_metadata?: Partial<BlogSeoMetadata>;
}

export interface UpdateBlogPostRequest {
  title?: string;
  slug?: string;
  body_html?: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  reading_time_minutes?: number;
  allow_comments?: boolean;
  featured_image_id?: string;
  status?: BlogStatus;
  publish_at?: string;
  category_ids?: string[];
  tag_ids?: string[];
  seo_metadata?: Partial<BlogSeoMetadata>;
}

export interface BlogPostListResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface BlogPostDetailResponse extends BlogPost {
  author?: AuthorProfile;
  seo_metadata?: BlogSeoMetadata;
  categories?: Array<{ id: string; name: string; slug: string }>;
  tags?: Array<{ id: string; name: string; slug: string }>;
}

export interface CreateAuthorProfileRequest {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  website_url?: string;
  twitter_handle?: string;
  linkedin_url?: string;
  github_username?: string;
  social_links?: Record<string, string>;
}

export interface UpdateAuthorProfileRequest extends CreateAuthorProfileRequest {}

export interface GeneratePreviewTokenResponse {
  token: string;
  expires_at: Date;
  preview_url: string;
}
