import React from 'react';
import { Box, TextField } from '@mui/material';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  minHeight?: number;
  uploadEndpoint?: string;
}

/**
 * Simple RichTextEditor Component
 *
 * A placeholder textarea component that will be replaced with a custom advanced editor.
 * Maintains the same interface as the previous BlockNote editor for compatibility.
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  label,
  name = 'body_html',
  placeholder,
  required = false,
  error = false,
  helperText,
  minHeight = 400,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <Box>
      <TextField
        name={name}
        label={label}
        placeholder={placeholder}
        value={value || ''}
        onChange={handleChange}
        required={required}
        error={error}
        helperText={helperText}
        multiline
        fullWidth
        rows={Math.floor(minHeight / 24)} // Approximate rows based on minHeight
        InputProps={{
          inputProps: {
            'data-testid': name,
          },
        }}
        sx={{
          '& .MuiInputBase-root': {
            minHeight: `${minHeight}px`,
            alignItems: 'flex-start',
          },
        }}
      />
    </Box>
  );
};
