import { useState, useEffect } from 'react'
import FlowDiagrams from './FlowDiagrams'

const INITIAL_APPLICATIONS = [
  {
    id: 1,
    mallName: 'SM Seaside City Cebu',
    city: 'Cebu City',
    adminName: 'Jose Dela Cruz',
    adminEmail: 'jdelacruz@smseaside.ph',
    version: 1,
    floors: 3,
    address: 'SRP, South Road Properties, Cebu City',
    cityProvince: 'Cebu City, Cebu',
    storesCount: 4,
    operatingHours: '10:00 AM – 9:00 PM',
    logo: 'www.smsupermalls.com/logo',
    agreement: 'Setup',
    applicationStatus: 'Submitted',
    arDevelopment: '-',
    submittedDate: 'August 15, 2025',
    lastUpdated: 'September 1, 2025',
    floorPlans: [
      { floor: 'Floor 1', filename: 'floor_1_plan.pdf', size: '4.2 MB' },
      { floor: 'Floor 2', filename: 'floor_2_plan.pdf', size: '4.2 MB' },
      { floor: 'Floor 3', filename: 'floor_3_plan.pdf', size: '3.5 MB' },
    ],
    scaleReference: {
      referenceLine: 'Main corridor from Entrance A sliding doors to center fountain',
      lengthInMeters: '25 m',
      floor: 'Floor 1',
    },
    accessibilityRoutes: [
      { floor: 'Floor 1', description: 'Ramp at Main Entrance North, accessible elevator bank near center atrium' },
    ],
    emergencyExits: [
      { floor: 'Floor 1', description: 'Emergency Exit A', note: 'Near Starbucks, facing the SRP road' },
    ],
    entryPoints: [
      { name: 'South Wing Entrance', note: 'Near the parking ramp', floor: 'Floor 1' },
      { name: 'Parking Level 1', note: 'Elevator lobby entrance', floor: 'Floor 2' },
    ],
    thread: [],
  },
  {
    id: 2,
    mallName: 'Ayala Center Cebu',
    city: 'Cebu City',
    adminName: 'Maria Santos',
    adminEmail: 'msantos@ayalacebu.ph',
    version: 1,
    floors: 3,
    address: 'Cebu Business Park, Ayala Center, Cebu City',
    cityProvince: 'Cebu City, Cebu',
    storesCount: 6,
    operatingHours: '10:00 AM – 9:00 PM',
    logo: 'www.ayalamalls.com/logo',
    agreement: 'Active',
    applicationStatus: 'Approved',
    arDevelopment: 'Live',
    submittedDate: 'March 1, 2026',
    lastUpdated: 'March 1, 2026',
    floorPlans: [],
    scaleReference: { referenceLine: '', lengthInMeters: '', floor: '' },
    accessibilityRoutes: [],
    emergencyExits: [],
    entryPoints: [],
    thread: [],
  },
  {
    id: 3,
    mallName: 'Pacific Mall Cebu',
    city: 'Mandaue City',
    adminName: 'Lea Tan',
    adminEmail: 'ltan@pacificmall.ph',
    version: 1,
    floors: 2,
    address: 'A.S. Fortuna St., Bakilid, Mandaue City',
    cityProvince: 'Mandaue City, Cebu',
    storesCount: 3,
    operatingHours: '10:00 AM – 8:00 PM',
    logo: 'www.pacificmall.ph/logo',
    agreement: 'Setup',
    applicationStatus: 'For Revision',
    arDevelopment: '-',
    submittedDate: 'March 1, 2026',
    lastUpdated: 'March 1, 2026',
    floorPlans: [],
    scaleReference: { referenceLine: '', lengthInMeters: '', floor: '' },
    accessibilityRoutes: [],
    emergencyExits: [],
    entryPoints: [],
    thread: [],
  },
  {
    id: 4,
    mallName: 'Gaisano Grand Liloan',
    city: 'Liloan, Cebu',
    adminName: 'Anna Cruz',
    adminEmail: 'acruz@gaisano.ph',
    version: 1,
    floors: 2,
    address: 'National Highway, Liloan, Cebu',
    cityProvince: 'Liloan, Cebu',
    storesCount: 2,
    operatingHours: '9:00 AM – 8:00 PM',
    logo: 'www.gaisano.ph/logo',
    agreement: 'Setup',
    applicationStatus: 'Draft',
    arDevelopment: '-',
    submittedDate: '-',
    lastUpdated: '-',
    floorPlans: [],
    scaleReference: { referenceLine: '', lengthInMeters: '', floor: '' },
    accessibilityRoutes: [],
    emergencyExits: [],
    entryPoints: [],
    thread: [],
  },
  {
    id: 5,
    mallName: 'SM City Cebu',
    city: 'Cebu City',
    adminName: 'Carlos Reyes',
    adminEmail: 'creyes@smcebu.ph',
    version: 1,
    floors: 5,
    address: 'Juan Luna Ave., Cebu City',
    cityProvince: 'Cebu City, Cebu',
    storesCount: 10,
    operatingHours: '10:00 AM – 9:00 PM',
    logo: 'www.smsupermalls.com/smcity/logo',
    agreement: 'Active',
    applicationStatus: 'Approved',
    arDevelopment: 'Node Mapping',
    submittedDate: 'January 10, 2026',
    lastUpdated: 'January 15, 2026',
    floorPlans: [],
    scaleReference: { referenceLine: '', lengthInMeters: '', floor: '' },
    accessibilityRoutes: [],
    emergencyExits: [],
    entryPoints: [],
    thread: [],
  },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: 6 + i,
    mallName: `Mall ${6 + i}`,
    city: 'Cebu City',
    adminName: `Admin ${6 + i}`,
    adminEmail: `admin${6 + i}@mall.ph`,
    version: 1,
    floors: 2 + (i % 3),
    address: `Address ${6 + i}`,
    cityProvince: 'Cebu City, Cebu',
    storesCount: 3 + (i % 4),
    operatingHours: '10:00 AM – 9:00 PM',
    logo: '-',
    agreement: 'Active',
    applicationStatus: 'Approved',
    arDevelopment: ['Live', 'Testing', 'Ready', 'Node Mapping'][i % 4],
    submittedDate: 'January 2026',
    lastUpdated: 'January 2026',
    floorPlans: [],
    scaleReference: { referenceLine: '', lengthInMeters: '', floor: '' },
    accessibilityRoutes: [],
    emergencyExits: [],
    entryPoints: [],
    thread: [],
  })),
]

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
      <path d="M12.25 21C17.0825 21 21 17.0825 21 12.25C21 7.41751 17.0825 3.5 12.25 3.5C7.41751 3.5 3.5 7.41751 3.5 12.25C3.5 17.0825 7.41751 21 12.25 21Z" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.4375 18.4373L24.5002 24.5" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const STATUS_FILTERS = ['All', 'Submitted', 'For Revision', 'Approved', 'Draft']

// eslint-disable-next-line no-unused-vars
export default function ApplicationsTable({ applications, onApplicationsChange, onReviewApp }) {
  // eslint-disable-next-line no-unused-vars
  const [apps, setApps] = useState(INITIAL_APPLICATIONS)
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    onApplicationsChange(apps)
  }, [apps, onApplicationsChange])

  function getFilterCount(filter) {
    if (filter === 'All') return apps.length
    return apps.filter(a => a.applicationStatus === filter).length
  }

  function getAppStatusVariant(status) {
    const map = { 'Submitted': 'submitted', 'For Revision': 'for-revision', 'Approved': 'approved', 'Draft': 'draft' }
    return map[status] || 'default'
  }

  function getArStatusVariant(status) {
    const map = { 'Live': 'live', 'Testing': 'testing', 'Ready': 'ready', 'Node Mapping': 'node-mapping', 'Pending': 'pending', 'Unpublished': 'for-revision' }
    return map[status] || 'default'
  }

  const filtered = apps.filter(app => {
    const matchesFilter = activeFilter === 'All' || app.applicationStatus === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || app.mallName.toLowerCase().includes(q) || app.city.toLowerCase().includes(q) || app.adminName.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const sorted = [
    ...filtered.filter(a => a.applicationStatus !== 'Approved'),
    ...filtered.filter(a => a.applicationStatus === 'Approved'),
  ]

  const pendingCount = apps.filter(a => a.applicationStatus === 'Submitted' || a.applicationStatus === 'For Revision').length

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

      {/* Flow diagrams */}
      <FlowDiagrams />

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
                <th>VERSION</th>
                <th>NO. OF FLOORS</th>
                <th>AGREEMENT</th>
                <th>APPLICATION</th>
                <th>AR DEVELOPMENT</th>
                <th>SUBMITTED</th>
                <th>LAST UPDATED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(app => (
                <tr
                  key={app.id}
                  className={app.applicationStatus === 'Approved' ? 'row--approved' : ''}
                  onClick={() => onReviewApp(app)}
                >
                  <td>
                    <div className="app-mgmt-mall-name">{app.mallName}</div>
                  </td>
                  <td>{app.city}</td>
                  <td>
                    <div className="app-mgmt-admin-name">{app.adminName}</div>
                    <div className="app-mgmt-admin-email">{app.adminEmail}</div>
                  </td>
                  <td>{app.version}</td>
                  <td>{app.floors}</td>
                  <td>{app.agreement}</td>
                  <td>
                    <span className={`app-status-badge app-status-badge--${getAppStatusVariant(app.applicationStatus)}`}>
                      {app.applicationStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`app-status-badge app-status-badge--${getArStatusVariant(app.arDevelopment)}`}>
                      {app.arDevelopment}
                    </span>
                  </td>
                  <td>{app.submittedDate}</td>
                  <td>{app.lastUpdated}</td>
                  <td>
                    <button
                      className="app-mgmt-review-btn"
                      onClick={e => { e.stopPropagation(); onReviewApp(app) }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: '#9B9C9C', padding: '32px', fontFamily: 'Poppins' }}>
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="app-mgmt-hint">Click any row to view full details.</p>
    </>
  )
}
