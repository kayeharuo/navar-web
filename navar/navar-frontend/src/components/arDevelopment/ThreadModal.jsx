import { useEffect } from 'react'
import ThreadTab from '../applicationManagement/ThreadTab'

export default function ThreadModal({ project, onClose, onSendNote, onPublish }) {
  useEffect(() => {
    const close = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="ar-thread-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="ar-thread-drawer">
      <div className="ar-thread-header"><div><h3>{project.mallName} / Version {project.version}</h3><p>{project.arStatus}{project.readOnly ? ' / Read-only' : ''}</p></div><button onClick={onClose}>Close</button></div>
      <p className="workflow-info">{project.mallApprovedAt ? 'Mall approval recorded. Publishing waits for the subscription gate.' : 'The mall reviews the AR carefully before approving. Concerns belong in this thread.'}</p>
      <div className="ar-thread-body"><ThreadTab app={project} onSendNote={(note, attachments) => onSendNote(project.id, note, attachments)} /></div>
      {!project.readOnly && project.mallApprovedAt && project.arStatus === 'Ready' && <button onClick={onPublish}>Retry publishing</button>}
    </div>
  </div>
}
