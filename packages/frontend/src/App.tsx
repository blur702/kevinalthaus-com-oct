import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container, Typography, Box, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';

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
  return (
    <div className="App">
      <Header />
      <Container component="main" sx={{ mt: 4, mb: 4, minHeight: '70vh' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Container>
      <Footer />
    </div>
  );
};

export default App;
