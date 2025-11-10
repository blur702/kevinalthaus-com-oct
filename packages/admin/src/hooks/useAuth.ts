/**
 * useAuth Hook
 *
 * One-line authentication for any React component.
 * Provides user info, role, and permission checking.
 *
 * Usage:
 *   const { user, isAuthenticated, hasRole, can } = useAuth();
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContext extends AuthState {
  hasRole: (role: string | string[]) => boolean;
  can: (capability: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// Capability mapping by role
const ROLE_CAPABILITIES: Record<string, string[]> = {
  admin: ['user:view', 'user:edit', 'user:delete', 'content:view', 'content:edit', 'content:delete', 'settings:view', 'settings:edit'],
  editor: ['content:view', 'content:edit', 'user:view'],
  viewer: ['content:view'],
};

export function useAuth(): AuthContext {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });
  const navigate = useNavigate();

  // Check if user has specific role(s)
  const hasRole = useCallback((role: string | string[]): boolean => {
    if (!authState.user) {return false;}

    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(authState.user.role);
  }, [authState.user]);

  // Check if user has specific capability
  const can = useCallback((capability: string): boolean => {
    if (!authState.user) {return false;}

    const userCapabilities = ROLE_CAPABILITIES[authState.user.role] || [];
    return userCapabilities.includes(capability);
  }, [authState.user]);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await api.get('/api/auth/me');

      setAuthState({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Not authenticated',
      });
    }
  }, []);

  // Login
  const login = useCallback(async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await api.post('/api/auth/login', { email, password });

      setAuthState({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      navigate('/');
    } catch (error: any) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.response?.data?.message || 'Login failed',
      });
      throw error;
    }
  }, [navigate]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      navigate('/auth/login');
    }
  }, [navigate]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    ...authState,
    hasRole,
    can,
    login,
    logout,
    checkAuth,
  };
}

/**
 * Example usage:
 *
 * function MyComponent() {
 *   const { user, isAuthenticated, hasRole, can } = useAuth();
 *
 *   if (!isAuthenticated) return <div>Please login</div>;
 *   if (!hasRole('admin')) return <div>Admin only</div>;
 *   if (!can('content:edit')) return <div>No permission</div>;
 *
 *   return <div>Welcome {user.username}!</div>;
 * }
 */
