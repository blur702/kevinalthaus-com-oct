import api from '../lib/api';
import type {
  AIServiceConfig,
  AIPromptCategory,
  AIPrompt,
  PromptsListResponse,
  CreateServiceRequest,
  CreatePromptRequest,
  UpdatePromptRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../types/aiService';
import { asArray, asNumber } from '../lib/dataNormalization';

// ============================================================================
// AI Service Configuration APIs
// ============================================================================

export async function listAIServices(signal?: AbortSignal): Promise<AIServiceConfig[]> {
  const response = await api.get<AIServiceConfig[]>('/ai/services', { signal });
  return asArray<AIServiceConfig>(response.data, { feature: 'AIServicesService', field: 'services' });
}

export async function getAIService(
  serviceName: string,
  signal?: AbortSignal
): Promise<AIServiceConfig> {
  const response = await api.get<AIServiceConfig>(
    `/ai/services/${encodeURIComponent(serviceName)}`,
    { signal }
  );
  return response.data;
}

export async function updateAIService(
  serviceName: string,
  data: CreateServiceRequest
): Promise<{ message: string }> {
  const response = await api.put<{ message: string }>(
    `/ai/services/${encodeURIComponent(serviceName)}`,
    data
  );
  return response.data;
}

export async function testAIService(
  serviceName: string
): Promise<{ configured: boolean; message: string }> {
  const response = await api.post<{ configured: boolean; message: string }>(
    `/ai/services/${encodeURIComponent(serviceName)}/test`,
    {}
  );
  return response.data;
}

// ============================================================================
// Prompt Category APIs
// ============================================================================

export async function listCategories(signal?: AbortSignal): Promise<AIPromptCategory[]> {
  const response = await api.get<AIPromptCategory[]>('/ai/prompts/categories', { signal });
  return asArray<AIPromptCategory>(response.data, { feature: 'AIServicesService', field: 'categories' });
}

export async function createCategory(data: CreateCategoryRequest): Promise<AIPromptCategory> {
  const response = await api.post<AIPromptCategory>('/ai/prompts/categories', data);
  return response.data;
}

export async function updateCategory(
  id: string,
  data: UpdateCategoryRequest
): Promise<{ message: string }> {
  const response = await api.put<{ message: string }>(
    `/ai/prompts/categories/${encodeURIComponent(id)}`,
    data
  );
  return response.data;
}

export async function deleteCategory(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(
    `/ai/prompts/categories/${encodeURIComponent(id)}`
  );
  return response.data;
}

// ============================================================================
// Prompt Library APIs
// ============================================================================

export interface ListPromptsParams {
  page?: number;
  limit?: number;
  category_id?: string;
  search?: string;
  is_favorite?: boolean;
}

export async function listPrompts(
  params: ListPromptsParams = {},
  signal?: AbortSignal
): Promise<PromptsListResponse> {
  const response = await api.get<PromptsListResponse>('/ai/prompts', {
    params,
    signal,
  });
  return {
    prompts: asArray<AIPrompt>(response.data.prompts, { feature: 'AIServicesService', field: 'prompts' }).map(prompt => ({
      ...prompt,
      variables: asArray<string>(prompt.variables, { feature: 'AIServicesService', field: 'prompt.variables' }),
    })),
    total: asNumber(response.data.total, 0, { feature: 'AIServicesService', field: 'total' }),
    page: asNumber(response.data.page, 1, { feature: 'AIServicesService', field: 'page' }),
    limit: asNumber(response.data.limit, 10, { feature: 'AIServicesService', field: 'limit' }),
  };
}

export async function getPrompt(id: string, signal?: AbortSignal): Promise<AIPrompt> {
  const response = await api.get<AIPrompt>(`/ai/prompts/${encodeURIComponent(id)}`, { signal });
  return response.data;
}

export async function createPrompt(data: CreatePromptRequest): Promise<AIPrompt> {
  const response = await api.post<AIPrompt>('/ai/prompts', data);
  return response.data;
}

export async function updatePrompt(
  id: string,
  data: UpdatePromptRequest
): Promise<{ message: string }> {
  const response = await api.put<{ message: string }>(
    `/ai/prompts/${encodeURIComponent(id)}`,
    data
  );
  return response.data;
}

export async function deletePrompt(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(
    `/ai/prompts/${encodeURIComponent(id)}`
  );
  return response.data;
}

// ============================================================================
// Class-based API Export
// ============================================================================

/**
 * Class-based API client for AI Services.
 * Provides an object-oriented interface to all AI service operations.
 *
 * @example
 * ```typescript
 * // Use the singleton instance
 * const services = await aiServicesApi.listAIServices();
 *
 * // Or create a new instance
 * const customApi = new AIServicesAPI();
 * const prompts = await customApi.listPrompts({ page: 1, limit: 10 });
 * ```
 */
export class AIServicesAPI {
  // Service Configuration Methods
  async listAIServices(signal?: AbortSignal): Promise<AIServiceConfig[]> {
    return listAIServices(signal);
  }

  async getAIService(serviceName: string, signal?: AbortSignal): Promise<AIServiceConfig> {
    return getAIService(serviceName, signal);
  }

  async updateAIService(
    serviceName: string,
    data: CreateServiceRequest
  ): Promise<{ message: string }> {
    return updateAIService(serviceName, data);
  }

  async testAIService(serviceName: string): Promise<{ configured: boolean; message: string }> {
    return testAIService(serviceName);
  }

  // Category Methods
  async listCategories(signal?: AbortSignal): Promise<AIPromptCategory[]> {
    return listCategories(signal);
  }

  async createCategory(data: CreateCategoryRequest): Promise<AIPromptCategory> {
    return createCategory(data);
  }

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<{ message: string }> {
    return updateCategory(id, data);
  }

  async deleteCategory(id: string): Promise<{ message: string }> {
    return deleteCategory(id);
  }

  // Prompt Methods
  async listPrompts(
    params: ListPromptsParams = {},
    signal?: AbortSignal
  ): Promise<PromptsListResponse> {
    return listPrompts(params, signal);
  }

  async getPrompt(id: string, signal?: AbortSignal): Promise<AIPrompt> {
    return getPrompt(id, signal);
  }

  async createPrompt(data: CreatePromptRequest): Promise<AIPrompt> {
    return createPrompt(data);
  }

  async updatePrompt(id: string, data: UpdatePromptRequest): Promise<{ message: string }> {
    return updatePrompt(id, data);
  }

  async deletePrompt(id: string): Promise<{ message: string }> {
    return deletePrompt(id);
  }
}

/**
 * Singleton instance of the AI Services API client.
 * Use this for most operations to avoid creating multiple instances.
 */
export const aiServicesApi = new AIServicesAPI();
