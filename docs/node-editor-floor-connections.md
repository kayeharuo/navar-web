# Floor connections

Implemented in database migration `36_floor_connections.sql` and the node editor.

## Editing

1. Place the same transition type on each landing.
2. In Node Properties choose a shared transition group, such as Elevator A, from the type-filtered dropdown. Create a group inline if needed, then Save Changes. Place Node also requires selecting or creating a group for transition nodes.
3. On the upper floor use Connected floors > Connect to floor below. Stairs, ramps and escalators connect adjacent mapped floors; elevators may connect the nearest lower landing in their group.
4. Each connection appears on both ends. A middle landing can have an upward and downward connection. Ground-floor nodes need no downward selection.
5. Edit the path type and direction on the connection. Forward means start_node_id to end_node_id; reverse means the opposite. The editor shows floor names. Both means bidirectional. Set the actual operating direction of escalators.
6. Save Draft persists the map; final save requires every transition node to have a connection. Connection changes support undo/redo. Changing a landing type or group removes its connections to avoid stale incompatible links; reconnect afterward.

Emergency is a separate node flag. New emergency connections default to restricted; elevators/ramps otherwise default to accessible, stairs/escalators to normal. Changing the emergency flag does not rewrite existing connections.

## Database

- transition_group: shared UUID, name, type and AR development. node.transition_group_id references it. Migration 37 converts the previous text names to shared records, then removes node_transition_group. Rename group updates every landing without touching edges. Choosing a different group moves only the selected landing; existing connection removal requires confirmation. One landing per group per floor is enforced in the database. Duplicate names (ignoring case) within the same type and map are rejected. Groups are saved with the map revision, so Save Draft persists creation and renaming; undo/redo also includes groups.
- node.node_is_emergency: emergency purpose, independent of access restriction.
- edge.edge_direction: both, forward, reverse relative to stored endpoints.
- Unique edge endpoint-pair index per AR development prevents duplicates regardless of endpoint order.
- node.node_cross_floor_link_id is removed after recovering legacy links into edges. Existing connected components receive generated group names, which can be renamed.
- save_node_map stores all submitted connections and preserves the live version ownership, revision, approval and status protections. Its execution remains restricted to service_role.
- edge_is_cross_floor remains for compatibility and is computed from endpoint floors by backend validation. No new vertical path type is introduced.
- Existing node IDs and beacon assignments are preserved.

## Mobile integration still required

Unity must read edges rather than the removed node partner field, respect edge_direction, and filter transition edges by user preferences for stairs/elevators/ramps/escalators. Restricted access is a separate filter. No A* or Unity implementation is included in this repository change.

Consecutive elevator edges in the same transition group should become one instruction, such as Take Elevator A to Floor 3. Pause arrows during travel, provide an I'm on Floor 3 confirmation, and resume only after floor position and AR heading are established. The database/editor change does not itself implement floor detection or AR alignment.

## Validation

Frontend production build; backend floor-connection validation tests; PGlite migration tests covering legacy recovery, group backfill, duplicate prevention and direction constraints. Run: node --test navar/navar-backend/test/node-map-floor-connections.test.cjs

Migration 37 (`37_shared_transition_groups.sql`) is required after migration 36. Shared groups are backend-only with RLS enabled and service_role access. Unity must resolve node.transition_group_id to the group name; names are display text, never relationship keys.

## Automatic group connections

Matching landings now connect automatically on load and on every editor history change. Stair/ramp/escalator chains require adjacent mapped floors; elevators connect consecutive served floors, including skipped floors. Existing endpoint pairs retain their saved direction and path type. Obsolete pairs are removed when membership changes. The backend generates missing pairs on save as well. Singleton groups remain valid drafts but cannot pass final validation until a matching landing exists. New pairs default to both directions; review escalator direction in Connected floors.

View Data includes a Transition Groups tab with IDs, names, types, member landings and connection counts. Nodes show group membership, emergency flags and connected floors. Edges show both floors, direction and the transition group. Missing-group errors identify the node label, client ID and floor.

## Removed accessibility flags

Migration 38 removes node_is_accessible and edge_is_accessible and renames is_emergency to node_is_emergency without changing existing values. The editor no longer exposes the Accessible toggle, PWD data column, accessibility node rings or automatic accessibility banners. Transport preferences use node types; emergency purpose remains independent. Existing edge path types (normal, accessible, restricted) remain available.
