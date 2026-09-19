# Stores Management - Recent Updates

**Last Updated:** April 1, 2026

## Summary
Enhanced AddStoreModal to allow editing unit assignments without requiring a change to the number of units, plus added ESC key support to all store-related modals.

## Changes Made

### 1. Edit Units Without Changing Count
When editing a store:
- Pencil/Edit button next to "No. of Units" field is now always clickable
- Allows clicking the edit button even if unit count hasn't changed
- Opens unit assignment modal to reassign units to the same quantity
- Provides flexibility to swap units without changing the store's unit count

**Workflow:**
- Store currently has 2 units assigned (Unit A, Unit B)
- Admin edits store and wants to reassign to different units (Unit C, Unit D)
- No need to change "2" in the number field - just click the pencil icon
- Opens unit assignment modal to reassign the 2 units

### 2. Unit Assignment Modal Enhancements
- Always shows the previously selected units highlighted
- Can deselect old units and select new ones
- Maintains the same count requirement (e.g., must select exactly 2 if count is 2)
- Clear visual feedback of current selections

### 3. ESC Key Support
All store-related modals now support closing with ESC key:
- **SelectBrandModal** - Brand selection modal
- **AddStoreModal** - Store creation/editing modal
- **UnitAssignModal** - Unit selection sub-modal within store form
- **ConfirmModal** - Deactivate/Reactivate confirmation dialogs
- **StoresPanel** - Main stores list panel

### 4. Improved User Experience
- Pencil button is now always visible and clickable when units exist
- Button styling indicates mandatory vs optional assignment
- Clear hint text shows currently assigned units
- Keyboard navigation improved with ESC support

## Implementation Details

### Files Modified
- `navar/navar-frontend/src/components/mallManagement/AddStoreModal.jsx`
- `navar/navar-frontend/src/components/mallManagement/SelectBrandModal.jsx`
- `navar/navar-frontend/src/components/mallManagement/StoresPanel.jsx`

### Code Changes

**AddStoreModal:**
- Added `handleEditUnits()` function to allow pencil click at any time
- Changed pencil button from `onClick={() => setShowUnitAssign(true)}` to `onClick={handleEditUnits}`
- Added ESC key listener to modal

**UnitAssignModal:**
- Added ESC key listener
- Preserves previously selected units when reopened

**SelectBrandModal & StoresPanel:**
- Added ESC key listeners to all modals
- Consistent keyboard navigation across all dialogs

## User Workflow Examples

### Scenario 1: Edit Store with Same Unit Count
1. Edit store with 2 units (Unit A, Unit B)
2. Click the pencil icon next to "2"
3. Modal opens with Unit A and Unit B highlighted
4. Deselect Unit A, select Unit C instead
5. Save to update assignment to Unit C and Unit B

### Scenario 2: Modal Navigation
1. Open store creation form
2. Select brand → opens brand selection modal
3. Select brand → opens store form
4. Enter store details and unit count
5. Click pencil icon → opens unit assignment modal
6. Assign units → save → returns to store form
7. Save store form to create store
8. Can press ESC at any point to close current modal

## Backward Compatibility
- Existing stores continue to work as before
- Unit assignment history is preserved
- No data migration needed
- All functionality is additive (no removed features)

## Accessibility
- ESC key provides consistent keyboard-based navigation
- Pencil icon is always accessible for unit reassignment
- Clear visual feedback for edit states
