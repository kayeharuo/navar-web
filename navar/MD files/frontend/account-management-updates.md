# Account Management - Recent Updates

**Last Updated:** April 1, 2026

## Changes Made

### 1. Capitalized Status Display
- **Official** and **Partial** are now displayed with proper capitalization
- Applies to both active and deactivated account tables
- Status badges are color-coded for clarity

### 2. Deactivated Accounts Status Column
Added "ACCOUNT STATUS" column to deactivated accounts tables:
- **Deactivated Super Admins:** Now shows whether account was "Official" or "Partial" when deactivated
- **Deactivated Mall Admins:** Now shows whether account was "Official" or "Partial" when deactivated
- Allows admins to see historical status at point of deactivation
- Status is automatically computed from the original account status

### 3. ESC Key Support
All modals in account management now support closing with ESC key:
- Create/Edit Account modal
- Account Created confirmation
- Reset Password modal
- Magic Link Sent modal
- Deactivate Account modal
- Reactivate Account modal

## Implementation Details

### Files Modified
- `navar/navar-frontend/src/pages/AccountManagement.jsx`

### Status Computation
- Status = "Partial" if account.status === 'pending' (grayed out/not activated)
- Status = "Official" if account.status === 'active' (activated and in use)

### UI/UX Improvements
- Consistent capitalization across all table views
- Status visibility maintained even after account deactivation
- Keyboard accessibility with ESC key support
