# Page Builder Frontend

React-based UI library that powers the drag-and-drop page builder plugin. The package bundles the editor surface, widget registry UI, grid interactions, property editing experience, and typed API helpers so other packages (admin panel, blog plugin, standalone builder) can embed the editor without duplicating logic.

> Backend details live in [`plugins/page-builder/README.md`](../README.md). This document focuses on the `frontend/` package.

---

## Architecture

```text
src/
├── components/
│   ├── PageBuilderEditor.tsx   # High-level orchestrator
│   ├── WidgetPalette.tsx       # Widget library sidebar
│   ├── GridCanvas.tsx          # react-grid-layout canvas
│   ├── PropertyPanel.tsx       # Widget config panel
│   ├── WidgetWrapper.tsx       # Lazy widget renderer + boundary
│   └── index.ts                # Barrel export
├── hooks/
│   ├── usePageBuilder.ts       # Core state (layout, history, selection)
│   ├── useDragDrop.ts          # @dnd-kit integration
│   ├── useGrid.ts              # react-grid-layout orchestration
│   └── index.ts
├── services/
│   └── pageBuilderApi.ts       # Axios client + typed API helpers
├── contexts/
│   └── PageBuilderContext.tsx  # Optional provider for deeply nested consumers
├── types/                      # Frontend-facing type extensions
├── utils/
│   ├── layoutHelpers.ts        # Widget CRUD + layout math
│   ├── widgetHelpers.ts        # Registry helpers + sanitization
│   ├── gridHelpers.ts          # Responsive grid conversions
│   └── index.ts
├── constants/                  # Shared magic numbers / toggles
└── index.tsx                   # Public exports (components, hooks, types)
```

Data flows from `PageBuilderEditor` → hooks (`usePageBuilder`, `useGrid`, `useDragDrop`) → presentational components (`WidgetPalette`, `GridCanvas`, `PropertyPanel`). Updates emit through callbacks so host apps can persist layouts or react to state changes.

---

## Installation

```bash
cd plugins/page-builder/frontend
npm install
```

The package ships Material UI v5, `@dnd-kit`, `react-grid-layout`, `axios`, and `lucide-react`. No extra peer dependencies required beyond React 18.

---

## Development

```bash
npm run dev    # Start Vite dev server with HMR
npm run build  # Generate production build (runs type checking)
npm run preview# Preview production build locally
```

During local development, the editor expects backend routes exposed under `/api/page-builder`. Override via `VITE_PAGE_BUILDER_API_URL`.

---

## Components

### `PageBuilderEditor`

High-level editor experience that wires up palette, grid, and property panel. Props:

| Prop | Type | Description |
| --- | --- | --- |
| `initialLayout?` | `PageLayout` | Preload saved layout |
| `onSave?` | `(layout: PageLayout) => void` | Execute when user clicks Save |
| `onChange?` | `(layout: PageLayout) => void` | Fired on every structural change (drag, config edit) |
| `readOnly?` | `boolean` | Disable editing controls |

```tsx
import { PageBuilderEditor } from '@monorepo/page-builder-frontend';

export default function PageBuilderRoute() {
  return (
    <PageBuilderEditor
      initialLayout={existingLayout}
      onSave={(layout) => api.updatePage(layout)}
    />
  );
}
```

Features:
- Material-UI toolbar (undo/redo, responsive previews, preview/edit toggle, save)
- Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y, Delete, Escape)
- Drag overlay via `@dnd-kit`
- Palette/panel collapse states for narrower screens

### `WidgetPalette`

Sidebar with search + category grouping. Automatically fetches registry via `pageBuilderApi.fetchWidgets()` if no `widgets` prop supplied. Uses `@dnd-kit` draggable handles for every widget entry. Search matches title, description, and tags.

### `GridCanvas`

Canvas built on `react-grid-layout` (responsive mode wrapped with `WidthProvider`). Highlights drop zone, shows per-widget toolbar (drag handle, duplicate, lock/unlock, delete), enforces selection styles, and surfaces empty state guidance. Emits layout changes so `usePageBuilder` can persist new widget positions.

### `PropertyPanel`

Contextual editor for widget configuration. Tabs:
- **Content:** Widget-specific fields (text editor, media URLs, button settings, etc.)
- **Style:** Quick color, padding, layout toggles
- **Advanced:** Raw class names + data attributes

Tab content updates widget config with a slight debounce to avoid thrashing re-renders.

### `WidgetWrapper`

Lazy loader + error boundary for individual widget implementations. Attempts to import `../widgets/{type}/component.tsx` (Vite ignored dynamic segment) and renders a friendly fallback if component files are missing. For future compatibility, drop new widget bundles anywhere under `src/widgets`.

---

## Hooks

| Hook | Responsibility |
| --- | --- |
| `usePageBuilder` | Manages layout JSON, selected widget, editor mode, undo/redo stack, dirty flag |
| `useDragDrop` | Encapsulates `@dnd-kit` drag state, ensures palette drops add widgets and grid drops reposition existing items |
| `useGrid` | Converts `WidgetInstance[]` ↔ `react-grid-layout` layouts, tracks responsive breakpoints, exposes helpers for layout transforms |

Each hook has rich return types exported from `src/types`.

---

## API Integration

`src/services/pageBuilderApi.ts` mirrors the backend router (`plugins/page-builder/src/routes/index.ts`). All requests use an axios instance with:
- `withCredentials: true`
- CSRF header injection (matches admin panel behavior)
- Helpers for pages, templates, reusable blocks, and widget registry

Example:

```ts
import { fetchPages, createPage } from '@monorepo/page-builder-frontend/src/services/pageBuilderApi';

const { data } = await fetchPages({ page: 1, limit: 20 });
await createPage({ title: 'Landing', layout_json: layout });
```

---

## Widget Development

Widgets follow the backend bundle format (`plugins/page-builder/widgets/*`). To add a new widget:

1. Scaffold `widgets/my-widget/{component,config,types}.ts`.
2. Register the widget via the backend registry service.
3. Implement PropertyPanel fields if the widget requires bespoke controls.
4. (Optional) Create frontend preview components under `src/widgets/my-widget/` for client-side rendering.

Use helpers in `utils/widgetHelpers.ts` to fetch icons, sanitize configs, and run schema validation.

---

## Styling & Theming

- Uses Material-UI v5 components with SX props so host applications inherit the admin theme (`packages/admin/src/theme.ts`).
- All layout measurements centralised in `src/constants`.
- Drag handles + overlays respect theme colors for consistent visual language.

---

## Accessibility

- Palette search/input labeled for screen readers.
- Toolbar buttons include `aria-label` + pressed states.
- Widgets are focusable; `WidgetWrapper` announces selection via focus ring.
- Keyboard shortcuts documented above.
- Drag/drop status indicated via overlay text for screen readers.

---

## TypeScript

- Frontend-specific types live in `src/types/index.ts`, re-exporting backend interfaces for parity (PageLayout, WidgetInstance, etc.).
- Hooks/components rely on these shared types to avoid drift between frontend builder and backend persistence layer.

---

## Testing (Coming Soon)

Component tests and visual regression suites will arrive in **Phase 5**. Current focus is shipping the functional editor. Suggested next steps:
- Storybook stories for palette, grid, and property panel
- Playwright smoke tests for drag/drop

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Widgets fail to load in palette | Ensure backend widget registry is running and user has `database:read` capability |
| Dragging does nothing | Check that `@dnd-kit` sensors are initialized (no console errors) and that the page isn’t in preview/read-only mode |
| Save button disabled | `readOnly` prop is set; remove or flip to `false` |
| Layout not persisting | Confirm `onSave` or `onChange` handlers persist `layout` to your store/database |

For backend/API concerns, refer to [`plugins/page-builder/README.md`](../README.md).
