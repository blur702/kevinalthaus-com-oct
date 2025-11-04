/**
 * Blog Frontend Types
 * Shared type definitions for blog plugin frontend components
 */

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'scheduled';
  author_display_name?: string;
  author_email: string;
  created_at: string;
  published_at?: string;
  reading_time_minutes?: number;
}

export interface BlogPost extends BlogPostSummary {
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string[];
  allow_comments?: boolean;
  featured_image_id?: string;
  publish_at?: string;
}

export type BlogPostFormData = Omit<BlogPost, 'id' | 'slug' | 'author_email' | 'author_display_name' | 'created_at' | 'published_at'> & {
  id?: string;
  slug?: string;
};
