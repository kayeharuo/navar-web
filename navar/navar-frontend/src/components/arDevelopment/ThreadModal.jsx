import { useEffect } from 'react'
import { X } from 'lucide-react'
import ThreadTab from '../applicationManagement/ThreadTab'
import LoadingSpinner from '../ui/LoadingSpinner'
import '../../styles/applicationManagement/applicationManagement.css'

export default function ThreadModal({ project, onClose, onSendNote, onPublish, onReload }) {
  useEffect(() => {
    const close = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="ar-thread-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="ar-thread-drawer" role="dialog" aria-modal="true" aria-labelledby="ar-thread-title">
      <div className="ar-thread-header"><div><h2 id="ar-thread-title" className="ar-detail-title">{project.mallName}</h2><p className="ar-thread-subtitle">Version {project.version} / {project.arStatus}{project.threadReadOnly ? ' / Read-only' : ''}</p></div><button type="button" className="ar-thread-close" aria-label="Close thread" onClick={onClose}><X size={20} /></button></div>
      <p className={`ar-thread-approval-banner ar-thread-approval-banner--${project.mallApprovedAt ? 'approved' : 'waiting'}`}>{project.threadReadOnly?'A newer version or attempt exists. This thread is read-only.':project.arStatus==='Live'?'This AR version is Live. You can continue the discussion here.':project.mallApprovedAt?'Mall approval recorded. Publishing waits for the subscription gate.':'The mall reviews the AR carefully before approving. Concerns belong in this thread.'}</p>
      <div className="ar-thread-divider" />
      <div className="ar-thread-body">
        <div className="ar-thread-section-header"><span className="ar-thread-section-bar" /><h3 className="ar-thread-section-label">Development Thread</h3></div>
        {project.threadLoading ? <div className="ar-thread-load-state"><LoadingSpinner label="Loading Thread..." showLabel /></div> : project.threadError ? <div className="ar-thread-load-state" role="alert"><p>{project.threadError}</p><button type="button" className="ar-thread-send-btn" onClick={onReload}>Try again</button></div> : <ThreadTab app={project} onSendNote={(note, attachments) => onSendNote(project.id, note, attachments)} />}
      </div>
      {!project.readOnly && project.mallApprovedAt && project.arStatus === 'Ready' && <div className="ar-thread-publish-footer"><button className="ar-thread-publish-footer-btn" onClick={onPublish}>Retry publishing</button></div>}
    </div>
  </div>
}
