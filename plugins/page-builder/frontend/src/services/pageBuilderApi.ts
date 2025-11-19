import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  Page,
  PageLayout,
  Template,
  ReusableBlock,
  WidgetRegistryEntry,
} from '../../../src/types';
import type {
  ApiResponse,
  PageFilterOptions,
  PaginationOptions,
} from '../types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PAGE_BUILDER_API_URL) ||
  '/api/page-builder';

const DEFAULT_TIMEOUT = 60000;

const methodsRequiringCsrf = new Set(['post', 'put', 'patch', 'delete']);

const publicEndpoints = ['/auth/login', '/auth/csrf-token'];

let csrfTokenCache: string | null = null;

function readCsrfTokenFromDom(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  if (meta?.content) {
    return meta.content;
  }

  const bodyAttr = document.body?.dataset?.csrfToken ?? document.body?.getAttribute('data-csrf-token');
  return bodyAttr ?? null;
}

function getCSRFToken(): string | null {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }
  const domToken = readCsrfTokenFromDom();
  if (domToken) {
    csrfTokenCache = domToken;
  }
  return csrfTokenCache;
}

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: DEFAULT_TIMEOUT,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    const method = config.method?.toLowerCase() ?? 'get';
    const needsToken =
      methodsRequiringCsrf.has(method) &&
      !publicEndpoints.some((endpoint) => config.url?.startsWith(endpoint));

    if (needsToken) {
      const csrf = getCSRFToken();
      if (csrf) {
        config.headers = config.headers ?? {};
        config.headers['X-CSRF-Token'] = csrf;
      }
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const headerToken = response.headers?.['x-csrf-token'];
      if (typeof headerToken === 'string' && headerToken) {
        csrfTokenCache = headerToken;
      }
      return response;
    },
    (error) => {
      const headerToken = error.response?.headers?.['x-csrf-token'];
      if (typeof headerToken === 'string' && headerToken) {
        csrfTokenCache = headerToken;
      }
      return Promise.reject(error);
    },
  );

  return client;
}

const api = createClient();

type PaginatedResponse<T> = ApiResponse<T[]> & {
  total: number;
  limit: number;
  offset: number;
};

type WidgetResponse = ApiResponse<{
  widgets: WidgetRegistryEntry[];
  total: number;
  categories: string[];
  version: string;
}>;

function buildParams(options?: Record<string, unknown>) {
  const params: Record<string, unknown> = {};
  if (!options) {
    return params;
  }
  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params[key] = value;
  });
  return params;
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const { data } = await api.request<T>(config);
  return data;
}

export async function fetchPages(
  options: Partial<PageFilterOptions> = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<Page>> {
  return request<PaginatedResponse<Page>>({
    method: 'GET',
    url: '/pages',
    signal,
    params: buildParams(options),
  });
}

export async function fetchPageById(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<Page>> {
  return request<ApiResponse<Page>>({
    method: 'GET',
    url: `/pages/${encodeURIComponent(id)}`,
    signal,
  });
}

export async function createPage(
  data: Partial<Page>,
): Promise<ApiResponse<Page>> {
  return request<ApiResponse<Page>>({
    method: 'POST',
    url: '/pages',
    data,
  });
}

export async function updatePage(
  id: string,
  data: Partial<Page>,
): Promise<ApiResponse<Page>> {
  return request<ApiResponse<Page>>({
    method: 'PUT',
    url: `/pages/${encodeURIComponent(id)}`,
    data,
  });
}

export async function deletePage(id: string): Promise<ApiResponse<void>> {
  return request<ApiResponse<void>>({
    method: 'DELETE',
    url: `/pages/${encodeURIComponent(id)}`,
  });
}

export async function fetchPageVersions(
  id: string,
  signal?: AbortSignal,
): Promise<ApiResponse<PageLayout[]>> {
  return request<ApiResponse<PageLayout[]>>({
    method: 'GET',
    url: `/pages/${encodeURIComponent(id)}/versions`,
    signal,
  });
}

export async function fetchTemplates(
  category?: string,
  options: Partial<PaginationOptions> = {},
  signal?: AbortSignal,
): Promise<ApiResponse<Template[]>> {
  return request<ApiResponse<Template[]>>({
    method: 'GET',
    url: '/templates',
    signal,
    params: buildParams({ category, ...options }),
  });
}

export async function createTemplate(
  data: Partial<Template>,
): Promise<ApiResponse<Template>> {
  return request<ApiResponse<Template>>({
    method: 'POST',
    url: '/templates',
    data,
  });
}

export async function fetchReusableBlocks(
  category?: string,
  signal?: AbortSignal,
): Promise<ApiResponse<ReusableBlock[]>> {
  return request<ApiResponse<ReusableBlock[]>>({
    method: 'GET',
    url: '/reusable-blocks',
    signal,
    params: buildParams({ category }),
  });
}

export async function createReusableBlock(
  data: Partial<ReusableBlock>,
): Promise<ApiResponse<ReusableBlock>> {
  return request<ApiResponse<ReusableBlock>>({
    method: 'POST',
    url: '/reusable-blocks',
    data,
  });
}

export async function fetchWidgets(
  category?: string,
  signal?: AbortSignal,
): Promise<WidgetResponse> {
  const response = await request<ApiResponse<{
    widgets: WidgetRegistryEntry[];
    total: number;
    categories: string[];
    version: string;
  }>>({
    method: 'GET',
    url: '/widgets',
    signal,
    params: buildParams({ category }),
  });

  const data = response.data ?? {
    widgets: [],
    total: 0,
    categories: [],
    version: 'unknown',
  };

  return {
    success: response.success,
    data,
  };
}

export async function fetchWidgetByType(
  type: string,
  signal?: AbortSignal,
): Promise<ApiResponse<WidgetRegistryEntry>> {
  return request<ApiResponse<WidgetRegistryEntry>>({
    method: 'GET',
    url: `/widgets/${encodeURIComponent(type)}`,
    signal,
  });
}

export default {
  fetchPages,
  fetchPageById,
  createPage,
  updatePage,
  deletePage,
  fetchPageVersions,
  fetchTemplates,
  createTemplate,
  fetchReusableBlocks,
  createReusableBlock,
  fetchWidgets,
  fetchWidgetByType,
};
