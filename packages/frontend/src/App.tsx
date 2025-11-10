import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container, Typography, Box, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import ValidatorPage from './pages/ValidatorPage';
import SentryTestPage from './pages/SentryTestPage';

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
    <Button component={RouterLink} to="/" variant="contained" color="primary">
      Go to Home
    </Button>
  </Box>
);

const App: React.FC = () => {
  // Gate the /sentry-test route behind an env flag or non-production
  const enableSentryTestRoute = (() => {
    const flag = (import.meta as any)?.env?.VITE_ENABLE_SENTRY_TEST_ROUTE;
    if (typeof flag === 'string') {
      const v = flag.toLowerCase();
      if (v === 'true' || v === '1') {return true;}
      if (v === 'false' || v === '0') {return false;}
    }
    return !(import.meta as any)?.env?.PROD; // enable by default in non-prod
  })();
  return (
    <AuthProvider>
      <div className="App">
        <Header />
        <Container component="main" sx={{ mt: 4, mb: 4, minHeight: '70vh' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/validator"
              element={
                <ProtectedRoute>
                  <ValidatorPage />
                </ProtectedRoute>
              }
            />
            {enableSentryTestRoute && (
              <Route path="/sentry-test" element={<SentryTestPage />} />
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Container>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default App;
