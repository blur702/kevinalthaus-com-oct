// Route guard component to protect admin routes from unauthenticated access

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute component that redirects to login if user is not authenticated
 * Preserves the current location for post-login redirect
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [authenticated, setAuthenticated] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let mounted = true;
    void isAuthenticated()
      .then((ok) => {
        if (mounted) setAuthenticated(ok);
      })
      .catch((err) => {
        if (import.meta.env && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('Auth check failed', err);
        } else {
          // eslint-disable-next-line no-console
          console.warn('Auth check failed');
        }
        if (mounted) setAuthenticated(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (authenticated === null) {
    // Still checking authentication
    return null;
  }

  if (!authenticated) {
    // Redirect to login page with the current location stored in state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
