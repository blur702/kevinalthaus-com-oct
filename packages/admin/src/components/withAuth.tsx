/**
 * withAuth Higher-Order Component
 *
 * Wrap any component to require authentication and/or specific permissions.
 * One-line auth protection for components.
 *
 * Usage:
 *   export default withAuth(MyComponent, { requireRole: 'admin' });
 *   export default withAuth(MyComponent, { requireCapability: 'content:edit' });
 *   export default withAuth(MyComponent); // Just auth, any role
 */

import React, { ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box, Alert } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export interface WithAuthOptions {
  /**
   * Require specific role(s). User must have one of these roles.
   */
  requireRole?: string | string[];

  /**
   * Require specific capability. User must have this capability.
   */
  requireCapability?: string;

  /**
   * Where to redirect if not authenticated
   */
  redirectTo?: string;

  /**
   * Show loading spinner while checking auth
   */
  showLoading?: boolean;
}

/**
 * HOC to wrap components with authentication requirements
 */
export function withAuth<P extends object>(
  Component: ComponentType<P>,
  options: WithAuthOptions = {}
): ComponentType<P> {
  const {
    requireRole,
    requireCapability,
    redirectTo = '/auth/login',
    showLoading = true,
  } = options;

  return function WithAuthComponent(props: P) {
    const { user, isAuthenticated, isLoading, hasRole, can } = useAuth();

    // Show loading state
    if (isLoading && showLoading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      );
    }

    // Check authentication
    if (!isAuthenticated || !user) {
      return <Navigate to={redirectTo} replace />;
    }

    // Check role requirement
    if (requireRole && !hasRole(requireRole)) {
      return (
        <Box p={3}>
          <Alert severity="error">
            You do not have permission to access this page.
            Required role: {Array.isArray(requireRole) ? requireRole.join(', ') : requireRole}
          </Alert>
        </Box>
      );
    }

    // Check capability requirement
    if (requireCapability && !can(requireCapability)) {
      return (
        <Box p={3}>
          <Alert severity="error">
            You do not have permission to access this page.
            Required capability: {requireCapability}
          </Alert>
        </Box>
      );
    }

    // All checks passed - render component
    return <Component {...props} />;
  };
}

/**
 * Example usage:
 *
 * // Admin-only page
 * function AdminSettings() {
 *   return <div>Admin Settings</div>;
 * }
 * export default withAuth(AdminSettings, { requireRole: 'admin' });
 *
 * // Any authenticated user
 * function Dashboard() {
 *   return <div>Dashboard</div>;
 * }
 * export default withAuth(Dashboard);
 *
 * // Specific capability
 * function EditContent() {
 *   return <div>Edit Content</div>;
 * }
 * export default withAuth(EditContent, { requireCapability: 'content:edit' });
 *
 * // Multiple roles (user must have ONE of these)
 * function ModeratorPanel() {
 *   return <div>Moderator Panel</div>;
 * }
 * export default withAuth(ModeratorPanel, { requireRole: ['admin', 'editor'] });
 */
