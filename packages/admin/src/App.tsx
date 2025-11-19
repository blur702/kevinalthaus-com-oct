import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Box,
  CssBaseline,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  Article as ArticleIcon,
  Logout as LogoutIcon,
  Label as LabelIcon,
  Edit as EditIcon,
  FolderOpen as FilesIcon,
  SmartToy as AiIcon,
  MenuOpen as MenuManagerIcon,
  ViewQuilt as PageBuilderIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useLocation } from 'react-router-dom';

// Import pages
import Dashboard from './pages/Dashboard.tsx';
import Users from './pages/Users.tsx';
import Content from './pages/Content.tsx';
import Analytics from './pages/Analytics.tsx';
import Settings from './pages/Settings.tsx';
import Taxonomy from './pages/Taxonomy.tsx';
import EditorTest from './pages/EditorTest.tsx';
import Files from './pages/Files.tsx';
import AiServices from './pages/AiServices.tsx';
import Menus from './pages/Menus.tsx';
import PageBuilder from './pages/PageBuilder.tsx';

// Import auth components and pages
import ProtectedRoute from './components/ProtectedRoute.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Login from './pages/auth/Login.tsx';
import Register from './pages/auth/Register.tsx';
import ResetPassword from './pages/auth/ResetPassword.tsx';
import { clearTokens } from './lib/auth.ts';

// 404 NotFound component
const NotFound: React.FC = () => (
  <Box sx={{ textAlign: 'center', mt: 8 }}>
    <Typography variant="h1" component="h1" gutterBottom>
      404
    </Typography>
    <Typography variant="h5" component="h2" gutterBottom>
      Page Not Found
    </Typography>
    <Typography variant="body1" sx={{ mb: 3 }}>
      The page you're looking for doesn't exist.
    </Typography>
    {/* Link to a public, safe route to avoid redirect chains for unauthenticated users */}
    <Button component={RouterLink} to="/login" variant="contained" color="primary">
      Go to Login
    </Button>
  </Box>
);

const drawerWidth = 240;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Users', path: '/users', icon: <PeopleIcon /> },
  { label: 'Content', path: '/content', icon: <ArticleIcon /> },
  { label: 'Page Builder', path: '/page-builder', icon: <PageBuilderIcon /> },
  { label: 'Taxonomy', path: '/taxonomy', icon: <LabelIcon /> },
  { label: 'Files', path: '/files', icon: <FilesIcon /> },
  { label: 'Menus', path: '/menus', icon: <MenuManagerIcon /> },
  { label: 'AI Services', path: '/ai-services', icon: <AiIcon /> },
  { label: 'Analytics', path: '/analytics', icon: <AnalyticsIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
  { label: 'Editor Test', path: '/editor-test', icon: <EditIcon /> },
];

interface ProtectedLayoutProps {
  children: React.ReactNode;
  drawer: React.ReactNode;
  drawerWidth: number;
  mobileOpen: boolean;
  handleDrawerToggle: () => void;
  handleLogout: () => void;
}

const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({
  children,
  drawer,
  drawerWidth,
  mobileOpen,
  handleDrawerToggle,
  handleLogout,
}) => (
  <Box sx={{ display: 'flex' }}>
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${drawerWidth}px)` },
        ml: { sm: `${drawerWidth}px` },
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          Kevin Althaus - Admin Dashboard
        </Typography>
        <Button
          color="inherit"
          onClick={handleLogout}
          startIcon={<LogoutIcon />}
          data-testid="logout-button"
        >
          Logout
        </Button>
      </Toolbar>
    </AppBar>
    <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        p: 3,
        width: { sm: `calc(100% - ${drawerWidth}px)` },
      }}
    >
      <Toolbar />
      {children}
    </Box>
  </Box>
);

const App: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleDrawerToggle = (): void => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async (e?: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e?.preventDefault();
    try {
      await clearTokens();
    } catch (err) {
      // Log and optionally show a notification/toast in the future
      console.error('Logout failed:', err);
    } finally {
      navigate('/login');
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Admin Panel
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <>
      <CssBaseline />
      <Routes>
        {/* Public auth routes - no drawer layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected admin routes - with drawer layout */}
        {[
          { path: '/', element: <Dashboard /> },
          { path: '/users', element: <Users /> },
          { path: '/content', element: <Content /> },
          { path: '/page-builder', element: <PageBuilder /> },
          { path: '/taxonomy', element: <Taxonomy /> },
          { path: '/files', element: <Files /> },
          { path: '/menus', element: <Menus /> },
          { path: '/ai-services', element: <AiServices /> },
          { path: '/analytics', element: <Analytics /> },
          {
            path: '/settings',
            element: (
              <ErrorBoundary>
                <Settings />
              </ErrorBoundary>
            ),
          },
          { path: '/editor-test', element: <EditorTest /> },
        ].map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <ProtectedRoute>
                <ProtectedLayout
                  drawer={drawer}
                  drawerWidth={drawerWidth}
                  mobileOpen={mobileOpen}
                  handleDrawerToggle={handleDrawerToggle}
                  // eslint-disable-next-line @typescript-eslint/no-misused-promises
                  handleLogout={handleLogout}
                >
                  {route.element}
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
        ))}

        {/* 404 catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;
