# Store mapping rules

These terms describe two separate relationships. Do not treat them as interchangeable.

## Unit occupancy

A store occupies a unit when the unit row points to the store:

- `UNIT.STORE_ID = STORE.STORE_ID`
- The occupied unit should retain its `UNIT.FLOOR_ID`.
- An occupied unit should normally have `UNIT_STATUS = 'occupied'`.

Clearing `UNIT.STORE_ID` removes the store's unit occupancy. It does **not** mean that
the store has been unmapped from the navigation graph.

## Node mapping

A store is **mapped** when at least one node row points to it:

- `NODE.STORE_ID = STORE.STORE_ID`

A store is **unmapped** when it has no node with that `STORE_ID`, even if it occupies
one or more units. Unmapped stores are intentionally available in the node-mapping
dropdown.

The store status values represent node mapping:

- `STORE.STORE_STATUS = 'mapped'`: the store is connected to one or more nodes.
- `STORE.STORE_STATUS = 'unmapped'`: the store occupies zero or more units but is not
  connected to a node.
- `STORE.STORE_STATUS = 'inactive'`: the store is deactivated; this is separate from
  both unit occupancy and node mapping.

## Implementation requirements

- Store and unit management must preserve `UNIT.STORE_ID` when changing node mapping.
- Node mapping and unmapping must not clear a store's occupied unit.
- Store lists and node-mapping dropdowns should use `STORE_STATUS` for node-mapping
  state, not for unit occupancy.
- Mall/unit responses must carry the matching floor label when displaying a store's
  occupied unit.
- When repairing data, inspect `NODE.STORE_ID`, `UNIT.STORE_ID`, `UNIT.FLOOR_ID`, and
  `STORE.STORE_STATUS` independently.
