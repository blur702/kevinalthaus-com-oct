// Centralized axios API client configured for cookie-based auth

import axios from 'axios';

// Base URL configuration - use environment variable or default to /api
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// TypeScript interfaces for API responses
export interface ApiErrorResponse {
  error: string;
  message: string;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

// Create axios instance that sends cookies with requests
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export default api;
