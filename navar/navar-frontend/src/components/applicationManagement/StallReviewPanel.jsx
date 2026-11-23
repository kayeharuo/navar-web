import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CircleCheck, CircleAlert, FilePenLine } from 'lucide-react'
import ThreadTab from './ThreadTab'
import Stepper from './Stepper'
import '../../styles/subscriptionManagement/subscriptionModal.css'
const money=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(n||0)/100)
function InfoRow({label,children}) {
 return <div className="review-info-row"><span className="review-info-label">{label}</span><span className="review-info-value">{children || 'Not provided'}</span></div>
}
function SectionTitle({children}) {
 return <div className="review-section-header"><span className="review-section-accent accent--blue"/><h3 className="review-section-title">{children}</h3></div>
}
export default function StallReviewPanel({app,onClose,onDecision,onSendNote,initialTab='submission'}){
 const [tab,setTab]=useState(initialTab),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[note,setNote]=useState(''),[revision,setRevision]=useState(false),[result,setResult]=useState(null)
 useEffect(()=>{const handleKey=e=>{if(e.key==='Escape'&&!busy&&!confirm&&!revision&&!result)onClose()};window.addEventListener('keydown',handleKey);return()=>window.removeEventListener('keydown',handleKey)},[busy,confirm,revision,result,onClose])
 async function decide(action){setBusy(true);try{const r=await onDecision(action,note);setConfirm(false);setRevision(false);setResult({success:true,title:action==='approve'?'Stalls approved':'Corrections requested',message:r?.message||(action==='approve'?'The stall application is approved. AR development has returned to Node Mapping, and the mall admin has been notified.':'The application has been returned for revision. The mall admin has been notified.')})}catch(e){setResult({success:false,title:'Action could not be completed',message:e.message})}finally{setBusy(false)}}
 return <><div className="review-overlay" onClick={()=>!busy&&onClose()}><section className="review-panel stall-review-panel review-panel--compact" role="dialog" aria-modal="true" aria-label="Stall application review" onClick={e=>e.stopPropagation()}>
  <button className="review-panel-close" onClick={onClose} disabled={busy} aria-label="Close stall review"><X size={22}/></button>
  <div className="review-panel-header">
   <h2 className="review-panel-title">{app.mall_name}</h2>
   <p className="review-panel-meta">Stall application #{app.id}</p>
   <div className="review-badges-row"><span className={`review-badge-pill review-badge-pill--${app.applicationStatus==='For Revision'?'red':app.applicationStatus==='Approved'?'green':'blue'}`}>{app.applicationStatus}</span></div>
  </div>
  <div className="review-panel-divider"/>
  <div className="review-tabs"><button className={`review-tab-btn ${tab==='submission'?'review-tab-btn--active':''}`} onClick={()=>setTab('submission')}>Submission</button><button className={`review-tab-btn ${tab==='thread'?'review-tab-btn--active':''}`} onClick={()=>setTab('thread')}>Thread</button></div>
  <div className={`review-panel-body ${tab==='thread'?'review-panel-body--thread':''}`}>{tab==='thread'?<ThreadTab app={app} onSendNote={(text,files)=>onSendNote(text,files)}/>:<>
   <Stepper status={app.applicationStatus}/><SectionTitle>Application summary</SectionTitle>
   <div className="review-info-table">
    <InfoRow label="Additional stalls">{app.quote?.quantity}</InfoRow>
    <InfoRow label="Application fee">{money(app.quote?.amount_cent)}</InfoRow>
    <InfoRow label="Payment"><span className={`app-status-badge app-status-badge--${app.quote?.amount_cent===0||app.payment_status==='paid'?'approved':'pending'}`}>{app.quote?.amount_cent===0?'Included in subscription':app.payment_status==='paid'?'Paid':'Awaiting payment'}</span></InfoRow>
   </div>
   <p className="stall-review-note">Approval adds the stalls to Mall Management and returns the current AR development to Node Mapping.</p>
   {app.floors?.map(f=><section className="stall-review-floor" key={f.floor_id}>
    <SectionTitle>{f.floor_label} ? {f.quantity} {f.quantity===1?'stall':'stalls'}</SectionTitle>
    {f.plan_content?<div className="stall-review-plan"><div className="review-floor-card"><div className="review-floor-card-info"><div className="review-floor-card-name">Updated floor plan</div><div className="review-floor-card-file">{f.filename}</div></div><a className="review-download-btn" download={f.filename} href={`data:${f.mime};base64,${f.plan_content}`}>Download</a></div>{f.mime?.startsWith('image/')&&<img className="stall-plan-preview" src={`data:${f.mime};base64,${f.plan_content}`} alt={`Updated plan for ${f.floor_label}`}/>}</div>:<p className="stall-review-note">No updated floor plan submitted. The existing plan and calibration will be retained.</p>}
    {f.items?.map(i=><article className="stall-review-item" key={i.position}>
     <h4 className="stall-review-item-title">{i.name}</h4>
     <div className="review-info-table"><InfoRow label="Floor">{f.floor_label}</InfoRow><InfoRow label="Brand">{i.brand_name}</InfoRow><InfoRow label="Location">{i.location}</InfoRow><InfoRow label="Contact person">{i.contact_person}</InfoRow><InfoRow label="Mobile number">{i.contact_num}</InfoRow><InfoRow label="Email">{i.email}</InfoRow></div>
    </article>)}
   </section>)}
   {app.review_note&&<><SectionTitle>Requested revisions</SectionTitle><p className="stall-review-note">{app.review_note}</p></>}
  </>}</div>
  {app.status==='submitted'&&<footer className="review-panel-footer"><button className="review-footer-btn review-footer-btn--revision" disabled={busy} onClick={()=>setRevision(true)}>Request revision</button><button className="review-footer-btn review-footer-btn--approve" disabled={busy} onClick={()=>setConfirm(true)}>Approve</button></footer>}
 </section></div>
 {confirm&&createPortal(<div className="app-modal-overlay" onClick={e=>{if(e.target===e.currentTarget&&!busy)setConfirm(false)}}><div className="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="stall-approve-title">
  <div className="app-modal-icon"><CircleCheck size={50} color="#16A34A" strokeWidth={1.8}/></div>
  <h2 className="app-modal-title" id="stall-approve-title">Approve {app.mall_name}?</h2>
  <p className="app-modal-desc">This approves the stall application and returns the current AR development to Node Mapping. The mall admin will be notified. After mapping and testing, mall confirmation publishes the update using the active subscription.</p>
  <div className="app-modal-actions"><button className="app-modal-btn-cancel" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button><button className="app-modal-btn-approve" disabled={busy} onClick={()=>decide('approve')}>{busy&&<span className="app-btn-spinner" aria-hidden="true"/>}{busy?'Approving...':'Approve Application'}</button></div>
 </div></div>,document.body)}
 {revision&&createPortal(<div className="app-modal-overlay" onClick={e=>{if(e.target===e.currentTarget&&!busy)setRevision(false)}}><div className="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="stall-revision-title">
  <div className="app-modal-icon"><FilePenLine size={42} strokeWidth={1.6}/></div>
  <h2 className="app-modal-title" id="stall-revision-title">Request Revision {app.mall_name}?</h2>
  <p className="app-modal-desc">Describe what needs to be corrected. Status will change to <span className="app-modal-desc-highlight">For Revision</span> and the mall admin will be notified.</p>
  <label className="app-modal-label" htmlFor="stall-revision-notes">REVISION NOTES <span className="app-modal-label-required">*</span></label>
  <textarea id="stall-revision-notes" className="app-modal-textarea" required disabled={busy} maxLength={3000} placeholder="Describe what needs to be corrected..." value={note} onChange={e=>setNote(e.target.value)}/>
  <div className="app-modal-actions"><button className="app-modal-btn-cancel" disabled={busy} onClick={()=>setRevision(false)}>Cancel</button><button className="app-modal-btn-revision" disabled={busy||!note.trim()} onClick={()=>decide('revision')}>{busy&&<span className="app-btn-spinner" aria-hidden="true"/>}{busy?'Sending...':'Send Revision Request'}</button></div>
 </div></div>,document.body)}
 {result&&createPortal(<div className="app-modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setResult(null)}}><div className="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="stall-result-title">
  <div className="app-modal-icon">{result.success?<CircleCheck size={50} color="#16A34A" strokeWidth={1.8}/>:<CircleAlert size={50} color="#D51D1D" strokeWidth={1.8}/>}</div>
  <h2 className="app-modal-title" id="stall-result-title">{result.title}</h2><p className="app-modal-desc">{result.message}</p>
  <div className="app-modal-actions"><button className="app-modal-btn-cancel" onClick={()=>setResult(null)}>Close</button></div>
 </div></div>,document.body)}
 </>
}
