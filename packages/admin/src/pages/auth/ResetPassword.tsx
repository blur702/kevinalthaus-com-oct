// Password reset placeholder page - functionality not yet implemented in backend

import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Paper, Box, TextField, Button, Typography, Alert, Link } from '@mui/material';

const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    // Placeholder - no actual submission since backend doesn't support password reset yet
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            Reset Password
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            Password reset functionality is not yet implemented. This feature will be available in a
            future release. Please contact your administrator if you need to reset your password.
          </Alert>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled
              helperText="Password reset will be enabled in a future update"
            />

            <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled>
              Request Password Reset
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Back to Login
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
