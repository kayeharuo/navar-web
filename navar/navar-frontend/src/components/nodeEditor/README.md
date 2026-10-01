# Node Editor JSX package

Reusable JavaScript/JSX version of the mall floor-plan node editor.

## Requirements

- React 18 or newer
- A frontend build tool that supports JSX and ES modules (Vite, Webpack/Babel, etc.)

The editor does not require Tailwind or a component library; its UI uses inline styles. The included CSS file only loads the two fonts used by the editor.

## Install

Copy the entire `node-editor-jsx` directory into your React frontend, for example:

```text
src/
  node-editor-jsx/
  pages/
    MallEditor.jsx
```

Then render it:

```jsx
import { NodeEditor } from "../node-editor-jsx";

export default function MallEditor() {
  return <NodeEditor />;
}
```

You can also import the entry file directly:

```jsx
import NodeEditor from "../node-editor-jsx/nodeEditor.jsx";
```

The editor is designed as a full-height workspace. Render it on a dedicated page without a narrow parent container.

## Fastify backend

This export is the React frontend. It currently saves draft/status data in browser `localStorage`, so it works without a backend connection. Your Fastify server can remain a separate application.

For shared or database-backed maps, replace the `loadNodeDraft`/`persistNodeData` functions in `nodeEditor.jsx` with calls to your Fastify API. Typical endpoints are:

```text
GET /api/malls/:mallId/node-map
PUT /api/malls/:mallId/node-map/draft
POST /api/malls/:mallId/node-map/submit
```

The persisted map payload has this shape:

```js
{
  nodes: { "Ground Floor": [], "Level 2": [], "Level 3": [] },
  edges: { "Ground Floor": [], "Level 2": [], "Level 3": [] },
  calibration: { "Ground Floor": null, "Level 2": null, "Level 3": null }
}
```

## Included files

- `nodeEditor.jsx` — reusable editor entry component
- `components/NodeCanvas.jsx` — canvas drawing and node dragging
- `components/PlaceModal.jsx` — node placement
- `components/CalibrationModal.jsx` — scale and path-loss calibration
- `components/DataTable.jsx` — map data viewer
- `hooks/useHistory.js` — undo/redo state
- `editorConstants.js` — node types, floors, stores, and helpers
- `editorData.js` — sample nodes, edges, and calibration
- `nodeEditor.css` — font import
