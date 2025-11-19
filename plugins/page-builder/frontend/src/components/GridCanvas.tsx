import { useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useDroppable } from '@dnd-kit/core';
import {
  Box,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import type {
  GridConfig,
  WidgetConfig,
  WidgetInstance,
} from '../../../src/types';
import type { EditorMode } from '../types';
import { useGrid } from '../hooks/useGrid';
import WidgetWrapper from './WidgetWrapper';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface GridCanvasProps {
  widgets: WidgetInstance[];
  selectedWidgetId?: string;
  editorMode: EditorMode;
  gridConfig: GridConfig;
  onWidgetSelect?: (id: string) => void;
  onWidgetUpdate?: (id: string, config: WidgetConfig) => void;
  onWidgetRemove?: (id: string) => void;
  onWidgetDuplicate?: (id: string) => void;
  onWidgetLockToggle?: (id: string, locked: boolean) => void;
  onLayoutChange?: (widgets: WidgetInstance[]) => void;
  readOnly?: boolean;
}

function GridCanvas({
  widgets,
  selectedWidgetId,
  editorMode,
  gridConfig,
  onWidgetSelect,
  onWidgetUpdate,
  onWidgetRemove,
  onWidgetDuplicate,
  onWidgetLockToggle,
  onLayoutChange,
  readOnly,
}: GridCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'page-builder-canvas',
  });

  const grid = useGrid({
    widgets,
    gridConfig,
    onLayoutChange,
  });

  const breakpoints = useMemo(
    () =>
      gridConfig.breakpoints.reduce<Record<string, number>>((acc, bp) => {
        acc[bp.name] = bp.minWidth;
        return acc;
      }, {}),
    [gridConfig],
  );

  const cols = useMemo(
    () =>
      gridConfig.breakpoints.reduce<Record<string, number>>((acc, bp) => {
        acc[bp.name] = bp.columns ?? gridConfig.columns;
        return acc;
      }, {}),
    [gridConfig],
  );

  const margin: [number, number] = [
    gridConfig.gap.value,
    gridConfig.gap.value,
  ];

  const handleWidgetAction = (
    event: React.MouseEvent,
    callback?: (id: string) => void,
    widgetId?: string,
  ) => {
    event.stopPropagation();
    if (widgetId && callback) {
      callback(widgetId);
    }
  };

  const isInteractive = !readOnly && editorMode !== 'preview';
  const canSelectWidgets = Boolean(onWidgetSelect) && isInteractive;

  return (
    <Box
      ref={setNodeRef}
      flex={1}
      position="relative"
      aria-label="Page builder canvas"
      sx={{
        backgroundColor: editorMode === 'preview' ? 'transparent' : 'grey.50',
        borderLeft: '1px solid',
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      {isOver && (
        <Box
          position="absolute"
          top={16}
          right={16}
          px={2}
          py={1}
          borderRadius={1}
          bgcolor="primary.main"
          color="primary.contrastText"
          zIndex={10}
        >
          Drop to add widget
        </Box>
      )}

      {!widgets.length && (
        <Paper
          elevation={0}
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            m: 4,
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Drag widgets here
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use the widget library to start building your page.
          </Typography>
        </Paper>
      )}

      <ResponsiveGridLayout
        className="page-builder-grid"
        layouts={grid.layouts}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={30}
        margin={margin}
        isDraggable={!readOnly && editorMode !== 'preview'}
        isResizable={!readOnly && editorMode !== 'preview'}
        onLayoutChange={grid.handleLayoutChange}
        onBreakpointChange={grid.handleBreakpointChange}
        draggableHandle=".widget-toolbar__drag-handle"
        compactType="vertical"
      >
        {widgets.map((widget) => {
          const layoutItem =
            grid.layouts[grid.currentBreakpoint]?.find(
              (item) => item.i === widget.id,
            ) ?? {
              i: widget.id,
              x: widget.position.x,
              y: widget.position.y,
              w: widget.position.width,
              h: widget.position.height,
            };

          const handleWidgetSelect = () => onWidgetSelect?.(widget.id);
          const handleWidgetKeyDown = (event: React.KeyboardEvent) => {
            if (!canSelectWidgets) {
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleWidgetSelect();
            }
          };

          return (
            <Box key={widget.id} data-grid={layoutItem} height="100%" sx={{ outline: 'none' }}>
              <Box
                position="relative"
                height="100%"
                tabIndex={canSelectWidgets ? 0 : -1}
                onClick={
                  canSelectWidgets
                    ? handleWidgetSelect
                    : undefined
                }
                onKeyDown={canSelectWidgets ? handleWidgetKeyDown : undefined}
              >
                <WidgetWrapper
                  widget={widget}
                  editMode={!readOnly && editorMode !== 'preview'}
                  selected={selectedWidgetId === widget.id}
                  onConfigChange={(config) =>
                    onWidgetUpdate?.(widget.id, config)
                  }
                />

                {!readOnly && editorMode === 'edit' && (
                  <Box
                    className="widget-toolbar"
                    position="absolute"
                    top={8}
                    right={8}
                    display="flex"
                    alignItems="center"
                    bgcolor="background.paper"
                    borderRadius={2}
                    boxShadow={2}
                    px={0.5}
                  >
                    <Tooltip title="Move widget">
                      <IconButton
                        className="widget-toolbar__drag-handle"
                        size="small"
                        aria-label="Drag widget"
                      >
                        <DragIndicatorIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate widget">
                      <IconButton
                        size="small"
                        aria-label="Duplicate widget"
                        onClick={(event) =>
                          handleWidgetAction(
                            event,
                            onWidgetDuplicate,
                            widget.id,
                          )
                        }
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={widget.isLocked ? 'Unlock widget' : 'Lock widget'}
                    >
                      <IconButton
                        size="small"
                        aria-label={
                          widget.isLocked ? 'Unlock widget' : 'Lock widget'
                        }
                        onClick={(event) =>
                          handleWidgetAction(
                            event,
                            (id) =>
                              onWidgetLockToggle?.(id, !widget.isLocked),
                            widget.id,
                          )
                        }
                      >
                        {widget.isLocked ? (
                          <LockIcon fontSize="small" />
                        ) : (
                          <LockOpenIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete widget">
                      <IconButton
                        size="small"
                        aria-label="Delete widget"
                        onClick={(event) =>
                          handleWidgetAction(
                            event,
                            onWidgetRemove,
                            widget.id,
                          )
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </ResponsiveGridLayout>
    </Box>
  );
}

export default GridCanvas;
