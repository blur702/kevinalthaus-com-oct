import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  AppBar,
  Toolbar,
  Container,
} from '@mui/material';

/**
 * Plugin interface with explicit status semantics.
 *
 * Status values:
 * - 'active': Plugin is currently running and activated
 * - 'installed': Plugin is installed but has never been activated
 * - 'inactive': Plugin was previously activated but is now deactivated
 * - 'error': Plugin encountered an error during lifecycle operation
 */
export interface Plugin {
  id: string;
  name: string;
  version?: string;
  status: 'active' | 'installed' | 'inactive' | 'error';
  description?: string;
  author?: string;
}

export interface PluginManagementProps {
  plugins: Plugin[];
  csrfToken: string;
}

export const PluginManagement: React.FC<PluginManagementProps> = ({ plugins, csrfToken }) => {
  // Warn developers if csrfToken is missing
  if (!csrfToken && typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('[PluginManagement] csrfToken is required but not provided - forms will be disabled');
  }
  const askConfirm = (message: string): boolean => {
    // Only call confirm in browser environment
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
    // SSR or environment without window.confirm
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[PluginManagement] confirm() not available in this context; blocking destructive action.');
    }
    return false;
  };
  const getStatusColor = (
    status: Plugin['status']
  ): 'success' | 'info' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'installed':
        return 'info';
      case 'inactive':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: Plugin['status']): string => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'installed':
        return 'Installed';
      case 'inactive':
        return 'Inactive';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  type PluginAction = 'activate' | 'deactivate' | 'uninstall';

  const PluginActionButton: React.FC<{
    pluginId: string;
    action: PluginAction;
    csrfToken: string;
    onConfirm?: () => boolean;
  }> = ({ pluginId, action, csrfToken, onConfirm }) => {
    const actionProps: Record<PluginAction, { label: string; variant: 'contained' | 'outlined'; color: 'primary' | 'warning' | 'error' }> = {
      activate: { label: 'Activate', variant: 'contained', color: 'primary' },
      deactivate: { label: 'Deactivate', variant: 'outlined', color: 'warning' },
      uninstall: { label: 'Uninstall', variant: 'outlined', color: 'error' },
    };
    const { label, variant, color } = actionProps[action];
    const isDisabled = !csrfToken;
    return (
      <form
        method="post"
        action={`/admin/plugins/${pluginId}/${action}`}
        style={{ display: 'inline' }}
        onSubmit={(e) => {
          if (isDisabled || (onConfirm && onConfirm() === false)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="_csrf" value={csrfToken} />
        <Button type="submit" variant={variant} color={color} size="small" disabled={isDisabled}>
          {label}
        </Button>
      </form>
    );
  };

  return (
    <Box>
      {/* App Bar */}
      <AppBar position="static" sx={{ mb: 3 }}>
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Plugin Management
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        <Card>
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Installed Plugins
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Manage your installed plugins. Install, activate, deactivate, or uninstall plugins.
            </Typography>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Plugin Name</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Author</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plugins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No plugins found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    plugins.map((plugin) => (
                      <TableRow key={plugin.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="medium">
                            {plugin.name}
                          </Typography>
                          {plugin.description && (
                            <Typography variant="body2" color="text.secondary">
                              {plugin.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{plugin.version || 'Unknown'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(plugin.status)}
                            color={getStatusColor(plugin.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{plugin.author || 'Unknown'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {(plugin.status === 'inactive' || plugin.status === 'installed') && (
                              <PluginActionButton pluginId={plugin.id} action="activate" csrfToken={csrfToken} />
                            )}
                            {plugin.status === 'active' && (
                              <PluginActionButton pluginId={plugin.id} action="deactivate" csrfToken={csrfToken} />
                            )}
                            {(plugin.status === 'installed' || plugin.status === 'inactive') && (
                              <PluginActionButton
                                pluginId={plugin.id}
                                action="uninstall"
                                csrfToken={csrfToken}
                                onConfirm={() =>
                                  askConfirm('Are you sure you want to uninstall this plugin?')
                                }
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default PluginManagement;
