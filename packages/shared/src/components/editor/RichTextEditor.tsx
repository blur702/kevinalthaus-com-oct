/**
 * Custom WYSIWYG Rich Text Editor
 * Built from scratch with contentEditable - no external editor dependencies
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Paper,
  Typography,
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatStrikethrough,
  FormatListBulleted,
  FormatListNumbered,
  Link as LinkIcon,
  Code,
  Undo,
  Redo,
} from '@mui/icons-material';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = 200,
  maxHeight = 600,
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showSource, setShowSource] = useState(false);
  const [sourceValue, setSourceValue] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<string[]>([]);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && !showSource && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value, showSource]);

  // Update counts
  const updateCounts = useCallback(() => {
    if (!editorRef.current) {return;}

    const text = editorRef.current.innerText || '';
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
    setCharCount(text.replace(/\s/g, '').length);
  }, []);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (!editorRef.current) {return;}

    const html = editorRef.current.innerHTML;
    onChange(html);
    updateCounts();
  }, [onChange, updateCounts]);

  // Execute formatting command
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  // Format text
  const formatText = useCallback((format: string) => {
    switch (format) {
      case 'bold':
        execCommand('bold');
        break;
      case 'italic':
        execCommand('italic');
        break;
      case 'underline':
        execCommand('underline');
        break;
      case 'strikethrough':
        execCommand('strikeThrough');
        break;
      case 'code':
        execCommand('formatBlock', '<pre>');
        break;
      default:
        break;
    }
  }, [execCommand]);

  // Insert list
  const insertList = useCallback((type: 'ul' | 'ol') => {
    const command = type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
    execCommand(command);
  }, [execCommand]);

  // Insert heading
  const insertHeading = useCallback((level: number) => {
    execCommand('formatBlock', `<h${level}>`);
  }, [execCommand]);

  // Insert link
  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  }, [execCommand]);

  // Toggle source view
  const toggleSourceView = useCallback(() => {
    if (!editorRef.current) {return;}

    if (showSource) {
      // Switch back to WYSIWYG
      editorRef.current.innerHTML = sourceValue;
      onChange(sourceValue);
      setShowSource(false);
    } else {
      // Switch to source
      setSourceValue(editorRef.current.innerHTML);
      setShowSource(true);
    }
  }, [showSource, sourceValue, onChange]);

  // Update source value
  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSourceValue(e.target.value);
  }, []);

  // Check current formatting state
  const updateFormatState = useCallback(() => {
    const formats: string[] = [];

    if (document.queryCommandState('bold')) {formats.push('bold');}
    if (document.queryCommandState('italic')) {formats.push('italic');}
    if (document.queryCommandState('underline')) {formats.push('underline');}
    if (document.queryCommandState('strikeThrough')) {formats.push('strikethrough');}

    setSelectedFormat(formats);
  }, []);

  // Handle selection change
  useEffect(() => {
    const handleSelectionChange = () => {
      updateFormatState();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateFormatState]);

  return (
    <Box>
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 1,
          border: '1px solid',
          borderColor: 'divider',
          borderBottom: 'none',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {/* Text Formatting */}
        <ToggleButtonGroup
          value={selectedFormat}
          size="small"
          disabled={disabled || showSource}
        >
          <ToggleButton value="bold" onClick={() => formatText('bold')}>
            <Tooltip title="Bold (Ctrl+B)">
              <FormatBold fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="italic" onClick={() => formatText('italic')}>
            <Tooltip title="Italic (Ctrl+I)">
              <FormatItalic fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="underline" onClick={() => formatText('underline')}>
            <Tooltip title="Underline (Ctrl+U)">
              <FormatUnderlined fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="strikethrough" onClick={() => formatText('strikethrough')}>
            <Tooltip title="Strikethrough">
              <FormatStrikethrough fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        {/* Headings */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[1, 2, 3].map((level) => (
            <Tooltip key={level} title={`Heading ${level}`}>
              <IconButton
                size="small"
                onClick={() => insertHeading(level)}
                disabled={disabled || showSource}
              >
                <Typography variant="caption" fontWeight="bold">
                  H{level}
                </Typography>
              </IconButton>
            </Tooltip>
          ))}
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Lists */}
        <Tooltip title="Bullet List">
          <IconButton
            size="small"
            onClick={() => insertList('ul')}
            disabled={disabled || showSource}
          >
            <FormatListBulleted fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Numbered List">
          <IconButton
            size="small"
            onClick={() => insertList('ol')}
            disabled={disabled || showSource}
          >
            <FormatListNumbered fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Link */}
        <Tooltip title="Insert Link">
          <IconButton
            size="small"
            onClick={insertLink}
            disabled={disabled || showSource}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Code Block */}
        <Tooltip title="Code Block">
          <IconButton
            size="small"
            onClick={() => formatText('code')}
            disabled={disabled || showSource}
          >
            <Code fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Undo/Redo */}
        <Tooltip title="Undo">
          <IconButton
            size="small"
            onClick={() => execCommand('undo')}
            disabled={disabled || showSource}
          >
            <Undo fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Redo">
          <IconButton
            size="small"
            onClick={() => execCommand('redo')}
            disabled={disabled || showSource}
          >
            <Redo fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Source Toggle */}
        <Tooltip title={showSource ? 'Visual Editor' : 'HTML Source'}>
          <IconButton
            size="small"
            onClick={toggleSourceView}
            disabled={disabled}
            color={showSource ? 'primary' : 'default'}
          >
            <Typography variant="caption" fontWeight="bold">
              {'</>'}
            </Typography>
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        {/* Word/Char Count */}
        <Typography variant="caption" color="text.secondary">
          {wordCount} words · {charCount} chars
        </Typography>
      </Paper>

      {/* Editor Area */}
      {showSource ? (
        <Box
          component="textarea"
          value={sourceValue}
          onChange={handleSourceChange}
          disabled={disabled}
          placeholder="HTML source code..."
          sx={{
            width: '100%',
            minHeight,
            maxHeight,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            resize: 'vertical',
            '&:focus': {
              outline: 'none',
              borderColor: 'primary.main',
            },
          }}
        />
      ) : (
        <Box
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onBlur={handleInput}
          suppressContentEditableWarning
          sx={{
            minHeight,
            maxHeight,
            overflowY: 'auto',
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            backgroundColor: disabled ? 'action.disabledBackground' : 'background.paper',
            cursor: disabled ? 'not-allowed' : 'text',
            '&:focus': {
              outline: 'none',
              borderColor: 'primary.main',
            },
            '&:empty:before': {
              content: `"${placeholder}"`,
              color: 'text.disabled',
            },
            // Basic text styling
            '& p': {
              margin: '0.5em 0',
            },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              margin: '1em 0 0.5em',
              fontWeight: 600,
            },
            '& ul, & ol': {
              margin: '0.5em 0',
              paddingLeft: '2em',
            },
            '& pre': {
              backgroundColor: 'action.hover',
              padding: '0.5em',
              borderRadius: 1,
              overflow: 'auto',
              fontFamily: 'monospace',
            },
            '& a': {
              color: 'primary.main',
              textDecoration: 'underline',
            },
            '& code': {
              backgroundColor: 'action.hover',
              padding: '0.2em 0.4em',
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.875em',
            },
          }}
        />
      )}
    </Box>
  );
};
