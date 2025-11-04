/**
 * HTTP Service Implementation
 *
 * Provides HTTP client functionality for making external API requests.
 * Built on axios with retry logic, timeout handling, and request/response interceptors.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { IHttpService, HttpRequestOptions, HttpResponse } from '@monorepo/shared';

/**
 * HTTP Service
 * Wrapper around axios with enhanced features and monitoring
 */
export class HttpService implements IHttpService {
  public readonly name = 'http';
  private client: AxiosInstance | null = null;
  private initialized = false;

  constructor(private defaultTimeout = 30000) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('HttpService is already initialized');
    }

    // Create axios instance with defaults
    this.client = axios.create({
      timeout: this.defaultTimeout,
      headers: {
        'User-Agent': 'MonorepoApp/1.0',
      },
    });

    // Request interceptor (for logging, auth, etc.)
    this.client.interceptors.request.use(
      (config) => {
        // Log request in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor (for logging, error handling)
    this.client.interceptors.response.use(
      (response) => {
        // Log response in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[HTTP] ${response.status} ${response.config.url}`);
        }
        return response;
      },
      (error) => {
        // Log errors
        if (error.response) {
          console.error(`[HTTP] ${error.response.status} ${error.config?.url}`, error.response.data);
        } else if (error.request) {
          console.error(`[HTTP] No response received for ${error.config?.url}`);
        } else {
          console.error(`[HTTP] Request error:`, error.message);
        }
        return Promise.reject(error);
      }
    );

    this.initialized = true;
    console.log('[HttpService] ✓ Initialized');
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.client = null;
    this.initialized = false;
    console.log('[HttpService] ✓ Shut down');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized || !this.client) {
      return { healthy: false, message: 'Service not initialized' };
    }
    return { healthy: true };
  }

  async get<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }

    const axiosConfig = this.convertConfig(options);
    const response = await this.client.get<T>(url, axiosConfig);
    return this.convertResponse(response, options);
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }

    const axiosConfig = this.convertConfig(options);
    const response = await this.client.post<T>(url, data, axiosConfig);
    return this.convertResponse(response, options);
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }

    const axiosConfig = this.convertConfig(options);
    const response = await this.client.put<T>(url, data, axiosConfig);
    return this.convertResponse(response, options);
  }

  async patch<T = unknown>(
    url: string,
    data?: unknown,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }

    const axiosConfig = this.convertConfig(options);
    const response = await this.client.patch<T>(url, data, axiosConfig);
    return this.convertResponse(response, options);
  }

  async delete<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }

    const axiosConfig = this.convertConfig(options);
    const response = await this.client.delete<T>(url, axiosConfig);
    return this.convertResponse(response, options);
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }

    const axiosConfig = this.convertConfig(options);
    const response = await this.client.request<T>(axiosConfig);
    return this.convertResponse(response, options);
  }

  setDefaultHeader(key: string, value: string): void {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }
    this.client.defaults.headers.common[key] = value;
  }

  setBaseURL(url: string): void {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }
    this.client.defaults.baseURL = url;
  }

  addRequestInterceptor(
    interceptor: (config: HttpRequestOptions) => HttpRequestOptions | Promise<HttpRequestOptions>
  ): void {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }
    this.client.interceptors.request.use(async (config) => {
      const httpOptions: HttpRequestOptions = {
        headers: config.headers as unknown as Record<string, string>,
        params: config.params as Record<string, string | number | boolean>,
        timeout: config.timeout,
      };
      const updatedOptions = await interceptor(httpOptions);

      // Merge updated options back into axios config
      if (updatedOptions.headers) {
        config.headers = config.headers || {};
        Object.assign(config.headers, updatedOptions.headers);
      }
      if (updatedOptions.params) {
        config.params = updatedOptions.params;
      }
      if (updatedOptions.timeout) {
        config.timeout = updatedOptions.timeout;
      }

      return config;
    });
  }

  addResponseInterceptor<T>(
    interceptor: (response: HttpResponse<T>) => HttpResponse<T> | Promise<HttpResponse<T>>
  ): void {
    if (!this.client) {
      throw new Error('HttpService not initialized');
    }
    this.client.interceptors.response.use(async (response) => {
      const httpResponse: HttpResponse<T> = {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        config: {},
      };
      const updatedResponse = await interceptor(httpResponse);
      return { ...response, data: updatedResponse.data };
    });
  }

  // Helper methods

  private convertConfig(options?: HttpRequestOptions): AxiosRequestConfig {
    if (!options) {
      return {};
    }

    return {
      ...options,
      timeout: options.timeout,
      headers: options.headers,
      params: options.params,
      responseType: options.responseType as AxiosRequestConfig['responseType'],
    };
  }

  private convertResponse<T>(response: AxiosResponse<T>, options?: HttpRequestOptions): HttpResponse<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      config: options || {},
    };
  }
}
