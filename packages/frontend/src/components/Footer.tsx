import React from 'react';
import { Box, Container, Typography, Link, CircularProgress } from '@mui/material';
import type { NavigationMenuItem } from '../services/menuService';
import { fetchNavigationMenu } from '../services/menuService';

const Footer: React.FC = () => {
  const [links, setLinks] = React.useState<NavigationMenuItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetchNavigationMenu('footer-links', controller.signal)
      .then((menu) => {
        if (!controller.signal.aborted) {
          setLinks(menu.items);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn('[Footer] Failed to load footer menu, using defaults', error);
          setLinks([
            {
              id: 'github',
              label: 'GitHub',
              url: 'https://github.com/kevinalthaus',
              is_external: true,
              open_in_new_tab: true,
              rel: 'noopener noreferrer',
            },
            {
              id: 'linkedin',
              label: 'LinkedIn',
              url: 'https://linkedin.com/in/kevinalthaus',
              is_external: true,
              open_in_new_tab: true,
              rel: 'noopener noreferrer',
            },
          ]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

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
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              links.map((link) => (
                <Link
                  key={link.id}
                  href={link.url}
                  target={link.open_in_new_tab ? '_blank' : '_self'}
                  rel={link.open_in_new_tab ? link.rel || 'noopener noreferrer' : link.rel || undefined}
                  color="text.secondary"
                  sx={{ textDecoration: 'none' }}
                >
                  {link.label}
                </Link>
              ))
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
