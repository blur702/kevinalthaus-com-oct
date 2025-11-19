import React, {
  memo,
  type ComponentType,
} from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type {
  WidgetConfig,
  WidgetInstance,
} from '../../../src/types';
import type { WidgetRenderProps } from '../types';

interface WidgetWrapperProps {
  widget: WidgetInstance;
  editMode: boolean;
  selected?: boolean;
  component?: ComponentType<WidgetRenderProps>;
  onConfigChange?: (config: WidgetConfig) => void;
  onClick?: () => void;
}

class WidgetErrorBoundary extends React.Component<
  { fallback: React.ReactNode; widgetId: string },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; widgetId: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Readonly<{ fallback: React.ReactNode; widgetId: string }>) {
    if (prevProps.widgetId !== this.props.widgetId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    console.error('Widget render failed', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const WidgetWrapper = memo(
  ({
    widget,
    editMode,
    selected = false,
    component: WidgetComponent,
    onConfigChange,
    onClick,
  }: WidgetWrapperProps) => {
    return (
      <Paper
        elevation={selected ? 6 : 1}
        variant={selected ? 'outlined' : 'elevation'}
        sx={{
          borderColor: selected ? 'primary.main' : 'transparent',
          borderWidth: 2,
          borderStyle: 'solid',
          height: '100%',
          position: 'relative',
          transition: 'border-color 0.2s ease',
          outline: 'none',
        }}
        tabIndex={editMode ? 0 : -1}
        aria-label={`Widget ${widget.type}`}
        onClick={onClick}
      >
        <WidgetErrorBoundary
          widgetId={widget.id}
          fallback={
            <Box p={2}>
              <Typography color="error">
                Unable to render widget. Please check console logs.
              </Typography>
            </Box>
          }
        >
          {WidgetComponent ? (
            <WidgetComponent
              widget={widget}
              editMode={editMode}
              onChange={onConfigChange}
              onSelect={onClick}
              isSelected={selected}
            />
          ) : (
            <Box p={2}>
              <Typography variant="body2" color="text.secondary">
                Widget preview not available yet.
              </Typography>
            </Box>
          )}
        </WidgetErrorBoundary>
      </Paper>
    );
  },
);

export default WidgetWrapper;
