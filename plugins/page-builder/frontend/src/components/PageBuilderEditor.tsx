import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { PageLayout } from '../../../src/types';
import { usePageBuilder } from '../hooks/usePageBuilder';
import { useDragDrop } from '../hooks/useDragDrop';
import WidgetPalette from './WidgetPalette';
import GridCanvas from './GridCanvas';
import PropertyPanel from './PropertyPanel';
import type { DragItem, EditorMode } from '../types';
import { PROPERTY_PANEL_WIDTH, TOOLBAR_HEIGHT, WIDGET_PALETTE_WIDTH } from '../constants';

export interface PageBuilderEditorProps {
  initialLayout?: PageLayout;
  onSave?: (layout: PageLayout) => void;
  onChange?: (layout: PageLayout) => void;
  readOnly?: boolean;
}

const responsiveModes: Array<{ value: EditorMode; icon: ReactNode; label: string }> = [
  { value: 'mobile', icon: <SmartphoneIcon />, label: 'Mobile preview' },
  { value: 'tablet', icon: <TabletMacIcon />, label: 'Tablet preview' },
  { value: 'desktop', icon: <DesktopWindowsIcon />, label: 'Desktop preview' },
];

function PageBuilderEditor({
  initialLayout,
  onSave,
  onChange,
  readOnly = false,
}: PageBuilderEditorProps) {
  const editor = usePageBuilder({ initialLayout });
  const {
    layout,
    selectedWidget,
    editorMode,
    history,
    isDirty,
    addWidget,
    updateWidget,
    removeWidget,
    duplicateWidget,
    selectWidget,
    updateWidgetPosition,
    toggleWidgetLock,
    setWidgetsFromLayout,
    undo,
    redo,
    setEditorMode,
  } = editor;

  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [dragOverlayItem, setDragOverlayItem] = useState<DragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const {
    activeId,
    dragItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDragDrop({
    onWidgetAdd: addWidget,
    onWidgetMove: (id, position) => updateWidgetPosition(id, position),
  });

  useEffect(() => {
    onChange?.(layout);
  }, [layout, onChange]);

  useEffect(() => {
    if (dragItem) {
      setDragOverlayItem(dragItem);
    } else {
      setDragOverlayItem(null);
    }
  }, [dragItem]);

  useEffect(() => {
    if (selectedWidget) {
      setPanelCollapsed(false);
    }
  }, [selectedWidget]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'y'
      ) {
        event.preventDefault();
        redo();
      } else if (event.key === 'Delete' && selectedWidget) {
        event.preventDefault();
        removeWidget(selectedWidget.id);
      } else if (event.key === 'Escape') {
        selectWidget(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [removeWidget, redo, selectWidget, selectedWidget, undo]);

  const handleSave = useCallback(() => {
    if (!onSave) return;
    onSave(layout);
  }, [layout, onSave]);

  const modeButtons = useMemo(
    () =>
      responsiveModes.map((mode) => (
        <Tooltip key={mode.value} title={mode.label}>
          <span>
            <IconButton
              size="small"
              color={editorMode === mode.value ? 'primary' : 'default'}
              onClick={() => setEditorMode(mode.value)}
              aria-pressed={editorMode === mode.value}
            >
              {mode.icon}
            </IconButton>
          </span>
        </Tooltip>
      )),
    [editorMode, setEditorMode],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      onDragOver={handleDragOver}
    >
      <Paper
        elevation={0}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Toolbar
          variant="dense"
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: TOOLBAR_HEIGHT,
            gap: 1,
          }}
        >
          <Tooltip title="Undo">
            <span>
              <IconButton
                size="small"
                onClick={undo}
                disabled={!history.past.length}
                aria-label="Undo"
              >
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                size="small"
                onClick={redo}
                disabled={!history.future.length}
                aria-label="Redo"
              >
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          {modeButtons}

          <Divider orientation="vertical" flexItem />

          <Tooltip title={editorMode === 'preview' ? 'Switch to edit mode' : 'Preview page'}>
            <span>
              <IconButton
                size="small"
                onClick={() =>
                  setEditorMode(editorMode === 'preview' ? 'edit' : 'preview')
                }
                aria-label="Toggle preview mode"
              >
                {editorMode === 'preview' ? <EditIcon /> : <VisibilityIcon />}
              </IconButton>
            </span>
          </Tooltip>

          <Box flex={1} />

          <Typography variant="body2" color="text.secondary">
            {isDirty ? 'Unsaved changes' : 'All changes saved'}
          </Typography>

          <Button
            startIcon={<SaveIcon />}
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={readOnly}
          >
            Save
          </Button>
        </Toolbar>

        <Box display="flex" flex={1} overflow="hidden">
          <WidgetPalette
            collapsed={paletteCollapsed}
            onToggleCollapse={() => setPaletteCollapsed((prev) => !prev)}
          />

          <GridCanvas
            widgets={layout.widgets}
            selectedWidgetId={selectedWidget?.id}
            editorMode={editorMode}
            gridConfig={layout.grid}
            onWidgetSelect={selectWidget}
            onWidgetUpdate={(id, config) => updateWidget(id, config)}
            onWidgetRemove={(id) => removeWidget(id)}
            onWidgetDuplicate={(id) => duplicateWidget(id)}
            onWidgetLockToggle={(id, locked) => toggleWidgetLock(id, locked)}
            onLayoutChange={setWidgetsFromLayout}
            readOnly={readOnly || editorMode === 'preview'}
          />

          <PropertyPanel
            widget={selectedWidget}
            onUpdate={(config) => selectedWidget && updateWidget(selectedWidget.id, config)}
            onClose={() => {
              setPanelCollapsed(true);
              selectWidget(null);
            }}
            collapsed={panelCollapsed || !selectedWidget}
          />
        </Box>
      </Paper>

      <DragOverlay>
        {activeId && dragOverlayItem ? (
          <Paper
            elevation={4}
            sx={{ p: 1, minWidth: 160, textAlign: 'center' }}
          >
            {dragOverlayItem.widgetType ?? 'Widget'}
          </Paper>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default PageBuilderEditor;
