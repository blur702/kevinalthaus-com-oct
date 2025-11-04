import React, { useMemo } from 'react';
import { Box, Paper, FormLabel, FormHelperText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BlockNoteViewRaw, useCreateBlockNote } from '@blocknote/react';
// Note: CSS must be imported in the consuming application (admin/frontend)
// import '@blocknote/react/style.css' in your app's main entry point
import { htmlToBlocks, blocksToHtml } from './utils/htmlConverter';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  minHeight?: number;
  uploadEndpoint?: string;
}

/**
 * Enhanced RichTextEditor Component
 *
 * A block-based WYSIWYG editor powered by BlockNote with:
 * - Block-based editing (like Notion/Medium)
 * - Rich formatting (headings, lists, code blocks, tables, images)
 * - Slash commands for quick block insertion
 * - Image upload support
 * - Improved HTML parsing for existing content
 * - Clean HTML output
 * - MUI theme integration
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  label,
  required = false,
  error = false,
  helperText,
  minHeight = 400,
  uploadEndpoint = '/api/content/media/upload',
}) => {
  const theme = useTheme();

  // Convert HTML to BlockNote blocks on initial load
  const initialContent = useMemo(() => {
    if (!value || value.trim() === '') {
      return undefined;
    }

    try {
      return htmlToBlocks(value);
    } catch (error) {
      console.error('Error parsing HTML content:', error);
      return undefined;
    }
  }, []); // Only parse on initial mount

  // Handle image uploads
  const handleUpload = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url || data.storage_path || `/uploads/${data.filename}`;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw error;
    }
  };

  // Create BlockNote editor instance
  const editor = useCreateBlockNote({
    initialContent,
    uploadFile: handleUpload,
  });

  // Handle content changes
  const handleChange = () => {
    if (!editor) return;
    const blocks = editor.topLevelBlocks;
    blocksToHtml(blocks).then(html => onChange(html)).catch(console.error);
  };

  return (
    <Box>
      {label && (
        <FormLabel
          required={required}
          error={error}
          sx={{ mb: 1, display: 'block', fontSize: '0.875rem' }}
        >
          {label}
        </FormLabel>
      )}
      <Paper
        variant="outlined"
        sx={{
          border: error
            ? `1px solid ${theme.palette.error.main}`
            : `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          overflow: 'hidden',
          '&:hover': {
            borderColor: error
              ? theme.palette.error.main
              : theme.palette.primary.main,
          },
          '&:focus-within': {
            borderColor: error
              ? theme.palette.error.main
              : theme.palette.primary.main,
            borderWidth: 2,
            margin: '-1px',
          },
          // Override BlockNote's default styling with MUI theme
          '& .bn-container': {
            minHeight: `${minHeight}px`,
            fontFamily: theme.typography.fontFamily,
            fontSize: theme.typography.body1.fontSize,
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.background.paper,
          },
          '& .bn-editor': {
            padding: theme.spacing(2),
          },
          // Style the block menu
          '& .bn-block-outer': {
            '&:hover .bn-block-handle': {
              backgroundColor: theme.palette.action.hover,
            },
          },
          // Style slash menu
          '& .bn-suggestion-menu': {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
            boxShadow: theme.shadows[4],
          },
          '& .bn-suggestion-menu-item': {
            padding: theme.spacing(1, 2),
            '&[data-selected="true"]': {
              backgroundColor: theme.palette.action.selected,
            },
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          },
          // Style formatting toolbar
          '& .bn-formatting-toolbar': {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
            boxShadow: theme.shadows[2],
          },
          '& .bn-button': {
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            '&[data-active="true"]': {
              backgroundColor: theme.palette.action.selected,
              color: theme.palette.primary.main,
            },
          },
          // Style code blocks
          '& .bn-code-block': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? theme.palette.grey[900]
                : theme.palette.grey[100],
            borderRadius: theme.shape.borderRadius,
            fontFamily: 'monospace',
          },
          // Style tables
          '& table': {
            borderColor: theme.palette.divider,
          },
          '& th': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? theme.palette.grey[800]
                : theme.palette.grey[200],
          },
        }}
      >
        <BlockNoteViewRaw editor={editor} theme={theme.palette.mode} onChange={handleChange} sideMenu={false} />
      </Paper>
      {helperText && (
        <FormHelperText error={error} sx={{ mt: 0.5 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
};
