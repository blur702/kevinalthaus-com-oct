import React from 'react';
import { Box, Container, Typography, Link } from '@mui/material';

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 3,
        backgroundColor: 'grey.100',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} Kevin Althaus. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Link
              href="https://github.com/kevinalthaus"
              target="_blank"
              rel="noopener noreferrer"
              color="text.secondary"
              sx={{ textDecoration: 'none' }}
            >
              GitHub
            </Link>
            <Link
              href="https://linkedin.com/in/kevinalthaus"
              target="_blank"
              rel="noopener noreferrer"
              color="text.secondary"
              sx={{ textDecoration: 'none' }}
            >
              LinkedIn
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
