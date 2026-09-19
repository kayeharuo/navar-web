# Beacon Button Changes

**Last Updated:** April 1, 2026

## Summary
Updated the BeaconManager component to remove the maintenance button and enhance the faulty status with an Issue field dropdown.

## Changes Made

### 1. Removed Maintenance Button
- **Removed:** "Set to Maintenance" button from beacon actions
- **Status Filters:** Removed "Maintenance" from status filter options
- **Beacon States:** Beacons now have only two main states - "Placed" or "Faulty"

### 2. Enhanced Faulty Modal
Added an Issue field to the faulty beacon modal with the following dropdown options:
- No Signal / Not broadcasting
- Battery dead
- Weak / Inconsistent signal
- Physical damage
- Missing / Stolen
- Calibration drift
- Interference suspended
- Other

### 3. Modal Validation
- **Issue Field:** Required - must select an issue before marking beacon as faulty
- **Notes Field:** Required - must provide notes/details
- Both fields must be filled to proceed

## Implementation Details

### Modified Files
- `navar/navar-frontend/src/components/mallManagement/BeaconManager.jsx`

### State Changes
- Beacon objects now store `faultyIssue` field alongside existing `faultyNote` field
- Removed `maintTarget` state variable
- Simplified status filter logic

### UI Changes
- FaultyModal now includes a select dropdown for issue selection
- Added form validation for both issue and notes
- Maintenance button completely removed from action row

## Backward Compatibility
- Existing beacons with "maintenance" status will still display as faulty
- No database migration required as maintenance feature is removed entirely
