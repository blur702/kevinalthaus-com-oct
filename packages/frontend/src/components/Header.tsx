import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem } from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchNavigationMenu, type NavigationMenuItem } from '../services/menuService';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [siteName, setSiteName] = React.useState<string>('Kevin Althaus');

  // Fetch site name from public settings API
  React.useEffect(() => {
    fetch('http://localhost:3000/api/public-settings')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('[Header] Fetched settings:', data);
        if (data.site_name !== undefined && data.site_name !== null && data.site_name !== '') {
          const nameStr = String(data.site_name);
          console.log('[Header] Setting site name to:', nameStr);
          setSiteName(nameStr);
        }
      })
      .catch((error) => {
        console.error('[Header] Failed to fetch site settings:', error);
        // Keep default site name on error
      });
  }, []);

  const handleMenu = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleLogout = async (): Promise<void> => {
    handleClose();
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed', err);
      // Simple user feedback; in a real app use a Snackbar/Toast
      alert('Logout failed. Please try again.');
    }
  };

  const [menuItems, setMenuItems] = React.useState<NavigationMenuItem[]>([]);
  const defaultNavItems = React.useMemo<NavigationMenuItem[]>(
    () => [
      {
        id: 'home',
        label: 'Home',
        url: '/',
        is_external: false,
        open_in_new_tab: false,
        icon: null,
        rel: undefined,
      },
      {
        id: 'about',
        label: 'About',
        url: '/about',
        is_external: false,
        open_in_new_tab: false,
        icon: null,
        rel: undefined,
      },
    ],
    []
  );

  React.useEffect(() => {
    const controller = new AbortController();
    fetchNavigationMenu('main-navigation', controller.signal)
      .then((menu) => {
        setMenuItems(menu.items);
      })
      .catch((error) => {
        console.warn('[Header] Falling back to default nav items:', error);
        setMenuItems([]);
      });

    return () => controller.abort();
  }, []);

  const navItems = menuItems.length > 0 ? menuItems : defaultNavItems;

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: 600,
          }}
        >
          {siteName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            if (item.is_external) {
              return (
                <Button
                  key={item.id}
                  component="a"
                  href={item.url}
                  color="inherit"
                  target={item.open_in_new_tab ? '_blank' : '_self'}
                  rel={item.open_in_new_tab ? item.rel || 'noopener noreferrer' : item.rel || undefined}
                  sx={{
                    borderColor: 'transparent',
                  }}
                >
                  {item.label}
                </Button>
              );
            }
            return (
              <Button
                key={item.id}
                component={RouterLink}
                to={item.url}
                color="inherit"
                variant={isActive ? 'outlined' : 'text'}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  color: isActive ? 'common.white' : 'inherit',
                  borderColor: isActive ? 'rgba(255,255,255,0.3)' : 'transparent',
                }}
              >
                {item.label}
              </Button>
            );
          })}

          {isAuthenticated ? (
            <>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem disabled>{user?.email || 'Account'}</MenuItem>
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </>
          ) : (
            <Button component={RouterLink} to="/login" color="inherit">Login</Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
