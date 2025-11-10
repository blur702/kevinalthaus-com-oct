/**
 * Blog Plugin Frontend
 * Main export file for blog management components
 */

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { BlogList } from './components/BlogList';
import { BlogForm } from './components/BlogForm';
import type { BlogPost } from './types';

/**
 * Main Blog Management Component
 * Combines BlogList and BlogForm for complete blog management
 */
export const BlogManagement: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateNew = () => {
    setEditPost(null);
    setShowForm(true);
  };

  const handleEdit = (post: BlogPost) => {
    setEditPost(post);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditPost(null);
  };

  const handleSave = () => {
    setRefreshKey((prev) => prev + 1);
    handleClose();
  };

  return (
    <Box>
      {showForm ? (
        <BlogForm
          onClose={handleClose}
          onSave={handleSave}
          editPost={editPost}
        />
      ) : (
        <BlogList key={refreshKey} onCreateNew={handleCreateNew} onEdit={handleEdit} />
      )}
    </Box>
  );
};

// Export individual components for flexibility
export { BlogList } from './components/BlogList';
export { BlogForm } from './components/BlogForm';
export { BlogFormDialog } from './components/BlogFormDialog';
