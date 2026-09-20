# Audit Logs

## Overview
The Audit Logs page provides comprehensive accountability by recording all actions performed by super admins across the NavAR system. It enables tracking of system changes, identifying user actions, and maintaining compliance audit trails for operational oversight.

## File Structure
- **Component:** `src/pages/AuditLogs.jsx`
- **Styles:** `src/styles/auditLogs/auditLogs.css`
- **Route:** `/audit-logs`

## Features

### 1. Dashboard Statistics
Four colored stat cards displaying:
- **Total Actions** (Blue #2563EB) - Total audit log entries
- **This Week** (Green #16A34A) - Actions performed in current week
- **Admins Active** (Orange #EA580C) - Number of unique admins who performed actions
- **System Actions** (Purple #9E5BF0) - Automated system-triggered actions

### 2. Dual Filter System

#### Module Filter
Dropdown with all available modules:
- All Modules (default)
- License Management
- Application Management
- Account Management
- Mall Management
- AR Development
- (Additional modules as needed)

#### Admin Filter
Dropdown with all active admins:
- All Admins (default)
- [Individual admin names]
- System (automated)
- (Dynamic based on audit logs)

### 3. Search Functionality
- **Search field:** Real-time search across multiple fields
- **Searchable fields:**
  - Timestamp
  - Admin name
  - Module name
  - Action performed
  - Target entity
  - Details/description
- **Result count:** Displays total matching log entries after filtering
- **Case-insensitive:** Search works with any letter case

### 4. Audit Logs Table

#### Column Structure
1. **TIMESTAMP** - When action was performed
2. **ADMIN** - Name of admin who performed action (or "System (automated)")
3. **MODULE** - Which system module was affected
4. **ACTION** - What action was performed
5. **TARGET** - What entity was affected by the action

#### Module Badges
Colored badges for visual module identification:
- **License Management** - Blue (#1D4ED8) on light blue (#DBEAFE)
- **Application Management** - Purple (#7C3AED) on light purple (#EDE9FE)
- **Account Management** - Green (#065F46) on light green (#D1FAE5)
- **Mall Management** - Orange (#92400E) on light orange (#FEF3C7)
- **AR Development** - Green (#15803D) on light green (#F0FDF4)

### 5. Detail Modal

#### Trigger
- Click any table row to view complete action details
- Modal appears with overlay (24% dark background)

#### Modal Content

**Header Section:**
- Action name as title (e.g., "Suspended Mall")
- Associated module badge
- Close (X) button in top right

**Divider Line** - Visual separator

**Details Section:**
Displays in key-value grid format:
- **When** - Full timestamp of action
- **Admin** - Name of admin performing action
- **Module** - System module affected
- **Target** - Specific entity affected

**Details Section** (scrollable):
- **Section label:** "DETAILS" (small caps, uppercase)
- **Content box:** Full description and context
- **Gray background:** #F9FAFB with subtle border
- **Readable text:** Multiple lines supported

**Divider Line** - Visual separator

**Footer:**
- **Close button** - Returns to list

### 6. Empty States
- **No results message:** "No logs found." when filters match nothing
- **Hint text:** "Click any row to view full details."

### 7. Common Actions Tracked

#### License Management
- Suspended Mall
- Entered grace period
- Payment reminder sent
- License renewed
- License revoked

#### Application Management
- Requested revision
- Approved application
- Rejected application
- Application status changed
- Document submission

#### Account Management
- Created account
- Deactivated account
- Reactivated account
- Updated account details
- Reset password
- Assigned role

#### Mall Management
- Updated floor count
- Modified mall details
- Added beacon location
- Removed beacon
- Updated operating hours

#### AR Development
- Deployed AR map
- Updated AR content
- Published experience
- Rolled back version

### 8. Data Structure

#### Audit Log Object
```javascript
{
  id: unique_identifier,
  timestamp: string,        // e.g., "March 14, 2026 at 9:02 AM"
  admin: string,            // Admin name or "System (automated)"
  module: string,           // Module name from predefined list
  action: string,           // Action performed
  target: string,           // What entity was affected
  details: string,          // Full description of action and context
}
```

#### Sample Audit Trail
```javascript
{
  id: 1,
  timestamp: 'March 14, 2026 at 9:02 AM',
  admin: 'Juan dela Cruz',
  module: 'License Management',
  action: 'Suspended Mall',
  target: 'Parkmall Cebu',
  details: 'Reason: Non-payment. Grace period ended Feb 22, 2026. Reinstatement fee: ₱18,000.',
}
```

### 9. Styling & UX

#### Color Scheme
- **Module Badges:** Five distinct color pairs for visual differentiation
- **Primary Blue:** #2563EB (Total Actions stat)
- **Success Green:** #16A34A (This Week stat)
- **Alert Orange:** #EA580C (Admins Active stat)
- **Accent Purple:** #9E5BF0 (System Actions stat)

#### Responsive Design
- Mobile-friendly stat card grid
- Stack cards to 2 columns on tablets
- Stack to 1 column on mobile
- Full-width search and filters
- Horizontal table scroll on mobile
- Touch-friendly button sizing
- Readable font sizes on all devices

#### Interactive Elements
- **Row hover:** Light blue background (#F8FBFF) on table rows
- **Clickable rows:** Cursor changes to pointer
- **Modal overlay:** Semi-transparent background (#000 with 24% opacity)
- **Smooth transitions:** 120ms for hover effects
- **Clear focus states:** Keyboard navigation visible

#### Typography
- **Title:** Poppins, 30px, bold, black
- **Subtitle:** Fira Mono, 13px, medium, gray
- **Table headers:** Poppins, 14px, medium, gray
- **Table cells:** Poppins, 13px, regular, black
- **Modal title:** Poppins, 20px, bold, black
- **Labels:** Poppins, 13px, regular, gray
- **Values:** Poppins, 13px, bold, black

## Implementation Details

### State Management
- Uses React `useState` for:
  - Search query
  - Module filter
  - Admin filter
  - Selected log for modal
- Uses `useMemo` for filtered results

### Filtering Logic
```
Filter = search AND module AND admin

Search: case-insensitive across all fields
Module: exact match or all if "All Modules"
Admin: exact match or all if "All Admins"
```

### Search Implementation
- Searches: timestamp, admin, module, action, target, details
- Case-insensitive comparison
- Returns entries matching ANY field
- Real-time update as user types

### Data Persistence
- Currently in-memory (seed data)
- Ready for backend API integration
- Timestamp formatting: locale-specific date format

### Accessibility
- Semantic HTML (`<table>`, `<tr>`, `<td>`, `<th>`)
- Proper heading hierarchy
- Clear table headers
- Keyboard navigation support
- Screen reader friendly modals
- ARIA labels on interactive elements
- Focus indicators for keyboard users

## Integration Points

### Backend API (Future)
- GET /api/audits - Fetch audit logs with filters
- Query parameters:
  - `search` - Full-text search
  - `module` - Filter by module
  - `admin` - Filter by admin
  - `startDate` - Date range start
  - `endDate` - Date range end
  - `page` - Pagination
  - `limit` - Results per page
- Returns paginated sorted results

### Webhook Integration (Future)
- Real-time audit log ingestion
- Log external API calls
- Track user interactions
- Monitor system health events

## Testing Scenarios

### Happy Paths
1. View all audit logs → Table populated with recent actions
2. Filter by module → Table updates to show only module actions
3. Filter by admin → Table updates to show only admin's actions
4. Search keyword → Matching results shown
5. Click row → Modal opens with full details
6. Close modal → Returns to list with filters intact
7. Combine filters → Module + Admin + Search all work together

### Edge Cases
1. Search with no matches → Empty state message
2. Admin with no actions → No rows in filtered view
3. Module with no recent actions → No rows displayed
4. Very long details → Modal content scrollable
5. Special characters in search → Handled gracefully

### Compliance & Audit
1. All admin actions logged → Complete trail
2. System actions attributed → Shows "System (automated)"
3. Timestamps accurate → Timezone consistent
4. No gaps in logs → Complete audit trail
5. Data immutable → Logs cannot be edited

### Performance
1. Large dataset (10,000+ entries) → Responsive filtering
2. Search performance → Real-time with debounce
3. Module badge rendering → No performance impact
4. Modal opens instantly → No additional API call

## Future Enhancements
- Advanced filtering:
  - Date range picker
  - Time range filtering
  - Action type filter
  - Bulk action grouping
- Export capabilities:
  - CSV download
  - PDF report generation
  - Print-friendly view
- Advanced analytics:
  - Heatmap of most changed entities
  - Admin activity timeline
  - Module change frequency
  - Anomaly detection
- Real-time updates:
  - Live audit stream
  - Webhook notifications for critical actions
  - Email alerts for specific events
- Compliance features:
  - Audit trail certification
  - Tamper-proof logging
  - Retention policies
  - Deletion tracking
- Search enhancements:
  - Advanced query syntax
  - Boolean operators (AND, OR, NOT)
  - Field-specific search (admin:, module:)
  - Saved search filters

## Audit Log Categories

### Tier 1: Critical Actions
- Account creation/deletion
- Permission/role changes
- License suspension
- Data exports
- Admin deactivation

### Tier 2: Standard Actions
- Account edits
- Password resets
- Status changes
- Configuration updates

### Tier 3: Informational
- View-only actions
- Report generation
- System maintenance

## Compliance Notes

### Retention
- All logs retained for audit period (typically 7+ years)
- Immutable record for legal compliance
- Timestamped for forensic investigation

### Access Control
- Only super admins can view audit logs
- Cannot modify or delete audit logs
- Viewing itself may be logged (future)

### Reporting
- Monthly compliance reports
- Quarterly audits
- Annual retention verification

## Common Issues & Solutions

### Issue: Missing Actions
**Solution:** Check if admin permissions allow action logging

### Issue: Slow Search
**Solution:** Implement debouncing and pagination for large datasets

### Issue: Timezone Inconsistencies
**Solution:** Standardize to UTC with local display conversion

### Issue: Duplicate Logs
**Solution:** Implement idempotency checks on log creation
