# Email Logs

## Overview
The Email Logs page provides a comprehensive record of all emails sent through the NavAR system, including both system-triggered and manually-sent emails. Admins can track email delivery status, resend failed emails, and view complete email content for audit purposes.

## File Structure
- **Component:** `src/pages/EmailLogs.jsx`
- **Styles:** `src/styles/emailLogs/emailLogs.css`
- **Route:** `/email-logs`

## Features

### 1. Dashboard Statistics
Four colored stat cards displaying:
- **Total Sent** (Blue #2563EB) - Total emails in the system
- **Delivered** (Green #16A34A) - Successfully delivered emails
- **Need Attention** (Orange #EA580C) - Failed delivery emails requiring action
- **Automated triggers** (Purple #9E5BF0) - System-triggered email count

### 2. Alert Banner
- **Orange alert box** displays when failed emails exist
- **Message:** "X email(s) failed to deliver. Click the row to view details and resend"
- **Icon:** Bell icon with notification indicator
- **Purpose:** Draws attention to delivery issues needing action

### 3. Dual Filter System

#### Status Filter
Dropdown with options:
- All Statuses (default)
- Delivered - Successfully sent emails
- Failed - Delivery failures
- Pending - Awaiting delivery

#### Email Type Filter
Comprehensive dropdown with 12 email type options:
- All Email Types (default)
- Welcome / Account Created
- Password Reset
- Application — Revision Requested
- Application — Approved
- Map Ready for Confirmation
- Contract Expiry Reminder
- Grace Period Notice
- Suspension Notice
- Suspension Lifted
- Payment Confirmed
- AR Map Went Live

### 4. Search Functionality
- **Search field:** Real-time search across multiple fields
- **Searchable fields:**
  - Email type
  - Mall name
  - Recipient email address
  - Timestamp
  - Triggered by (admin or system)
- **Result count:** Displays total matching emails after filtering

### 5. Email Logs Table

#### Column Structure
1. **EMAIL TYPE** - Email category/template used
2. **MALL** - Associated mall location (or "Internal" for system emails)
3. **RECIPIENT** - Email address receiving the email
4. **SENT AT** - Timestamp of email send attempt
5. **STATUS** - Delivery status with badge and optional resend button

#### Status Badges
- **Delivered** - Green badge (#D1FAE5 bg, #065F46 text)
- **Failed** - Red badge (#FEE2E2 bg, #B91C1C text) + Resend button
- **Pending** - Orange badge (#FEF3C7 bg, #92400E text)

#### Resend Button (Failed Only)
- **Appearance:** Red button next to failed status badge
- **Behavior:** Click to immediately resend email without opening modal
- **Action:** Updates table status to "Delivered" upon success
- **No modal:** Inline resend for quick action

### 6. Detail Modal

#### Trigger
- Click any table row to view full email details
- Modal appears with overlay

#### Modal Content

**Header Section:**
- Email type as title
- Status badge showing current status
- Close (X) button

**Details Section:**
Displays in grid format:
- **When** - Full timestamp of send
- **Recipient** - Email address
- **Mall** - Associated mall location
- **Type** - Email type/template name
- **Triggered By** - Admin name or "System (automated)"

**Failure Section** (if failed):
- **Failure Reason** - Technical error message
- **Gray box with red border** for error visibility

**Content Section:**
- **Email Content** - Full email body text
- **Gray box format** for readability

**Resend Confirmation** (if resent):
- **Green success banner** appears after resend
- **Message:** "✓ Email successfully resent to [email]"
- **Auto-appears:** Shows after clicking Resend button in modal

#### Footer Buttons
- **Resend Email button** (red, appears if failed) - Sends email again
- **Close button** - Closes modal and returns to list

### 7. Empty States
- **No results message:** "No email logs found." when filters match nothing
- **Hint text:** "Click any row to view the full email that was sent."

### 8. Data Structure

#### Email Log Object
```javascript
{
  id: unique_identifier,
  timestamp: string,        // e.g., "March 14, 2026, 2:00 PM"
  recipient: string,        // Email address
  mall: string,             // Mall name or "Internal"
  type: string,             // Email type from predefined list
  triggeredBy: string,      // Admin name or "System (automated)"
  status: 'sent' | 'failed' | 'pending',
  body: string,             // Full email content
  failReason?: string,      // Only if status === 'failed'
}
```

### 9. Email Type Categories

#### Account & Authentication
- Welcome / Account Created - New user onboarding
- Password Reset - Admin-initiated password reset

#### Application Management
- Application — Revision Requested - Requesting document updates
- Application — Approved - Application approval notification

#### Map & AR
- Map Ready for Confirmation - AR map review request
- AR Map Went Live - AR map deployment confirmation

#### License & Contract
- Contract Expiry Reminder - Contract renewal reminder
- Grace Period Notice - License grace period notification
- Suspension Notice - Service suspension notice
- Suspension Lifted - Service restoration

#### Payments
- Payment Confirmed - Payment receipt confirmation

### 10. Styling & UX

#### Color Scheme
- **Delivered:** Green (#D1FAE5 / #065F46)
- **Failed:** Red (#FEE2E2 / #B91C1C)
- **Pending:** Orange (#FEF3C7 / #92400E)
- **Alert Banner:** Orange (#FF9233)

#### Responsive Design
- Mobile-friendly layout
- Stacked stat cards on small screens
- Horizontal table scroll on mobile
- Full-width search and filters
- Touch-friendly buttons

#### Interactive Elements
- Hover states on table rows (light blue background)
- Active filter button styling
- Modal overlay with 24% dark background
- Smooth transitions on state changes
- Disabled states for unavailable actions

## Implementation Details

### State Management
- Uses React `useState` for:
  - Search query
  - Status filter
  - Email type filter
  - Selected email for modal
  - Email list (for resend updates)
- Uses `useMemo` for filtered results

### Filtering Logic
```
Filter = search AND status AND type

Search: case-insensitive across all email fields
Status: exact match or all if "All Statuses"
Type: exact match or all if "All Email Types"
```

### Resend Behavior
- **Inline resend:** Updates status in table immediately
- **Modal resend:** Updates status and shows confirmation banner
- **Status update:** Sets status to 'sent' after resend

### Data Persistence
- Currently in-memory (seed data)
- Ready for backend API integration
- Resend updates reflected in UI state

### Accessibility
- Semantic HTML structure
- Readable table headers
- Clear link/button labels
- Keyboard navigation support
- Screen reader friendly modals
- ARIA labels on inputs

## Integration Points

### Backend API (Future)
- GET /api/emails - Fetch email logs with filters
- POST /api/emails/{id}/resend - Resend failed email
- Query parameters for filtering:
  - `status` - Filter by status
  - `type` - Filter by email type
  - `search` - Full-text search
  - `page` - Pagination
  - `limit` - Results per page

### Email Service Provider
- Track delivery status from provider
- Hook into webhook for status updates
- Store original email content for audit trail

## Testing Scenarios

### Happy Paths
1. View all emails → Table populated
2. Filter by status → Table updates
3. Filter by type → Table updates
4. Search keyword → Matching results shown
5. Click row → Modal opens with content
6. Resend failed email → Status changes to Delivered
7. Close modal → Returns to list

### Edge Cases
1. Search with no matches → Empty state message
2. Resend same email multiple times → Each send recorded
3. Filter by multiple criteria → AND logic applied
4. Status badge displays correctly → All three types visible
5. Failed email alert shown → When failures exist

### Failure Scenarios
1. Failed email in table → Resend button visible
2. Resend failure → Error message shown
3. Invalid search → Shows no results
4. Modal content overflow → Scrollable content area

### Performance
1. Large dataset (1000+ emails) → Virtual scrolling recommended
2. Search performance → Debounce query input
3. Filter performance → Memoized filters prevent re-renders
4. Modal opens quickly → No additional API call needed

## Future Enhancements
- Pagination for large datasets
- Virtual scrolling for performance
- Email retry scheduling
- Custom email template creation
- Email preview with HTML rendering
- Bulk resend for multiple failed emails
- Email scheduling/delayed send
- A/B testing templates
- Analytics dashboard (opens per email type)
- Webhook integration for real-time status
- Email bounce handling automation
- Unsubscribe list management
- Delivery time SLA tracking

## Common Issues & Solutions

### Issue: Email Status Not Updating
**Solution:** Check email service provider webhook integration

### Issue: Slow Search Performance
**Solution:** Implement debouncing on search input

### Issue: Missing Emails
**Solution:** Verify email service logging and retention policies

### Issue: Resend Always Fails
**Solution:** Validate recipient email addresses and service connectivity
