import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

export default function InquiryDecisionModal({ inquiry, duplicates=[], decision, busy, error, onClose, onConfirm, onShowDuplicates }) {
  const dialog = useRef(null)
  const [reason, setReason] = useState('')
  const [acknowledgeDuplicates,setAcknowledgeDuplicates]=useState(false)
  const [validation, setValidation] = useState('')
  const submitting = useRef(false)
  async function confirm(event) {
    event?.preventDefault()
    if (busy || submitting.current) return
    if (approve && duplicates.length && !acknowledgeDuplicates) { setValidation('Review the possible duplicates and check the confirmation box before approving.'); return }
    if (!approve && !reason.trim()) { setValidation('Enter a reason for rejection.'); return }
    setValidation('')
    submitting.current = true
    try { await onConfirm(approve ? undefined : reason.trim(), acknowledgeDuplicates) }
    catch (failure) { setValidation(failure.message || 'Unable to submit the decision.') }
    finally { submitting.current = false }
  }
  const approve = decision === 'approve'
  useEffect(() => {
    const node = dialog.current
    if (!node.open) node.showModal()
    return () => node.close()
  }, [])
  const details = [
    ['Mall name', inquiry.mallName], ['Contact person', inquiry.contactPerson],
    ['Email', inquiry.email], ['Phone', inquiry.phone], ['Address', inquiry.location],
    ['Declared floors', inquiry.floors], ['Interested tier', inquiry.tier],
    ['Coverage area', inquiry.mallCoverageArea], ['Inquiry message', inquiry.description],
  ]
  return createPortal(
    <dialog ref={dialog} className="inq-decision-dialog" aria-labelledby="inq-decision-title" onCancel={event => event.preventDefault()}>
      <form onSubmit={confirm} noValidate>
        <header>
          <h2 id="inq-decision-title">{approve ? 'Review and approve inquiry' : 'Reject inquiry'}</h2>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="inq-decision-body">
          <p>{approve
            ? 'Review the information submitted by the mall. Approval sends a secure setup link to the contact email below. The owner creates their password and completes their subscription, payment and mall details during onboarding.'
            : 'Provide a reason for declining this inquiry. The reason will be saved in the conversation and emailed to the mall contact.'}</p>
          <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not provided'}</dd></div>)}</dl>
          {approve && duplicates.length>0 && <div className="inq-duplicate-warning"><strong>Possible duplicate inquiries</strong><button type="button" className="inq-duplicate-link" disabled={busy} onClick={onShowDuplicates}>View matching submissions</button><ul>{duplicates.map(d=><li key={d.id}>{d.mallName} · #{d.id} · {d.status} — {d.reason}</li>)}</ul><label><input type="checkbox" checked={acknowledgeDuplicates} onChange={e=>setAcknowledgeDuplicates(e.target.checked)} disabled={busy}/> I reviewed these matches and confirm this inquiry should proceed.</label></div>}
          {!approve && <label className="inq-decision-reason">Reason for rejection <span aria-hidden="true">*</span>
            <textarea required maxLength={3000} rows={4} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} placeholder="Explain why this inquiry cannot be approved." />
          </label>}

        </div>
        {(error || validation) && <p role="alert" className="inq-decision-error">{error || validation}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" onClick={confirm} className={approve ? 'inq-decision-approve' : 'inq-decision-reject'} disabled={busy}>
            {busy ? 'Processing…' : approve ? 'Approve & Send Setup Link' : 'Reject & Notify'}
          </button>
        </footer>
      </form>
    </dialog>, document.body
  )
}
