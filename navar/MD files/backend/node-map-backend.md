# Node map backend (Edit Map)

How the Edit Map editor saves and loads a mall's navigation graph, how precise it is,
and how Unity gets a 3D position from a 2D plan.

## What was built

| Piece | File |
|---|---|
| DB migration (run in the Supabase SQL editor) | `navar-backend/database_schema/22_node_map_backend.sql` |
| API | `navar-backend/modules/nodeMap/routes.js` (registered in `server.js`, Super Admin only) |
| Server-side validation and meter conversion | `navar-backend/modules/nodeMap/validation.js`, `nodeTypes.js` |
| Editor data layer | `navar-frontend/src/components/nodeEditor/mapApi.js` |
| Floor plan image + zoomable canvas | `components/NodeCanvas.jsx`, `hooks/useFloorImage.js` |

```text
GET /api/ar-developments/:id/node-map   load floors, signed image URLs, nodes, edges, scale, units, stalls
PUT /api/ar-developments/:id/node-map   save the whole map in one database transaction
```

Saving is allowed only while the AR development status is `node_mapping`. The editor never
changes that status.

## Run order

1. Back up, then run `22_node_map_backend.sql` once (safe to re-run).
2. Restart the backend.
3. Click **Edit Map** on a project that has submitted floor plans.

## Accuracy: what is and is not precise

**Precise**
- The editor works in image pixels only. You can zoom up to 4000%, so one click lands on a
  fraction of a pixel. Arrow keys nudge a selected node by one screen pixel (Shift = 10).
- Nodes keep a fixed on-screen size at every zoom, so a big icon no longer hides the position.
- The backend recomputes everything from pixels: `meters = pixel / pixels_per_meter`,
  rounded to 1 mm, and edge length from the meter coordinates. Whatever the browser sends
  for meters or distance is ignored.
- Edge lengths refresh when a node moves or the scale changes (they were stale before).

**Not something software can fix**
- The result is only as good as the scale line. A 20 m line that is 433 px long gives
  21.6 px/m, so a 2 px click error on each end is about 0.2 m of scale error. Use the
  **longest known distance on the plan** (the editor warns under 200 px) and, if you can,
  confirm it on site with a tape measure.
- Floor plans must be to scale and not skewed. A photo or screenshot of a plan can be
  distorted; a CAD/PDF export is better.
- BLE positioning itself is about 2 to 4 m accurate. That, not the map, is the practical limit
  for AR guidance. This is why nodes snap to the nearest node.

## Where does Z come from?

The plan is 2D, and the graph stays 2D on purpose.

- Every node stores **X and Y in meters** (same origin as the image, Y grows down).
- The **floor is the third coordinate**: `NODE.FLOOR_ID`. Stairs, escalators, elevators and
  ramps are joined across floors by `NODE_CROSS_FLOOR_LINK_ID`, and the backend generates
  one cross-floor edge for each linked pair (a fixed cost: elevator 8, escalator 10,
  stairs 12, ramp 20 m, tunable in `nodeTypes.js`).
- In Unity, place a node at `(x, 0, -y)` inside the root object of its floor, and put that
  root at the real floor height. The `-y` is needed because the plan's Y points down while
  Unity's Z points forward. Do not store a Z per node.
- AR does not use a stored height at all. Dots and banners are raycast onto the floor and
  walls ARCore detects (workflow sections 4.4 and 4.5). The stored X/Y only decides **where
  along the floor** to look.
- All floors must share one origin (for example the same corner of the building) for a
  stair or elevator to line up between floors. The editor does not check that; keep the
  plans aligned when exporting them.

## Rules enforced by the backend

- Unknown node type, empty label, or position outside the image: rejected.
- Store entrance must link to a unit **on the same floor** that has a store. Stall must link
  to a stall store. Other types cannot link to a store.
- Nodes on a floor need that floor's scale (two clicked points, a real length > 0, path loss
  exponent 1 to 6).
- Edges: same floor, no self loop, no duplicate pair, known path type. Staircase edges are
  marked inaccessible, all others accessible.
- Cross-floor links: other floor, same node type, one counterpart each (completed in both
  directions). **Save & Validate** additionally requires every transition to be linked.
- Edits by two people: each save carries the revision it loaded; a mismatch returns 409.
- Deleting a node that another AR version, a beacon assignment of another version, or
  navigation history still uses is refused instead of silently breaking it.
- `STORE.STORE_STATUS` is kept in sync (`mapped` / `unmapped`); `inactive` stores and
  unit occupancy are untouched, per `STORE_MAPPING_RULES.md`.
- Warnings (saved, but shown): corridor edges longer than 10 m, nodes with no edge, a graph
  split into disconnected groups, a short scale line.

## Known limits

- Only floors that have a submitted floor plan in the application appear in the editor, and
  a save only touches those floors.
- Unit and stall lists come from the database. Malls with no units or no stall stores show
  empty dropdowns, so a Store Entrance cannot be placed until units exist.
- Unity reads `NODE` and `EDGE` directly through Supabase RLS (see `05_lock_down_public_schema.sql`),
  so the new columns are readable without a new endpoint.
- Not run against a real database or clicked through in a browser from here. The validation
  rules were unit-tested with a Node script, and the frontend passes lint and `vite build`.
  Test one real mall before relying on it.
