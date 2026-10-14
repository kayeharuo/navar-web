import { useState, useEffect } from 'react'
import ARDevFlowDiagrams from './ARDevFlowDiagrams'
import TestingModal from './TestingModal'
import ThreadModal from './ThreadModal'
import PublishModal from './PublishModal'
import ARDevDetail from './ARDevDetail'
import ToBeAddedStallsModal from './ToBeAddedStallsModal'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../config/api'

const TIER_ORDER = { Premium: 0, Standard: 1, Basic: 2 }

const STATUS_FILTERS = ['All', 'Pending', 'Node Mapping', 'Suspended', 'Navigation Testing', 'Ready for activation', 'Live']

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
    'Suspended': 'suspended',
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

export default function ARDevTable({ incomingProjects, stallApplications = [] }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [testingProject, setTestingProject] = useState(null)
  const [threadProject, setThreadProject] = useState(null)
  const [publishProject, setPublishProject] = useState(null)
  const [detailProject, setDetailProject] = useState(null)
  const [stallsModalProject, setStallsModalProject] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    apiRequest('/api/ar-developments')
      .then(projects => {
        if (!mounted) return
        setItems(sortProjects(projects))
        setLoadError('')
      })
      .catch(error => {
        if (mounted) setLoadError(error.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const projectId = Number(searchParams.get('projectId'))
    if (!projectId) return
    const project = items.find(item => item.id === projectId)
    if (project) {
      setThreadProject(project)
      apiRequest(`/api/ar-developments/${project.id}/thread`)
        .then(result => setThreadProject(current => current?.id === project.id ? { ...current, thread: result.messages || [] } : current))
        .catch(error => console.error('AR development thread load failed:', error))
    }
  }, [items, searchParams])

  useEffect(() => {
    if (!incomingProjects || incomingProjects.length === 0) return
    setItems(prev => {
      const existingIds = new Set(prev.map(p => p.id))
      const newItems = incomingProjects.filter(p => !existingIds.has(p.id))
      if (newItems.length === 0) return prev
      return sortProjects([...prev, ...newItems])
    })
  }, [incomingProjects])

  useEffect(() => {
    if (!stallApplications || stallApplications.length === 0) return

    setItems(prev => {
      let hasChanges = false

      const updated = prev.map(project => {
        const stallApproval = stallApplications.find(app => app.mallName === project.mallName)
        if (!stallApproval) return project

        hasChanges = true
        const stallAdditions = stallApproval.stalls || stallApproval.stallAdditions || project.stallAdditions || []

        return {
          ...project,
          arStatus: project.arStatus === 'Live' ? 'Unpublished' : project.arStatus,
          stallApplication: stallApproval,
          stallAdditions,
          lastUpdated: stallApproval.lastUpdated || project.lastUpdated,
        }
      })

      return hasChanges ? sortProjects(updated) : prev
    })
  }, [stallApplications])

  function updateItem(id, changes) {
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    setItems(prev => prev.map(p => p.id === id ? { ...p, ...changes, lastUpdated: now } : p))
  }

  async function handleEditMap(project) {
    if (project.arStatus === 'Suspended') return
    if (project.arStatus === 'Pending') {
      const confirmed = window.confirm(`Edit the map for ${project.mallName}? This will move the AR development to Node Mapping.`)
      if (!confirmed) return
      try {
        const updated = await apiRequest(`/api/ar-developments/${project.id}/start-mapping`, { method: 'POST' })
        setItems(prev => sortProjects(prev.map(item => item.id === project.id
          ? { ...item, arStatus: 'Node Mapping', lastUpdated: updated.ar_development_updated_at || item.lastUpdated }
          : item
        )))
      } catch (error) {
        console.error('Node mapping request failed:', error)
        window.alert(error.message)
        return
      }
    }
    navigate(`/ar-development/editor/${project.id}`, { state: { mallName: project.mallName } })
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

  async function handleViewThread(project) {
    const latest = items.find(p => p.id === project.id) || project
    setThreadProject(latest)
    try {
      const result = await apiRequest(`/api/ar-developments/${project.id}/thread`)
      setThreadProject(current => current?.id === project.id ? { ...current, thread: result.messages || [] } : current)
    } catch (error) {
      console.error('AR development thread load failed:', error)
    }
  }

  async function handleSendNote(id, note) {
    try {
      const sentMessage = await apiRequest(`/api/ar-developments/${id}/thread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note }),
      })
      const message = { ...sentMessage, sender: sentMessage.isAdmin ? 'admin' : 'mall' }
      const updatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      setItems(prev => prev.map(project => project.id === id
        ? { ...project, thread: [...(project.thread || []), message], lastUpdated: updatedAt }
        : project
      ))
      setThreadProject(prev => prev?.id === id
        ? { ...prev, thread: [...(prev.thread || []), message] }
        : prev
      )
    } catch (error) {
      console.error('AR development thread request failed:', error)
      window.alert(error.message)
    }
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

  function handleStallStatusChange(projectId, stallId, newStatus) {
    setItems(prev => prev.map(p => {
      if (p.id !== projectId) return p
      return {
        ...p,
        stallAdditions: (p.stallAdditions || []).map(s =>
          s.id === stallId ? { ...s, status: newStatus } : s
        ),
      }
    }))
    // Update detail project if it's open
    if (detailProject && detailProject.id === projectId) {
      setDetailProject(prev => ({
        ...prev,
        stallAdditions: (prev.stallAdditions || []).map(s =>
          s.id === stallId ? { ...s, status: newStatus } : s
        ),
      }))
    }
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
      {loadError && <div className="app-mgmt-callout app-mgmt-callout--error" role="alert">{loadError}</div>}
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
              {loading ? (
                <tr>
                  <td colSpan={11} className="ar-dev-table-empty ar-dev-table-loading">
                    <span className="table-loading"><span className="table-loading-spinner" />Loading AR development projects...</span>
                  </td>
                </tr>
              ) : filtered.map(project => (
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
                        onClick={() => handleEditMap(project)}
                        disabled={project.arStatus === 'Suspended'}
                        title={project.arStatus === 'Suspended' ? 'Map editing is suspended while this application is under revision' : 'Open the node editor'}
                      >
                        Edit Map
                      </button>

                      {project.stallApplication?.applicationStatus === 'Approved' && project.stallAdditions && project.stallAdditions.length > 0 && (
                        <button
                          className="ar-dev-action-btn ar-dev-action-btn--stall-additions"
                          onClick={() => setStallsModalProject(project)}
                          title="To Be Added Stalls"
                        >
                          To Be Added Stalls ({project.stallAdditions.filter(s => s.status === 'pending').length})
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
              {!loading && filtered.length === 0 && (
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

      {detailProject && (
        <ARDevDetail
          project={detailProject}
          onClose={() => setDetailProject(null)}
          onStallStatusChange={handleStallStatusChange}
        />
      )}

      {stallsModalProject && (
        <ToBeAddedStallsModal
          project={stallsModalProject}
          onClose={() => setStallsModalProject(null)}
        />
      )}
    </>
  )
}
