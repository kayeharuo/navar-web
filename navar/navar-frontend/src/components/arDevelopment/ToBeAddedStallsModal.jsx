import SubmissionTab from '../applicationManagement/SubmissionTab'

function buildStallApplication(project) {
  if (!project) return null

  if (project.stallApplication) return project.stallApplication

  return {
    mallName: project.mallName,
    city: project.city,
    adminName: project.adminName,
    adminEmail: project.adminEmail,
    tier: project.tier,
    currentStores: project.currentStores ?? 0,
    submittedStalls: project.stallAdditions?.length ?? 0,
    applicationStatus: project.applicationStatus || 'Approved',
    submittedDate: project.submittedDate || '-',
    lastUpdated: project.lastUpdated || '-',
    floorPlans: project.floorPlans || [],
    stalls: project.stallAdditions || [],
    thread: project.thread || [],
  }
}

export default function ToBeAddedStallsModal({ project, onClose }) {
  const stallApplication = buildStallApplication(project)
  if (!stallApplication) return null

  return (
    <>
      <div className="review-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="review-panel" style={{ position: 'relative' }}>
          <button className="review-panel-close" onClick={onClose}>✕</button>

          <div className="review-panel-header">
            <h2 className="review-panel-title">{stallApplication.mallName}</h2>
            <p className="review-panel-meta">{stallApplication.city} · {stallApplication.adminName} · {stallApplication.adminEmail}</p>
            <div style={{ marginTop: '16px', marginBottom: '8px' }}>
              <span className="review-badge-pill review-badge-pill--green">Stalls to Be Added</span>
            </div>
          </div>

          <div className="review-panel-divider" />

          <div className="review-panel-body">
            <SubmissionTab app={stallApplication} isStallApplication={true} />
          </div>
        </div>
      </div>
    </>
  )
}
