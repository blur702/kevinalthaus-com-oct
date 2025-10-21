import React from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Stack,
  Paper,
} from '@mui/material'

const AboutPage: React.FC = () => {
  const skills = [
    'TypeScript',
    'React',
    'Node.js',
    'Express',
    'PostgreSQL',
    'Docker',
    'AWS',
    'Material UI',
    'REST APIs',
    'GraphQL',
  ]

  return (
    <Box>
      {/* Header Section */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Avatar
          sx={{
            width: 120,
            height: 120,
            mx: 'auto',
            mb: 3,
            backgroundColor: 'primary.main',
            fontSize: '3rem',
          }}
        >
          KA
        </Avatar>
        <Typography variant="h3" component="h1" gutterBottom>
          About Kevin Althaus
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          Passionate full-stack developer with expertise in modern web technologies
          and a commitment to creating exceptional user experiences.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Bio Section */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2" gutterBottom>
                My Story
              </Typography>
              <Typography variant="body1" paragraph>
                I'm a dedicated full-stack developer with a passion for creating
                innovative web applications that solve real-world problems. With
                extensive experience in both frontend and backend technologies,
                I enjoy the challenge of building complete solutions from concept
                to deployment.
              </Typography>
              <Typography variant="body1" paragraph>
                My journey in software development started with curiosity about
                how things work under the hood. This curiosity has driven me to
                continuously learn and adapt to new technologies, ensuring that
                I can deliver modern, efficient, and maintainable solutions.
              </Typography>
              <Typography variant="body1" paragraph>
                I believe in writing clean, well-documented code and following
                best practices in software architecture. My experience spans
                from small personal projects to enterprise-level applications,
                always with a focus on user experience and performance.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Skills Section */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Technical Skills
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {skills.map((skill) => (
                <Chip
                  key={skill}
                  label={skill}
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Experience Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2" gutterBottom>
                What I Focus On
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Frontend Development
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Building responsive, accessible, and performant user interfaces
                    using React, TypeScript, and modern CSS frameworks. I prioritize
                    user experience and follow design systems for consistency.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Backend Architecture
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Designing scalable APIs, implementing security best practices,
                    and optimizing database performance. I focus on maintainable
                    code and robust error handling.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    DevOps & Deployment
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Setting up CI/CD pipelines, containerizing applications with Docker,
                    and managing cloud infrastructure for reliable deployments.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Code Quality
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Writing tests, implementing linting rules, and following
                    best practices to ensure maintainable and reliable software.
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default AboutPage