# Units Management - Recent Updates

**Last Updated:** April 1, 2026

## Summary
Enhanced UnitsPanel component to replace the Remove button with a Deactivate button, allowing units to be temporarily deactivated and reactivated later.

## Changes Made

### 1. Removed Delete Functionality
- **Removed:** "Remove" button that permanently deleted units
- Units can no longer be permanently deleted
- All units are preserved in the system (deactivated or active)

### 2. Deactivate Button
For vacant units, instead of "Remove", users can now:
- Click "Deactivate" button to mark a unit as inactive
- Deactivated units remain in the system but are unavailable for assignment
- Deactivated units appear with "DEACTIVATED" badge
- Row styling indicates deactivated status (grayed out appearance)

### 3. Reactivate Functionality
Deactivated units can be reactivated by:
- Clicking "Reactivate" button on the deactivated unit
- Unit returns to available/vacant status immediately
- All unit data is preserved through deactivation/reactivation cycle

### 4. Unit Status Flow
```
Vacant Unit → (Mark Occupied) → Occupied
    ↓
(Deactivate)
    ↓
Deactivated Unit → (Reactivate) → Vacant Unit
```

### 5. ESC Key Support
- UnitsPanel can now be closed by pressing ESC key
- Consistent with other modal behaviors

## Implementation Details

### Files Modified
- `navar/navar-frontend/src/components/mallManagement/UnitsPanel.jsx`

### Data Structure
Units now include:
```
{
  id: number,
  floorNo: string,
  unitNo: string,
  status: "occupied|vacant",
  isActive: boolean  // New field (default: true)
}
```

### Button States
- **Occupied Unit:** Only "Mark Vacant" button available
- **Vacant Unit:** "Mark Occupied" and "Deactivate" buttons available
- **Deactivated Unit:** Only "Reactivate" button available

### Visual Indicators
- Deactivated units show "DEACTIVATED" badge (not "OCCUPIED" or "VACANT")
- Deactivated unit card has reduced opacity styling
- Deactivated unit row appears grayed out in the list

## User Workflow
1. Admin opens Units panel for a mall
2. For vacant units, admin can choose to:
   - Mark as Occupied (assign to a store)
   - Deactivate (hide from future assignments)
3. For deactivated units, admin can:
   - Reactivate to make available again
4. No data is lost - deactivation is reversible

## Backward Compatibility
- Existing units without `isActive` field default to `true` (active)
- No database migration required
- System handles both old and new unit structures
