import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const Content: React.FC = () => (
  <Box>
    <Typography variant="h4" component="h1" gutterBottom>
      Content
    </Typography>
    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
      Manage your website content, articles, and media.
    </Typography>
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Content Management System
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Content management features will be available here including article creation, media
          uploads, and SEO optimization tools.
        </Typography>
      </CardContent>
    </Card>
  </Box>
);

export default Content;
