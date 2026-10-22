import {useEffect,useRef,useState} from 'react'
import {X,LoaderCircle} from 'lucide-react'
import {withRequestTimeout} from './followupRequest'
import {apiRequest} from '../../config/api'
const date=value=>value?new Date(value).toLocaleString():'Not recorded'
const delivery={pending:'Queued / awaiting processing',sending:'Sending — confirmation pending',sent:'Accepted by mail server',unconfirmed:'Delivery uncertain',not_recorded:'Not recorded'}
const labels={mallName:'Mall name',contactPerson:'Contact person',phone:'Contact number',province:'Province',city:'City / Municipality',address:'Full address',zipCode:'ZIP code',floors:'Floors',description:'Inquiry message',coverageArea:'Coverage area'}
export default function InquiryFollowupPanel({inquiry,summary,onClose,onChanged,onShowDuplicates}) {
 const [section,setSection]=useState('actions')
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[reason,setReason]=useState(''),[ack,setAck]=useState(false),[notice,setNotice]=useState('')
 const request=useRef(null),mounted=useRef(true),dialog=useRef(null),saving=useRef(false)
 useEffect(()=>{const node=dialog.current;if(!node.open)node.showModal();return()=>node.close()},[])
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 const load=()=>withRequestTimeout(signal=>apiRequest(`/api/inquiries/${inquiry.id}/followup`,{signal}),15000).then(value=>{if(mounted.current)setData(value)})
 useEffect(()=>{const controller=new AbortController();apiRequest(`/api/inquiries/${inquiry.id}/followup`,{signal:controller.signal}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[inquiry.id])
 async function save(action) {
  if(saving.current)return
  saving.current=true
  const signature=JSON.stringify({id:inquiry.id,action,note:action==='note'?note:undefined,reason:action==='corrections'?reason:undefined,ack})
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()}
  setBusy(true);setError('');setNotice('')
  try {
   const result=await withRequestTimeout(signal=>apiRequest(`/api/inquiries/${inquiry.id}/${action==='note'?'notes':'followup'}`,{method:'POST',signal,body:JSON.stringify({requestId:request.current.id,text:note,action,reason,updatedAt:inquiry.updatedAt,acknowledgeUncertain:ack})}))
   request.current=null
   onChanged()
   if(!mounted.current)return
   if(action==='note')setNote('')
   else {setReason('');setAck(false)}
   setNotice(result.warning || (action==='note'?'Internal note saved. It was not emailed.':'Request saved. See delivery history below.'))
   // Saving is complete; refreshing history must not keep the form locked.
   void load().catch(()=>{if(mounted.current)setError('Request saved, but history could not refresh. Reopen this panel to check its delivery status.')})
  }catch(e){
   if(mounted.current)setError(e.name==='TimeoutError'
    ? 'The server is taking longer than expected. The request may already be saved or sending. Check History before sending another request.'
    : e.message)
  }finally{saving.current=false;if(mounted.current)setBusy(false)}
 }
 const editable=!['Approved','Rejected'].includes(inquiry.status)
 return <dialog ref={dialog} className="inq-followup-panel" aria-labelledby="inq-followup-title" onCancel={e=>{e.preventDefault();onClose()}}
  onClick={event=>{
   if(event.target!==event.currentTarget)return
   const bounds=event.currentTarget.getBoundingClientRect()
   if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom)onClose()
  }}>
  <header><div><h2 id="inq-followup-title">Inquiry follow-up</h2><p className="inq-panel-subtitle">{inquiry.mallName}</p></div><button type="button" onClick={onClose} aria-label="Close follow-up"><X size={20}/></button></header>
  <nav className="inq-followup-nav" aria-label="Follow-up sections">
   {[['actions','Owner follow-up'],['notes','Internal notes'],['history','History']].map(([key,label])=><button key={key} type="button" aria-pressed={section===key} onClick={()=>setSection(key)}>{label}</button>)}
  </nav>
  <div className="inq-followup-body">
   <div className="inq-progress-summary"><span>Current stage</span><strong>{summary?.progress || inquiry.status}</strong></div>
   {summary?.duplicates?.length>0 && <section hidden={section!=='actions'}><h3>Possible duplicate inquiries</h3><button type="button" disabled={busy} onClick={onShowDuplicates}>View matching submissions</button><p>Review these before approving. A match is a warning, not proof of a duplicate.</p><ul>{summary.duplicates.map(d=><li key={d.id}>{d.mallName} · #{d.id} · {d.status} — {d.reason}</li>)}</ul></section>}
   {busy && <p className="inq-followup-sending" role="status"><LoaderCircle size={16} className="inq-loading-spinner" aria-hidden="true"/>Processing request. You can close this panel; closing does not cancel delivery.</p>}
   {error && <p role="alert" className="inq-decision-error">{error}</p>}
   {notice && <p role="status">{notice}</p>}
   {section==='actions' && !editable && !summary?.canReissue && <p className="inq-followup-no-action">No owner action is needed here. Review previous decisions and emails in History, or add an internal note.</p>}
   {!data?<p role="status">Loading follow-up…</p>:<>
    {summary?.canReissue && <section hidden={section!=='actions'}><h3>Invitation recovery</h3><p>Issue a new secure setup link to {inquiry.email}. This does not create another owner account. Requests are limited to one every 10 minutes.</p>
     <label className="inq-followup-check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} disabled={busy}/>I checked the sending mailbox and acknowledge any earlier uncertain delivery.</label>
     <button disabled={busy || (data.deliveries.some(d=>d.i_message_kind==='convert' && ['pending','sending','unconfirmed'].includes(d.i_message_delivery_status)) && !ack)} onClick={()=>save('reissue')}>Reissue invitation</button>
    </section>}
    {editable && <section hidden={section!=='actions'}><h3>Request corrections</h3><p>The owner can update their saved information through a secure, single-use link valid for 72 hours. The inquiry stays In Progress.</p>
     <label>What needs updating?<textarea value={reason} maxLength={3000} rows={3} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
     <button disabled={busy || !reason.trim()} onClick={()=>save('corrections')}>{busy?'Processing?':'Send correction request'}</button>
    </section>}
    <section hidden={section!=='notes'}><h3>Internal notes</h3><p>Visible to Super Admins only. Never included in customer emails.</p>
     <textarea aria-label="Internal note" rows={3} maxLength={4000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/>
     <button disabled={busy || !note.trim()} onClick={()=>save('note')}>Save note</button>
     {data.notes.length?data.notes.map(n=><article key={n.id}><strong>{n.actorName}</strong><small>{date(n.created_at)}</small><p>{n.body}</p></article>):<p>No internal notes yet.</p>}
    </section>
    <section hidden={section!=='history'}><h3>Review history</h3>{data.activity.length?data.activity.map(a=><article key={a.id}><strong>{a.action==='reissue'?'Invitation reissued':a.action==='corrections'?'Corrections requested':a.action}</strong><small>{a.actorName} · {date(a.created_at)}</small>{a.details?.reason && <p>{a.details.reason}</p>}</article>):<p>No review actions recorded yet.</p>}</section>
    <section hidden={section!=='history'}><h3>Delivery history</h3><p>Mail-server acceptance does not confirm inbox delivery. Uncertain messages are not automatically resent.</p>{data.deliveries.length?data.deliveries.map(d=><article key={d.i_message_id}><strong>{d.i_message_kind==='convert'?'Owner invitation':d.i_message_kind==='correction'?'Correction request':'Admin message'}</strong><small>{date(d.i_message_sent_at)}</small><p>{delivery[d.i_message_delivery_status] || d.i_message_delivery_status}</p></article>):<p>No outgoing messages yet.</p>}</section>
    <section hidden={section!=='history'}><h3>Inquiry revisions</h3>{data.revisions.length?data.revisions.map(r=><article key={r.id}><strong>{r.used_at?'Updated by mall owner':r.revoked_at?'Link replaced':new Date(r.expires_at)<new Date()?'Link expired':'Awaiting owner updates'}</strong><small>{date(r.used_at || r.created_at)}</small>{r.after_data && <dl>{Object.keys(labels).filter(k=>r.before_data[k]!==r.after_data[k]).map(k=><div key={k}><dt>{labels[k]}</dt><dd><del>{String(r.before_data[k]??'Not provided')}</del><br/>{String(r.after_data[k]??'Not provided')}</dd></div>)}</dl>}</article>):<p>No revisions yet.</p>}</section>
    <p hidden={section==='actions'} className="inq-followup-limit">Showing the latest 100 entries per section.</p>
   </>}
  </div>
 </dialog>
}
