import React from 'react';
import { Box, Typography } from '@mui/material';
import { BlogManagement } from '../../../../plugins/blog/frontend';

const Content: React.FC = () => (
  <Box>
    <Typography variant="h4" component="h1" gutterBottom>
      Content
    </Typography>
    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
      Manage your website content, articles, and media.
    </Typography>
    <BlogManagement />
  </Box>
);

export default Content;
