import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import { useDraggable } from '@dnd-kit/core';
import { useEffect, useMemo, useState } from 'react';
import type { WidgetRegistryEntry } from '../../../src/types';
import { fetchWidgets } from '../services/pageBuilderApi';
import {
  filterWidgetsByCategory,
  getWidgetIcon,
  searchWidgets,
  sortWidgetsByName,
} from '../utils/widgetHelpers';
import { WIDGET_CATEGORIES, WIDGET_PALETTE_WIDTH } from '../constants';

export interface WidgetPaletteProps {
  widgets?: WidgetRegistryEntry[];
  onWidgetSelect?: (type: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function PaletteDraggableItem({
  widget,
  onWidgetSelect,
}: {
  widget: WidgetRegistryEntry;
  onWidgetSelect?: (type: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${widget.type}`,
    data: {
      type: 'widget',
      widgetType: widget.type,
      metadata: { source: 'palette', widget },
    },
  });

  const Icon = getWidgetIcon(widget.icon);

  return (
    <ListItem disablePadding>
      <ListItemButton
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => onWidgetSelect?.(widget.type)}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          border: '1px solid',
          borderColor: 'divider',
          opacity: isDragging ? 0.5 : 1,
        }}
      >
        <ListItemIcon>
          <Icon size={20} />
        </ListItemIcon>
        <ListItemText
          primary={widget.displayName || widget.name}
          secondary={widget.description}
        />
        {widget.deprecated && <Chip size="small" label="Deprecated" color="warning" />}
      </ListItemButton>
    </ListItem>
  );
}

function WidgetPalette({
  widgets: widgetsProp,
  onWidgetSelect,
  collapsed = false,
  onToggleCollapse,
}: WidgetPaletteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [widgets, setWidgets] = useState<WidgetRegistryEntry[]>(
    widgetsProp ?? [],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (widgetsProp !== undefined) {
      setWidgets(widgetsProp);
    }
  }, [widgetsProp]);

  useEffect(() => {
    if (widgetsProp !== undefined) {
      return;
    }
    let cancelled = false;
    const loadWidgets = async () => {
      setLoading(true);
      try {
        const response = await fetchWidgets();
        if (!cancelled) {
          setWidgets(response.data?.widgets ?? []);
        }
      } catch (error) {
        console.error('Failed to fetch widgets', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void loadWidgets();
    return () => {
      cancelled = true;
    };
  }, [widgetsProp]);

  const filteredWidgets = useMemo(() => {
    const searched = searchWidgets(widgets, searchTerm);
    return sortWidgetsByName(searched);
  }, [searchTerm, widgets]);

  const grouped = useMemo(() => {
    return WIDGET_CATEGORIES.reduce<Record<string, WidgetRegistryEntry[]>>(
      (acc, category) => {
        acc[category] = filterWidgetsByCategory(filteredWidgets, category);
        return acc;
      },
      {},
    );
  }, [filteredWidgets]);

  return (
    <Paper
      elevation={2}
      sx={{
        width: collapsed ? 56 : WIDGET_PALETTE_WIDTH,
        transition: 'width 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Widgets
        </Typography>
        <Tooltip title={collapsed ? 'Expand palette' : 'Collapse palette'}>
          <IconButton size="small" onClick={onToggleCollapse} aria-label="Toggle widget palette">
            {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {!collapsed && (
        <Box px={2} pb={1}>
          <TextField
            fullWidth
            size="small"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search widgets"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              'aria-label': 'Search widgets',
            }}
          />
        </Box>
      )}

      <Box flex={1} overflow="auto" aria-label="Widget categories">
        {collapsed ? (
          <Box p={2}>
            <Typography variant="body2" color="text.secondary">
              Expand to browse widgets
            </Typography>
          </Box>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <Accordion key={category} disableGutters defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" width="100%">
                  <Typography flex={1} variant="subtitle2">
                    {category.replace(/-/g, ' ')}
                  </Typography>
                  <Chip
                    label={loading ? '...' : items.length}
                    size="small"
                    color="default"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {items.length ? (
                  <List dense disablePadding>
                    {items.map((widget) => (
                      <PaletteDraggableItem
                        key={widget.type}
                        widget={widget}
                        onWidgetSelect={onWidgetSelect}
                      />
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {loading ? 'Loading widgets...' : 'No widgets available'}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))
        )}
        {!Object.values(grouped).some((items) => items.length) && !loading && !collapsed && (
          <Box p={2}>
            <Typography variant="body2" color="text.secondary">
              No widgets match your search.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default WidgetPalette;
