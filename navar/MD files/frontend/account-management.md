# Account Management

## Overview
The Account Management page enables super admins to create, manage, and monitor user accounts across the NavAR system. It supports two account types: Super Admins and Mall Admins, with lifecycle management including pending, active, and deactivated states.

## File Structure
- **Component:** `src/pages/AccountManagement.jsx`
- **Styles:** `src/styles/accountManagement/accountManagement.css`
- **Route:** `/account-management`

## Features

### 1. Account Types
- **Super Admin:** System-wide administrators with full platform access
- **Mall Admin:** Admin for specific mall locations with location-scoped access

### 2. Account Lifecycle States
- **Active:** Account is fully operational
- **Pending:** Account created but user hasn't set password via magic link
- **Deactivated:** Account access revoked, can be reactivated later

### 3. Dashboard Statistics
Four colored stat cards displaying:
- **Super Admins Count** (Blue) - Total super admin accounts
- **Mall Admins Count** (Purple) - Total mall admin accounts  
- **Pending Login Count** (Orange) - Accounts awaiting user setup
- **Deactivated Count** (Red) - Deactivated accounts

### 4. Tabbed Interface
Four tabs for organizing accounts:
1. Super Admins (Active)
2. Mall Admins (Active)
3. Deactivated Super Admins
4. Deactivated Mall Admins

Each tab displays count badge and filters table dynamically.

### 5. Search & Filtering
- **Search input:** Searches across name, email, job title, mall, and all fields
- **Real-time filtering:** Results update as user types
- **Display count:** Shows total matching results

### 6. Account Management Actions

#### Create Account
- **Modal:** Creates new Super Admin or Mall Admin
- **Role selection:** Choose account type on creation
- **Super Admin fields:**
  - Full Name (required)
  - Email Address (required)
  - Job Title (optional)
  - Contact Number (optional)
- **Mall Admin fields:**
  - Full Name (required)
  - Email Address (required)
  - Job Title (optional)
  - Contact Number (required)
  - Assigned Mall (required)
  - Is Primary (Yes/No required)
- **Validation:** Enforces required fields and business rules
- **Magic Link:** Auto-sent to email after creation (24-hour expiry)
- **Pending state:** New account appears greyed out until user sets password

#### Edit Account
- **In-place editing:** Update name, email, job title, contact, mall assignment
- **Primary Admin Rule:** Cannot assign multiple primary admins to same mall
- **Warning system:** Shows if mall already has active primary admin
- **Immediate updates:** Changes saved to active lists

#### Reset Password
- **Confirmation modal:** Asks admin to confirm password reset
- **Magic Link:** Sends new password reset link to user email
- **Instant effect:** Current password invalidated immediately
- **Resend capability:** Failed resets can be resent from details

#### Deactivate Account
- **Confirmation modal:** Confirms account deactivation
- **Primary Admin Warning:** If deactivating primary mall admin, shows warning that mall will have no primary admin until new one assigned
- **Immediate removal:** Account moves to deactivated list
- **Data preservation:** Can be reactivated later

#### Reactivate Account
- **Confirmation modal:** Confirms account reactivation
- **Restore to Active:** Returns account to appropriate active list
- **Status reset:** Changes status from deactivated to active
- **Auto-navigation:** Tab switches to show reactivated account

#### Resend Magic Link
- **Pending accounts only:** Shows for accounts still awaiting first login
- **Email resend:** Sends fresh magic link to account email
- **24-hour validity:** Each link valid for 24 hours from send time

### 7. Business Rules Enforced

#### One Primary Admin Per Mall
- **Validation:** Cannot assign multiple primary admins to same mall
- **Error message:** Clear feedback when attempting duplicate assignment
- **UI feedback:** "Yes" radio option disabled if primary exists
- **Warning text:** Shows current primary admin name

#### Primary Admin Deactivation
- **Special warning:** Deactivating primary mall admin triggers mall notification
- **Warning text:** "⚠ [Mall Name] will not have a primary admin until a new one is assigned"
- **User awareness:** Admin informed of consequences before confirming

#### Pending Account Lifecycle
- **Visual indicator:** "Temp PW" badge on pending accounts
- **Greyed styling:** Pending rows have reduced opacity
- **Special actions:** Can resend link or reset password
- **Manual conversion:** No auto-promotion; user must set password via link

### 8. Data Structure

#### Account Object
```javascript
{
  id: unique_identifier,
  name: string,
  email: string,
  jobTitle: string,
  contact: string,
  created: string,        // Date formatted
  lastUpdated: string,    // Date formatted
  lastLogin: string,      // "Never" or date
  status: 'active' | 'pending' | 'deactivated',
  
  // Mall Admin specific:
  mall: string,
  isPrimary: boolean,
}
```

### 9. Modal Components

#### AccountFormModal
- Handles both create and edit modes
- Role-specific field layouts
- Real-time validation with error messages
- Primary admin conflict detection

#### AccountCreatedModal
- Shows confirmation after account creation
- Displays magic link info and expiry
- Summary of created account details
- "Done" button to close and return

#### ResetPasswordModal
- Confirmation before reset
- Shows account being reset
- Explains implications (password invalidation)
- "Generate New Password" action button

#### DeactivateModal
- Confirmation with account name
- Primary admin warning (if applicable)
- "Deactivate" and "Cancel" options

#### ReactivateModal
- Confirmation with account name
- "Reactivate" and "Cancel" options
- Returns to active list

#### MagicLinkSentModal
- Confirmation after link sent
- Shows recipient email
- Explains 24-hour expiry
- "Done" button to close

### 10. Styling & UX

#### Color Scheme
- **Super Admin:** #6C1FCA (Purple border)
- **Mall Admin:** #2563EB (Blue border)
- **Pending:** #FF9233 (Orange)
- **Deactivated:** #D51D1D (Red)

#### Responsive Design
- Mobile-friendly grid layouts
- Stack stat cards on small screens
- Full-width tables with horizontal scroll on mobile
- Touch-friendly button sizing

#### Visual Feedback
- Hover states on interactive elements
- Loading states during operations
- Error messages in red
- Success confirmations
- Disabled states for unavailable actions

## Implementation Details

### State Management
- Uses React `useState` for page state
- Manages multiple modal states concurrently
- Separate arrays for active and deactivated accounts by type
- Real-time list updates on create/edit/delete

### Data Persistence
- Currently in-memory (seed data)
- Ready for backend API integration
- All mutations follow immutable patterns

### Accessibility
- Semantic HTML structure
- ARIA labels on form inputs
- Keyboard navigation support
- Clear focus indicators
- Screen reader friendly modals

## Future Enhancements
- Backend API integration for data persistence
- Batch operations (multi-select deactivate)
- Advanced filtering (by last login date, created date)
- Account audit trail / activity log
- Email template customization
- Bulk import via CSV
- Two-factor authentication setup
- Account role migration workflows

## Testing Scenarios

### Happy Paths
1. Create Super Admin → Receive email → Set password → Account active
2. Create Mall Admin → Assign primary → Set password → Active list
3. Reset password → Email sent → User sets new password → Continues
4. Deactivate → Moves to deactivated list → Can reactivate
5. Edit account → Update fields → Changes saved immediately

### Edge Cases
1. Try assign secondary to mail with primary → Error shown
2. Deactivate primary admin → Warning shown before action
3. Resend link multiple times → Each generates new 24h link
4. Search non-existent → Shows empty state message
5. Create account with duplicate email → Validation prevents (future)

### Business Rule Validation
1. One primary per mall enforced on create
2. One primary per mall enforced on edit
3. Primary deactivation shows warning
4. Pending accounts show resend link option
5. Deactivated accounts separate from active
