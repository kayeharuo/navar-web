import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function ARDevDetail({ project, onClose, onStallStatusChange }) {
  const [activeTab, setActiveTab] = useState('main')
  const [stalls, setStalls] = useState(project.stallAdditions || [])

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function handleStallStatusChange(stallId, newStatus) {
    setStalls(prev => prev.map(s => s.id === stallId ? { ...s, status: newStatus } : s))
    onStallStatusChange(project.id, stallId, newStatus)
  }

  const pendingCount = stalls.filter(s => s.status === 'pending').length
  const publishedCount = stalls.filter(s => s.status === 'published').length
  const canPublishMain = publishedCount === stalls.length && stalls.length > 0

  return (
    <>
      <div className="ar-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()} />
      <div className="ar-detail-panel">
        <div className="ar-detail-header">
          <div>
            <h2 className="ar-detail-title">{project.mallName}</h2>
            <p className="ar-detail-meta">{project.city} · {project.adminName}</p>
          </div>
          <button className="ar-detail-close" onClick={onClose}>X</button>
        </div>

        <div className="ar-detail-divider" />

        <div className="ar-detail-tabs">
          <button
            className={`ar-detail-tab ${activeTab === 'main' ? 'ar-detail-tab--active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main AR Development
          </button>
          {stalls.length > 0 && (
            <button
              className={`ar-detail-tab ${activeTab === 'stalls' ? 'ar-detail-tab--active' : ''}`}
              onClick={() => setActiveTab('stalls')}
            >
              Stall Additions ({pendingCount} to add)
            </button>
          )}
        </div>

        <div className="ar-detail-divider" />

        <div className="ar-detail-body">
          {activeTab === 'main' ? (
            <div>
              <div className="ar-detail-section">
                <span className="ar-detail-label">AR STATUS</span>
                <span className="ar-detail-value">{project.arStatus}</span>
              </div>
              <div className="ar-detail-section">
                <span className="ar-detail-label">VERSION</span>
                <span className="ar-detail-value">{project.version}</span>
              </div>
              <div className="ar-detail-section">
                <span className="ar-detail-label">FLOORS</span>
                <span className="ar-detail-value">{project.floors}</span>
              </div>
              <div className="ar-detail-section">
                <span className="ar-detail-label">NODES</span>
                <span className="ar-detail-value">{project.nodes}</span>
              </div>
              <div className="ar-detail-section">
                <span className="ar-detail-label">EDGES</span>
                <span className="ar-detail-value">{project.edges}</span>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0' }}>
                  {pendingCount > 0 ? (
                    <>
                      <strong>{pendingCount}</strong> stall{pendingCount !== 1 ? 's' : ''} awaiting publication
                    </>
                  ) : (
                    'All stalls have been published. The main AR development can now be published.'
                  )}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stalls.map(stall => (
                  <div
                    key={stall.id}
                    style={{
                      padding: '12px',
                      border: '0.5px solid #E2E8F0',
                      borderRadius: '5px',
                      background: stall.status === 'published' ? '#E1FFEC' : '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', marginBottom: '4px' }}>{stall.stallNumber}</div>
                      <div style={{ fontSize: '12px', color: '#9B9C9C', marginBottom: '4px' }}>
                        Floor: {stall.floor}
                      </div>
                      <div style={{ fontSize: '12px', color: '#4E4E4E', lineHeight: '1.4' }}>
                        {stall.description}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStallStatusChange(stall.id, stall.status === 'pending' ? 'published' : 'pending')}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        background: stall.status === 'published' ? '#016630' : '#FF9233',
                        color: '#fff',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stall.status === 'pending' ? 'Mark Published' : '✓ Published'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeTab === 'stalls' && canPublishMain && (
          <div style={{
            padding: '12px',
            margin: '12px',
            borderRadius: '5px',
            background: '#E1FFEC',
            border: '1px solid #016630',
            color: '#016630',
            fontSize: '13px',
            fontWeight: '500',
          }}>
            ✓ All stalls published. Main AR development is ready to publish.
          </div>
        )}
      </div>
    </>
  )
}
