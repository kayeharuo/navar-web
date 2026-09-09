import { useState, useEffect } from 'react'

// Subscription tiers data
const SUBSCRIPTION_TIERS = {
  'Basic': { maxTenants: 50, annualFee: 30000 },
  'Standard': { maxTenants: 100, annualFee: 50000 },
  'Premium': { maxTenants: 200, annualFee: 100000 },
}

const STALL_PRICE = 3500 // Price per extra stall

const INITIAL_STALL_APPLICATIONS = [
  {
    id: 101,
    mallName: 'Ayala Center Cebu',
    city: 'Cebu City',
    adminName: 'Maria Santos',
    adminEmail: 'msantos@ayalacebu.ph',
    tier: 'Premium', // Current subscription tier
    currentStores: 6, // Current number of stores
    submittedStalls: 4, // New stalls being submitted
    applicationStatus: 'Submitted',
    submittedDate: 'April 1, 2026',
    lastUpdated: 'April 1, 2026',
    floorPlans: [
      { floor: 'Floor 2', filename: 'floor_2_new_stalls.pdf', size: '2.1 MB' },
    ],
    stalls: [
      {
        id: 1,
        stallNumber: 'S-2-001',
        floor: 'Floor 2',
        description: 'New stall near escalators, between Zara and Nike. Approx 80 sqm.',
        status: 'pending', // pending or added_to_store_list
      },
      {
        id: 2,
        stallNumber: 'S-2-002',
        floor: 'Floor 2',
        description: 'New stall in corridor facing food court. Approx 60 sqm.',
        status: 'pending',
      },
      {
        id: 3,
        stallNumber: 'S-2-003',
        floor: 'Floor 2',
        description: 'Corner stall near main entrance. Approx 100 sqm.',
        status: 'pending',
      },
      {
        id: 4,
        stallNumber: 'S-2-004',
        floor: 'Floor 2',
        description: 'Stall in premium location. Approx 90 sqm.',
        status: 'pending',
      },
      {
        id: 5,
        stallNumber: 'S-2-005',
        floor: 'Floor 2',
        description: 'Stall near service area. Approx 70 sqm.',
        status: 'pending',
      },
      {
        id: 6,
        stallNumber: 'S-2-006',
        floor: 'Floor 2',
        description: 'Stall in food court extension. Approx 80 sqm.',
        status: 'pending',
      },
      {
        id: 7,
        stallNumber: 'S-2-007',
        floor: 'Floor 2',
        description: 'Stall near bookstore. Approx 75 sqm.',
        status: 'pending',
      },
      {
        id: 8,
        stallNumber: 'S-2-008',
        floor: 'Floor 2',
        description: 'End-cap stall. Approx 85 sqm.',
        status: 'pending',
      },
    ],
    thread: [],
  },
  {
    id: 102,
    mallName: 'Pacific Mall Cebu',
    city: 'Mandaue City',
    adminName: 'Lea Tan',
    adminEmail: 'ltan@pacificmall.ph',
    tier: 'Basic',
    currentStores: 48,
    submittedStalls: 3,
    applicationStatus: 'For Revision',
    submittedDate: 'March 28, 2026',
    lastUpdated: 'April 2, 2026',
    floorPlans: [],
    stalls: [
      {
        id: 1,
        stallNumber: 'S-1-001',
        floor: 'Floor 1',
        description: 'New stall near entrance',
        status: 'pending',
      },
      {
        id: 2,
        stallNumber: 'S-1-002',
        floor: 'Floor 1',
        description: 'Stall in main corridor',
        status: 'pending',
      },
      {
        id: 3,
        stallNumber: 'S-1-003',
        floor: 'Floor 1',
        description: 'Corner location stall',
        status: 'pending',
      },
    ],
    thread: [],
  },
]

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
      <path d="M12.25 21C17.0825 21 21 17.0825 21 12.25C21 7.41751 17.0825 3.5 12.25 3.5C7.41751 3.5 3.5 7.41751 3.5 12.25C3.5 17.0825 7.41751 21 12.25 21Z" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.4375 18.4373L24.5002 24.5" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function StatusBadge({ status }) {
  const statusMap = {
    'Submitted': { color: '#2563EB', bg: '#EFF6FF' },
    'For Revision': { color: '#EA580C', bg: '#FFF3E0' },
    'Approved': { color: '#16A34A', bg: '#E1FFEC' },
  }
  const style = statusMap[status] || statusMap['Submitted']
  return (
    <span style={{
      color: style.color,
      background: style.bg,
      border: `1px solid ${style.color}`,
      borderRadius: '20px',
      padding: '2px 10px',
      fontSize: '10px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

const STATUS_FILTERS = ['All', 'Submitted', 'For Revision', 'Approved']

export default function StallApplicationsTable({ onApplicationsChange, onReviewApp, liveProjects = [] }) {
  const [apps] = useState(INITIAL_STALL_APPLICATIONS)
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Get list of malls that have published AR (Live status)
  const liveProjectMallNames = new Set(liveProjects?.map(p => p.mallName) || [])

  useEffect(() => {
    onApplicationsChange(apps)
  }, [apps, onApplicationsChange])

  const visibleApps = apps.filter(app => liveProjectMallNames.has(app.mallName))

  function getFilterCount(filter) {
    if (filter === 'All') return visibleApps.length
    return visibleApps.filter(a => a.applicationStatus === filter).length
  }

  const filtered = visibleApps.filter(app => {
    const matchesFilter = activeFilter === 'All' || app.applicationStatus === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || app.mallName.toLowerCase().includes(q) || app.city.toLowerCase().includes(q) || app.adminName.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const sorted = [
    ...filtered.filter(a => a.applicationStatus !== 'Approved'),
    ...filtered.filter(a => a.applicationStatus === 'Approved'),
  ]

  const pendingCount = visibleApps.filter(a => a.applicationStatus === 'Submitted' || a.applicationStatus === 'For Revision').length

  return (
    <>
      {/* Pending count message */}
      {pendingCount > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p className="app-mgmt-subtitle" style={{ margin: 0 }}>
            <span className="app-mgmt-subtitle-alert">{pendingCount} submissions awaiting review.</span>
          </p>
        </div>
      )}

      {visibleApps.length === 0 && (
        <p style={{ margin: '0 0 16px', color: '#9B9C9C', fontFamily: 'Poppins', fontSize: 13 }}>
          No stall applications are available yet for malls with published AR.
        </p>
      )}

      {/* Toolbar */}
      <div className="app-mgmt-toolbar">
        <div className="app-mgmt-filters">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`app-mgmt-filter-btn ${activeFilter === f ? 'app-mgmt-filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
              <span className={`app-mgmt-filter-count ${activeFilter === f ? 'app-mgmt-filter-count--active' : ''}`}>
                {getFilterCount(f)}
              </span>
            </button>
          ))}
        </div>
        <div className="app-mgmt-search-wrap">
          <SearchIcon />
          <input
            className="app-mgmt-search-input"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="app-mgmt-table-wrap">
        <div className="app-mgmt-table-scroll">
          <table className="app-mgmt-table">
            <thead>
              <tr>
                <th>MALL NAME</th>
                <th>CITY</th>
                <th>ADMIN</th>
                <th>TIER</th>
                <th>CURRENT STORES</th>
                <th>NEW STALLS</th>
                <th>TOTAL AFTER</th>
                <th>EXTRA STALLS</th>
                <th>COST (if payable)</th>
                <th>APPLICATION</th>
                <th>SUBMITTED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(app => {
                const tier = SUBSCRIPTION_TIERS[app.tier]
                const totalAfter = app.currentStores + app.submittedStalls
                const exceedsBy = Math.max(0, totalAfter - tier.maxTenants)
                const cost = exceedsBy * STALL_PRICE
                return (
                  <tr key={app.id} className="app-mgmt-table-row" onClick={() => onReviewApp(app)}>
                    <td><strong>{app.mallName}</strong></td>
                    <td>{app.city}</td>
                    <td>{app.adminName}</td>
                    <td>{app.tier}</td>
                    <td>{app.currentStores}</td>
                    <td>{app.submittedStalls}</td>
                    <td>{totalAfter}</td>
                    <td>{exceedsBy > 0 ? exceedsBy : '—'}</td>
                    <td>₱{cost.toLocaleString('en-US')}</td>
                    <td><StatusBadge status={app.applicationStatus} /></td>
                    <td style={{ fontSize: '12px', color: '#9B9C9C' }}>{app.submittedDate}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="app-mgmt-review-btn app-mgmt-review-btn--stall"
                        onClick={() => onReviewApp(app)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && visibleApps.length > 0 && (
        <p style={{ textAlign: 'center', color: '#9B9C9C', marginTop: '20px' }}>
          No stall applications found.
        </p>
      )}
    </>
  )
}
