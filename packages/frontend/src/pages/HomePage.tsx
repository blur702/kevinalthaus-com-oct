import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 2,
          mb: 6,
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to Kevin Althaus
        </Typography>
        <Typography variant="h5" sx={{ mb: 4, opacity: 0.9 }}>
          Full Stack Developer & Technology Enthusiast
        </Typography>
        <Button
          component={RouterLink}
          to="/about"
          variant="contained"
          size="large"
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          Learn More About Me
        </Button>
      </Box>

      {/* Features Section */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom>
          What I Do
        </Typography>
        <Typography variant="body1" textAlign="center" color="text.secondary" sx={{ mb: 4 }}>
          I specialize in building modern, scalable web applications
        </Typography>

        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h5" component="h3" gutterBottom>
                  Frontend Development
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Creating responsive and interactive user interfaces with React, TypeScript, and
                  modern design systems like Material UI.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h5" component="h3" gutterBottom>
                  Backend Development
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Building robust APIs and services with Node.js, Express, and modern database
                  technologies for scalable applications.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h5" component="h3" gutterBottom>
                  DevOps & Architecture
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Designing and implementing cloud infrastructure, CI/CD pipelines, and
                  containerized deployments for reliable systems.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Call to Action */}
      <Card sx={{ textAlign: 'center', p: 4 }}>
        <CardContent>
          <Typography variant="h4" component="h2" gutterBottom>
            Ready to Work Together?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Let's discuss your next project and bring your ideas to life.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              component="a"
              href="mailto:contact@kevinalthaus.com"
              variant="contained"
              size="large"
              aria-label="Send an email to contact@kevinalthaus.com"
            >
              Get In Touch
            </Button>
            <Button component={RouterLink} to="/about" variant="outlined" size="large">
              Learn More About Me
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default HomePage;
