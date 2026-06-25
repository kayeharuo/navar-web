import { useState, useEffect } from 'react'
import ARDevFlowDiagrams from './ARDevFlowDiagrams'
import TestingModal from './TestingModal'
import ThreadModal from './ThreadModal'
import PublishModal from './PublishModal'

const TIER_ORDER = { Premium: 0, Standard: 1, Basic: 2 }

const STATUS_FILTERS = ['All', 'Pending', 'Node Mapping', 'Navigation Testing', 'Ready for activation', 'Live']

const INITIAL_PROJECTS = [
  {
    id: 1,
    mallName: 'SM Seaside City Cebu',
    tier: 'Premium',
    city: 'Cebu City',
    adminName: 'Jose Dela Cruz',
    adminEmail: 'jdelacruz@smseaside.ph',
    version: 1,
    floors: 3,
    nodes: 78,
    edges: 103,
    agreement: 'Setup',
    applicationStatus: 'Approved',
    arStatus: 'Ready for activation',
    dateAdded: 'September 1, 2025',
    lastUpdated: 'September 20, 2025',
    thread: [
      {
        id: 1,
        sender: 'system',
        name: 'NavAR System',
        date: 'September 20, 2025',
        message: 'Confirmation request sent to Jose Dela Cruz. Email sent to jdelacruz@smseaside.ph with map summary (78 nodes, 103 edges, 3 floors).',
      },
    ],
    testErrors: [],
  },
  {
    id: 2,
    mallName: 'Ayala Center Cebu',
    tier: 'Premium',
    city: 'Cebu City',
    adminName: 'Maria Santos',
    adminEmail: 'msantos@ayalacebu.ph',
    version: 1,
    floors: 3,
    nodes: 95,
    edges: 142,
    agreement: 'Active',
    applicationStatus: 'Approved',
    arStatus: 'Live',
    dateAdded: 'March 1, 2025',
    lastUpdated: 'March 13, 2025',
    thread: [],
    testErrors: [],
  },
  {
    id: 3,
    mallName: 'Pacific Mall Cebu',
    tier: 'Standard',
    city: 'Mandaue City',
    adminName: 'Lea Tan',
    adminEmail: 'ltan@pacificmall.ph',
    version: 1,
    floors: 2,
    nodes: 62,
    edges: 89,
    agreement: 'Setup',
    applicationStatus: 'Approved',
    arStatus: 'Node Mapping',
    dateAdded: 'March 3, 2025',
    lastUpdated: 'March 20, 2025',
    thread: [],
    testErrors: [
      'Floor 2 has unmapped dead-end corridors near the East Wing.',
      'Scale reference calibration is off by more than 15% on Floor 1.',
    ],
  },
  {
    id: 4,
    mallName: 'Gaisano Grand Liloan',
    tier: 'Standard',
    city: 'Liloan, Cebu',
    adminName: 'Anna Cruz',
    adminEmail: 'acruz@gaisanogm.ph',
    version: 1,
    floors: 2,
    nodes: 41,
    edges: 58,
    agreement: 'Setup',
    applicationStatus: 'Approved',
    arStatus: 'Navigation Testing',
    dateAdded: 'November 23, 2025',
    lastUpdated: 'December 10, 2025',
    thread: [],
    testErrors: [],
  },
  {
    id: 5,
    mallName: 'Gaisano Grand Minglanilla',
    tier: 'Basic',
    city: 'Minglanilla, Cebu',
    adminName: 'Lily Cruz',
    adminEmail: 'lcruz@gaisanogm.ph',
    version: 1,
    floors: 3,
    nodes: 44,
    edges: 61,
    agreement: 'Setup',
    applicationStatus: 'Approved',
    arStatus: 'Ready for activation',
    dateAdded: 'August 23, 2025',
    lastUpdated: 'December 10, 2025',
    thread: [
      {
        id: 1,
        sender: 'system',
        name: 'NavAR System',
        date: 'December 8, 2025',
        message: 'Confirmation request sent to Lily Cruz. Email sent to lcruz@gaisanogm.ph with map summary (44 nodes, 61 edges, 3 floors).',
      },
      {
        id: 2,
        sender: 'mall',
        name: 'Lily C.',
        date: 'December 10, 2025',
        message: "I've reviewed the map preview. All store entrances look correct and the PWD routes are properly marked. You may proceed with activation.",
      },
    ],
    testErrors: [],
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

function getArStatusVariant(status) {
  const map = {
    'Pending': 'pending',
    'Node Mapping': 'node-mapping',
    'Navigation Testing': 'nav-testing',
    'Ready for activation': 'ready',
    'Live': 'live',
    'Unpublished': 'unpublished',
  }
  return map[status] || 'pending'
}

function sortProjects(projects) {
  const active = projects.filter(p => p.arStatus !== 'Live' && p.arStatus !== 'Unpublished')
  const live = projects.filter(p => p.arStatus === 'Live' || p.arStatus === 'Unpublished')

  const sortByTierDate = (a, b) => {
    const tierDiff = (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3)
    if (tierDiff !== 0) return tierDiff
    return new Date(a.dateAdded) - new Date(b.dateAdded)
  }

  return [...active.sort(sortByTierDate), ...live.sort(sortByTierDate)]
}

export default function ARDevTable({ incomingProjects }) {
  const [items, setItems] = useState(INITIAL_PROJECTS)
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [testingProject, setTestingProject] = useState(null)
  const [threadProject, setThreadProject] = useState(null)
  const [publishProject, setPublishProject] = useState(null)

  useEffect(() => {
    if (!incomingProjects || incomingProjects.length === 0) return
    setItems(prev => {
      const existingIds = new Set(prev.map(p => p.id))
      const newItems = incomingProjects.filter(p => !existingIds.has(p.id))
      if (newItems.length === 0) return prev
      return sortProjects([...prev, ...newItems])
    })
  }, [incomingProjects])

  function updateItem(id, changes) {
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    setItems(prev => prev.map(p => p.id === id ? { ...p, ...changes, lastUpdated: now } : p))
  }

  function handleStartMapping(id) {
    updateItem(id, { arStatus: 'Node Mapping' })
  }

  function handleSubmitForTesting(project) {
    setTestingProject(project)
  }

  function handleTestingProceed() {
    if (!testingProject) return
    updateItem(testingProject.id, { arStatus: 'Navigation Testing' })
    setTestingProject(null)
  }

  function handleMarkAsReady(id) {
    const project = items.find(p => p.id === id)
    if (!project) return
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const systemMsg = {
      id: Date.now(),
      sender: 'system',
      name: 'NavAR System',
      date: now,
      message: `Confirmation request sent to ${project.adminName}. Email sent to ${project.adminEmail} with map summary (${project.nodes ?? 0} nodes, ${project.edges ?? 0} edges, ${project.floors} floors).`,
    }
    setItems(prev => prev.map(p => p.id === id
      ? { ...p, arStatus: 'Ready for activation', thread: [...(p.thread || []), systemMsg], lastUpdated: now }
      : p
    ))
  }

  function handleViewThread(project) {
    const latest = items.find(p => p.id === project.id) || project
    setThreadProject(latest)
  }

  function handleSendNote(id, note) {
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    setItems(prev => prev.map(p => {
      if (p.id !== id) return p
      return {
        ...p,
        thread: [
          ...p.thread,
          { id: Date.now(), sender: 'admin', name: 'Delicious B.', isAdmin: true, date: now, message: note },
        ],
        lastUpdated: now,
      }
    }))
    setThreadProject(prev => {
      if (!prev || prev.id !== id) return prev
      return {
        ...prev,
        thread: [
          ...prev.thread,
          { id: Date.now(), sender: 'admin', name: 'Delicious B.', isAdmin: true, date: now, message: note },
        ],
      }
    })
  }

  function handlePublishConfirm() {
    if (!publishProject) return
    updateItem(publishProject.id, { arStatus: 'Live' })
    setPublishProject(null)
  }

  function handleUnpublish(id) {
    updateItem(id, { arStatus: 'Unpublished' })
  }

  function handleReactivate(id) {
    updateItem(id, { arStatus: 'Ready for activation' })
  }

  function getFilterCount(filter) {
    if (filter === 'All') return items.length
    return items.filter(p => p.arStatus === filter).length
  }

  const filtered = sortProjects(items.filter(p => {
    const matchesFilter = activeFilter === 'All' || p.arStatus === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q
      || p.mallName.toLowerCase().includes(q)
      || p.city.toLowerCase().includes(q)
      || p.adminName.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  }))

  const inDevCount = items.filter(p => p.arStatus !== 'Live').length

  return (
    <>
      {/* Header */}
      <div className="ar-dev-header">
        <h1 className="ar-dev-title">AR Development</h1>
        <p className="ar-dev-subtitle">
          Track and manage AR map development for approved mall partners.{' '}
          {inDevCount > 0 && (
            <span className="ar-dev-subtitle-alert">
              {inDevCount} {inDevCount === 1 ? 'mall' : 'malls'} awaiting AR development completion.
            </span>
          )}
        </p>
      </div>

      {/* Flow diagrams */}
      <ARDevFlowDiagrams />

      {/* Toolbar */}
      <div className="ar-dev-toolbar">
        <div className="ar-dev-filters">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`ar-dev-filter-btn${activeFilter === f ? ' ar-dev-filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
              <span className={`ar-dev-filter-count${activeFilter === f ? ' ar-dev-filter-count--active' : ''}`}>
                {getFilterCount(f)}
              </span>
            </button>
          ))}
        </div>
        <div className="ar-dev-search-wrap">
          <SearchIcon />
          <input
            className="ar-dev-search-input"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="ar-dev-table-wrap">
        <div className="ar-dev-table-scroll">
          <table className="ar-dev-table">
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
                <th>DATE ADDED</th>
                <th>LAST UPDATED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(project => (
                <tr
                  key={project.id}
                  className={project.arStatus === 'Live' || project.arStatus === 'Unpublished' ? 'row--live' : ''}
                >
                  <td>
                    <div className="ar-dev-mall-name">{project.mallName}</div>
                    <div className="ar-dev-mall-tier">{project.tier}</div>
                  </td>
                  <td>{project.city}</td>
                  <td>
                    <div className="ar-dev-admin-name">{project.adminName}</div>
                    <div className="ar-dev-admin-email">{project.adminEmail}</div>
                  </td>
                  <td>{project.version}</td>
                  <td>{project.floors}</td>
                  <td>{project.agreement}</td>
                  <td>
                    <span className="app-status-badge-ar app-status-badge-ar--approved">
                      {project.applicationStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`ar-status-badge ar-status-badge--${getArStatusVariant(project.arStatus)}`}>
                      {project.arStatus === 'Ready for activation' ? 'Ready for Activation' : project.arStatus}
                    </span>
                  </td>
                  <td>{project.dateAdded}</td>
                  <td>{project.lastUpdated}</td>
                  <td>
                    <div className="ar-dev-action-cell">
                      <button
                        className="ar-dev-action-btn ar-dev-action-btn--edit-map"
                        onClick={() => {}}
                        title="Edit Map (not yet available)"
                      >
                        Edit Map
                      </button>

                      {project.arStatus === 'Pending' && (
                        <button
                          className="ar-dev-action-btn ar-dev-action-btn--start"
                          onClick={() => handleStartMapping(project.id)}
                        >
                          Start Mapping
                        </button>
                      )}

                      {project.arStatus === 'Node Mapping' && (
                        <button
                          className="ar-dev-action-btn ar-dev-action-btn--test"
                          onClick={() => handleSubmitForTesting(project)}
                        >
                          Submit for Testing
                        </button>
                      )}

                      {project.arStatus === 'Navigation Testing' && (
                        <button
                          className="ar-dev-action-btn ar-dev-action-btn--mark-ready"
                          onClick={() => handleMarkAsReady(project.id)}
                        >
                          Mark as Ready
                        </button>
                      )}

                      {project.arStatus === 'Ready for activation' && (
                        <>
                          <button
                            className="ar-dev-action-btn ar-dev-action-btn--view-thread"
                            onClick={() => handleViewThread(project)}
                          >
                            View Thread
                          </button>
                          {(() => {
                            const isApproved = project.thread && project.thread.some(msg => msg.sender === 'mall')
                            return (
                              <button
                                className={`ar-dev-action-btn ar-dev-action-btn--publish${!isApproved ? ' ar-dev-action-btn--publish-disabled' : ''}`}
                                onClick={() => isApproved && setPublishProject(project)}
                                disabled={!isApproved}
                              >
                                Publish
                              </button>
                            )
                          })()}
                        </>
                      )}

                      {project.arStatus === 'Live' && (
                        <button
                          className="ar-dev-action-btn ar-dev-action-btn--unpublish"
                          onClick={() => handleUnpublish(project.id)}
                        >
                          Unpublish
                        </button>
                      )}

                      {project.arStatus === 'Unpublished' && (
                        <button
                          className="ar-dev-action-btn ar-dev-action-btn--reactivate"
                          onClick={() => handleReactivate(project.id)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: '#9B9C9C', padding: '32px', fontFamily: 'Poppins' }}>
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {testingProject && (
        <TestingModal
          mallName={testingProject.mallName}
          errors={testingProject.testErrors || []}
          onCancel={() => setTestingProject(null)}
          onProceed={handleTestingProceed}
        />
      )}

      {threadProject && (
        <ThreadModal
          project={threadProject}
          onClose={() => setThreadProject(null)}
          onSendNote={handleSendNote}
          onPublish={() => {
            setPublishProject(threadProject)
            setThreadProject(null)
          }}
        />
      )}

      {publishProject && (
        <PublishModal
          mallName={publishProject.mallName}
          onCancel={() => setPublishProject(null)}
          onConfirm={handlePublishConfirm}
        />
      )}
    </>
  )
}
