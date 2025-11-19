import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import PaletteIcon from '@mui/icons-material/Palette';
import CodeIcon from '@mui/icons-material/Code';
import type { WidgetConfig, WidgetInstance } from '../../../src/types';
import type { PropertyPanelTab } from '../types';
import { PROPERTY_PANEL_WIDTH } from '../constants';

export interface PropertyPanelProps {
  widget: WidgetInstance | null;
  onUpdate?: (config: WidgetConfig) => void;
  onClose?: () => void;
  collapsed?: boolean;
}

const tabs: Array<{ value: PropertyPanelTab; icon: ReactNode; label: string }> = [
  { value: 'content', icon: <SettingsIcon fontSize="small" />, label: 'Content' },
  { value: 'style', icon: <PaletteIcon fontSize="small" />, label: 'Style' },
  { value: 'advanced', icon: <CodeIcon fontSize="small" />, label: 'Advanced' },
];

function PropertyPanel({
  widget,
  onUpdate,
  onClose,
  collapsed = false,
}: PropertyPanelProps) {
  const [activeTab, setActiveTab] = useState<PropertyPanelTab>('content');
  const [config, setConfig] = useState<WidgetConfig>(widget?.config ?? {});
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(widget?.config ?? {});
    setActiveTab('content');
    setParseError(null);
  }, [widget]);

  useEffect(() => {
    if (!widget || !onUpdate) {
      return;
    }
    const timeout = window.setTimeout(() => onUpdate(config), 250);
    return () => window.clearTimeout(timeout);
  }, [config, onUpdate, widget]);

  const handleInputChange = (name: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const renderTextWidgetFields = () => (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        label="Text content"
        multiline
        minRows={4}
        value={config.text ?? ''}
        onChange={(event) => handleInputChange('text', event.target.value)}
      />
      <FormControl fullWidth>
        <InputLabel id="text-alignment-label">Alignment</InputLabel>
        <Select
          labelId="text-alignment-label"
          label="Alignment"
          value={config.alignment ?? 'left'}
          onChange={(event) => handleInputChange('alignment', event.target.value)}
        >
          <MenuItem value="left">Left</MenuItem>
          <MenuItem value="center">Center</MenuItem>
          <MenuItem value="right">Right</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );

  const renderImageFields = () => (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        label="Image URL"
        value={config.src ?? ''}
        onChange={(event) => handleInputChange('src', event.target.value)}
      />
      <TextField
        label="Alt text"
        value={config.alt ?? ''}
        onChange={(event) => handleInputChange('alt', event.target.value)}
      />
      <TextField
        label="Border radius"
        value={config.borderRadius ?? 0}
        onChange={(event) => handleInputChange('borderRadius', event.target.value)}
      />
    </Box>
  );

  const renderButtonFields = () => (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        label="Button label"
        value={config.label ?? ''}
        onChange={(event) => handleInputChange('label', event.target.value)}
      />
      <TextField
        label="Link"
        value={config.href ?? ''}
        onChange={(event) => handleInputChange('href', event.target.value)}
      />
      <FormControl fullWidth>
        <InputLabel id="button-variant-label">Variant</InputLabel>
        <Select
          labelId="button-variant-label"
          label="Variant"
          value={config.variant ?? 'contained'}
          onChange={(event) => handleInputChange('variant', event.target.value)}
        >
          <MenuItem value="contained">Primary</MenuItem>
          <MenuItem value="outlined">Outline</MenuItem>
          <MenuItem value="text">Text</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );

  const renderContentTab = () => {
    if (!widget) {
      return (
        <Typography variant="body2" color="text.secondary">
          Select a widget to edit its properties.
        </Typography>
      );
    }
    switch (widget.type) {
      case 'text-content':
        return renderTextWidgetFields();
      case 'image':
        return renderImageFields();
      case 'button':
        return renderButtonFields();
      default:
        return (
          <TextField
            label="Configuration (JSON)"
            multiline
            minRows={8}
            value={JSON.stringify(config, null, 2)}
            error={Boolean(parseError)}
            helperText={parseError ?? undefined}
            inputProps={{ 'aria-invalid': Boolean(parseError) }}
            onChange={(event) => {
              try {
                const parsed = JSON.parse(event.target.value);
                setParseError(null);
                setConfig(parsed);
              } catch (error) {
                console.warn('Invalid JSON in config editor', error);
                setParseError(error instanceof Error ? error.message : 'Invalid JSON');
              }
            }}
          />
        );
    }
  };

  const renderStyleTab = () => (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        label="Text color"
        type="color"
        value={config.color ?? '#000000'}
        onChange={(event) => handleInputChange('color', event.target.value)}
      />
      <TextField
        label="Background color"
        type="color"
        value={config.backgroundColor ?? '#ffffff'}
        onChange={(event) =>
          handleInputChange('backgroundColor', event.target.value)
        }
      />
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(config.fullWidth)}
            onChange={(event) => handleInputChange('fullWidth', event.target.checked)}
          />
        }
        label="Full width"
      />
      <Box>
        <Typography variant="caption">Padding</Typography>
        <Slider
          min={0}
          max={128}
          value={config.padding ?? 16}
          onChange={(_, value) => handleInputChange('padding', value as number)}
        />
      </Box>
    </Box>
  );

  const renderAdvancedTab = () => (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        label="CSS classes"
        value={config.className ?? ''}
        onChange={(event) => handleInputChange('className', event.target.value)}
      />
      <TextField
        label="Custom attributes"
        helperText="Enter comma-separated attributes (e.g., data-id=hero)"
        value={config.dataAttributes ?? ''}
        onChange={(event) =>
          handleInputChange('dataAttributes', event.target.value)
        }
      />
      <Button
        variant="outlined"
        onClick={() => widget && setConfig(widget.config)}
      >
        Reset to defaults
      </Button>
    </Box>
  );

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'content':
        return renderContentTab();
      case 'style':
        return renderStyleTab();
      case 'advanced':
        return renderAdvancedTab();
      default:
        return null;
    }
  }, [activeTab, config, widget]);

  return (
    <Paper
      elevation={3}
      sx={{
        width: collapsed ? 0 : PROPERTY_PANEL_WIDTH,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={600}>
            {widget ? widget.type.replace('-', ' ') : 'No widget selected'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Configure widget properties
          </Typography>
        </Box>
        <IconButton aria-label="Close property panel" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        variant="fullWidth"
        aria-label="Widget property tabs"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            value={tab.value}
          />
        ))}
      </Tabs>

      <Divider />

      <Box p={2} flex={1} overflow="auto">
        {tabContent}
      </Box>
    </Paper>
  );
}

export default PropertyPanel;
