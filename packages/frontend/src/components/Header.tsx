import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem } from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
  ];

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
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={RouterLink}
              to={item.path}
              color="inherit"
              variant={location.pathname === item.path ? 'outlined' : 'text'}
              aria-current={location.pathname === item.path ? 'page' : undefined}
              sx={{
                color: location.pathname === item.path ? 'common.white' : 'inherit',
                borderColor: location.pathname === item.path ? 'rgba(255,255,255,0.3)' : 'transparent',
              }}
            >
              {item.label}
            </Button>
          ))}

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


