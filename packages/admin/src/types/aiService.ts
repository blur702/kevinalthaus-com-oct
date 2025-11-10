export interface AIServiceConfig {
  id: string;
  service_name: string;
  api_key_vault_path?: string;
  enabled: boolean;
  settings: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
  api_key_configured: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

export interface AIPromptCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  children?: AIPromptCategory[];
}

export interface AIPrompt {
  id: string;
  title: string;
  content: string;
  category_id?: string;
  variables: string[];
  metadata: Record<string, unknown>;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  category_name?: string;
}

export interface PromptsListResponse {
  prompts: AIPrompt[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateServiceRequest {
  api_key?: string;
  enabled?: boolean;
  settings?: Record<string, unknown>;
}

export interface CreatePromptRequest {
  title: string;
  content: string;
  category_id?: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
  is_favorite?: boolean;
}

export interface UpdatePromptRequest {
  title?: string;
  content?: string;
  category_id?: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
  is_favorite?: boolean;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parent_id?: string;
  sort_order?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  parent_id?: string;
  sort_order?: number;
}
