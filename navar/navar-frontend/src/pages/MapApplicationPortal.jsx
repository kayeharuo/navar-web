import {useCallback,useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useParams} from 'react-router-dom'
import {CircleCheck,CircleAlert,FileImage,Plus,Trash2} from 'lucide-react'
import {apiRequest} from '../config/api'
import {MAP_APPLICATION_CATEGORIES} from '../config/mapApplicationCategories'
import {useRealtimeRefresh} from '../config/realtime'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import '../styles/applicationManagement/applicationManagement.css'
import '../styles/mallManagement/mallModal.css'
import '../styles/applicationManagement/mapApplicationPortal.css'

const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value||0))
function ApplicationFloor({floor,onChange,onPreview,busy,locked}) {
 const [error,setError]=useState('')
 const update=(key,value)=>onChange({...floor,[key]:value,changed:true})
 async function upload(event){
  const file=event.target.files?.[0];if(!file)return
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>10*1024*1024){setError('Choose a PNG or JPEG plan up to 10 MB.');event.target.value='';return}
  try{const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});update('image',{content,fileName:file.name});setError('')}catch{setError('The selected image could not be read.')}
 }
 return <section className="map-intake-floor">
  <div className="map-intake-floor-heading"><h3>{floor.label}</h3><label className="map-intake-check"><input type="checkbox" checked={floor.changed} disabled={busy||locked} onChange={e=>onChange({...floor,changed:e.target.checked},!e.target.checked)}/>This floor needs updating</label></div>
  <p className="map-intake-muted">{floor.changed?'This floor is included in the update quote. You can reuse its image while editing its details, or upload a replacement.':'The current Live plan and its details will be reused. Editing any field marks this floor as changed.'}</p>
  <div className="review-floor-card"><FileImage size={26} color="#979797"/><div className="review-floor-card-info"><div className="review-floor-card-name">{floor.image?.fileName||floor.fileName}</div><div className="review-floor-card-file">{floor.image?'Replacement plan':'Existing floor plan'}</div></div>{floor.sourcePlanId&&<button type="button" className="review-download-btn" disabled={busy} onClick={()=>onPreview(floor)}>View plan</button>}</div>
  <label className="mall-field-label map-intake-upload">Replace floor plan (Optional)<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={upload}/></label>
  {floor.image&&<button type="button" className="map-intake-link" disabled={busy} onClick={()=>update('image',null)}>Keep the existing image</button>}
  {error&&<p className="mall-field-error" role="alert">{error}</p>}
  <fieldset disabled={busy} className="map-intake-fields">
   <div className="mall-modal-grid">
    <label className="mall-field-label">Scale reference<input className="mall-field-input" required maxLength={2000} value={floor.referenceLine} onChange={e=>update('referenceLine',e.target.value)}/></label>
    <label className="mall-field-label">Reference length (Meters)<input className="mall-field-input" required type="number" min="0.001" step="0.001" value={floor.meterLength??''} onChange={e=>update('meterLength',e.target.value)}/></label>
    <label className="mall-field-label">Accessibility route<textarea className="mall-field-input" required maxLength={5000} value={floor.accessibilityRoute} onChange={e=>update('accessibilityRoute',e.target.value)}/></label>
    <label className="mall-field-label">Emergency route<textarea className="mall-field-input" required maxLength={5000} value={floor.emergencyRoute} onChange={e=>update('emergencyRoute',e.target.value)}/></label>
   </div>
   <h4>Entry points</h4>
   {floor.entryPoints.map((entry,index)=><div className="map-intake-entry" key={index}>
    <label className="mall-field-label">Name<input className="mall-field-input" required maxLength={500} value={entry.label} onChange={e=>update('entryPoints',floor.entryPoints.map((item,i)=>i===index?{...item,label:e.target.value}:item))}/></label>
    <label className="mall-field-label">Description<input className="mall-field-input" maxLength={2000} value={entry.description} onChange={e=>update('entryPoints',floor.entryPoints.map((item,i)=>i===index?{...item,description:e.target.value}:item))}/></label>
    <button type="button" className="map-intake-icon" aria-label={`Remove entry point ${index+1} on ${floor.label}`} disabled={floor.entryPoints.length<=1} onClick={()=>update('entryPoints',floor.entryPoints.filter((_,i)=>i!==index))}><Trash2 size={18}/></button>
   </div>)}
   <button type="button" className="map-intake-link" disabled={floor.entryPoints.length>=100} onClick={()=>update('entryPoints',[...floor.entryPoints,{label:'',description:''}])}><Plus size={16}/>Add entry point</button>
  </fieldset>
 </section>
}
export default function MapApplicationPortal(){
 const {mallId}=useParams()
 const [context,setContext]=useState(null),[floors,setFloors]=useState([]),[category,setCategory]=useState(MAP_APPLICATION_CATEGORIES[0]),[reason,setReason]=useState(''),[notes,setNotes]=useState(''),[text,setText]=useState(''),[busy,setBusy]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[ack,setAck]=useState(false),[newAttempt,setNewAttempt]=useState(false),[preview,setPreview]=useState(null)
 const initialized=useRef(''),token=useRef(crypto.randomUUID()),formStamp=useRef(null),formSource=useRef(null)
 const reload=useCallback(async()=>{const data=await apiRequest(`/api/map-portal/${mallId}`,{signal:AbortSignal.timeout(15000)});setContext(data);setError('');return data},[mallId])
 useEffect(()=>{let active=true;const refresh=()=>reload().catch(e=>{if(active)setError(e.message)});refresh();const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh)}},[reload])
 useRealtimeRefresh(p=>{if(['application','ar_development','mall_service_request','contract_payment_request'].includes(p.table))reload().catch(e=>setError(e.message))})
 const latest=context?.latest
 const isUpdate=Number(latest?.application_version)>1
 const rejected=isUpdate&&['rejected','rejected_final'].includes(latest.application_status)
 const revising=isUpdate&&latest.application_status==='for_revision'
 const newForm=Boolean(context?.eligibility.allowed&&(!rejected||newAttempt))
 useEffect(()=>{
  if(!context)return
  const key=`${mallId}:${context.sourceApplicationId}:${context.latest?.application_status}`
  if(initialized.current===key)return
  initialized.current=key;token.current=crypto.randomUUID();formStamp.current=context.latest?.application_updated_at;formSource.current={id:context.liveApplicationId,revision:context.eligibility.sourceMapRevision}
  setFloors(context.floors.map(f=>({...f,image:null,entryPoints:f.entryPoints.length?f.entryPoints:[{label:'',description:''}]})))
  if(context.latest?.application_status==='for_revision'){setCategory(context.latest.application_reason_category||MAP_APPLICATION_CATEGORIES[0]);setReason(context.latest.application_reason_notes||'')}
  setAck(false);setNotes('')
 },[context,mallId])
 async function act(action,payload){
  setBusy(action);setResult(null)
  try{
   const response=await apiRequest(`/api/map-portal/${mallId}/${action}`,{method:'POST',body:JSON.stringify(payload)})
   let refreshError='';try{await reload()}catch{refreshError=' Refresh this page to see the latest status.'}
   setResult({success:true,title:({submit:'Application submitted',revise:'Corrections saved',pay:'Payment recorded',dispute:'Dispute submitted',message:'Message sent',confirm:response.waiting?'AR confirmed':'AR published'})[action],message:(response.message||'Your changes have been recorded.')+refreshError})
   if(action==='submit'){setNewAttempt(false);setReason('')}
   if(action==='message')setText('')
   if(action==='dispute')setNotes('')
   setAck(false)
  }catch(e){setResult({success:false,title:'Action could not be completed',message:e.message})}finally{setBusy('')}
 }
 async function showPlan(floor){try{setBusy('preview');const r=await apiRequest(`/api/map-portal/${mallId}/plans/${floor.sourcePlanId}`);setPreview({url:r.url,label:floor.label})}catch(e){setResult({success:false,title:'Plan could not be opened',message:e.message})}finally{setBusy('')}}
 const changed=floors.filter(f=>f.changed).length
 const included=changed===1&&context?.tier==='premium'&&context.includedAvailable>0
 const estimate=context?.unitFee==null?null:included?0:Math.round(changed*context.unitFee*100)/100
 const payloadFloors=floors.map(f=>({floorId:f.floorId,changed:f.changed,referenceLine:f.referenceLine,meterLength:Number(f.meterLength),accessibilityRoute:f.accessibilityRoute,emergencyRoute:f.emergencyRoute,entryPoints:f.entryPoints,image:f.image}))
 return <main className="map-intake-page">
  <header><p className="map-intake-eyebrow">Mall applications</p><h1>Map application</h1><p className="map-intake-muted">{context?.mallName||'Loading mall...'}{context?.actingAdmin&&` · ${context.actingAdmin}`}</p></header>
  {error&&<div className="app-mgmt-callout app-mgmt-callout--error" role="alert">{error} <button onClick={()=>reload().catch(e=>setError(e.message))}>Retry</button></div>}
  {!context?<LoadingSpinner label="Loading the current application..." showLabel/>:<>
   <section className="map-intake-summary"><div><span>Current Live version</span><strong>{context.liveApplicationId?`Version ${context.requests.find(r=>r.id===context.liveApplicationId)?.version|| (latest?.application_id===context.liveApplicationId?latest.application_version:Number(latest?.application_version)-1)}`:'No Live AR'}</strong></div><div><span>Subscription tier</span><strong>{label(context.tier)}</strong></div><div><span>Update price</span><strong>{context.unitFee==null?'Awaiting onboarding pricing':`${money(context.unitFee)} per changed floor`}</strong></div></section>
   {context.pricingBasis&&<p className="map-intake-muted">Original onboarding: {money(context.pricingBasis.onboarding_cent/100)} ÷ {context.pricingBasis.original_floors} floors × {context.pricingBasis.percent}% = {money(context.unitFee)} per changed floor. Any included single-floor update is applied before payment.</p>}
   {isUpdate&&!newForm&&<section className="map-intake-panel"><div className="map-intake-floor-heading"><h2>Version {latest.application_version} · Attempt {latest.application_attempt}</h2><span className={`review-badge-pill review-badge-pill--${rejected?'red':latest.application_status==='approved'?'green':'blue'}`}>{label(latest.application_status)}</span></div>
    <p>{latest.application_reason_notes}</p>{context.development?.ar_development_status&&<p className="map-intake-muted">AR development: <strong>{label(context.development.ar_development_status)}</strong></p>}
    {['pending','disputed'].includes(latest.application_status)&&<p className="map-intake-note">Your request is awaiting Super Admin acceptance or rejection. The existing AR remains Live. A confirmed update quote is issued after acceptance.</p>}
    {context.service?.status==='awaiting_payment'&&<div className="map-intake-note"><h3>Map-update payment</h3><p>The request was accepted. Complete the quoted service payment before Super Admin approves the application.</p><p className="map-intake-total">{money(context.service.quote?.amount_cent/100)}</p><label className="map-intake-check"><input type="checkbox" checked={ack} disabled={!!busy} onChange={e=>setAck(e.target.checked)}/>Confirm the quoted map-update payment</label><button className="app-modal-btn-approve" disabled={!!busy||!ack} onClick={()=>act('pay',{id:latest.application_id,acknowledged:ack})}>Record Payment</button></div>}
    {context.service&&['queued','in_progress','completed'].includes(context.service.status)&&<p className="map-intake-note">{Number(context.service.quote?.amount_cent)===0?'This update is included in your subscription.':'The map-update payment is recorded.'}</p>}
    {rejected&&<><p className="map-intake-note">{latest.application_status==='rejected_final'?'The request was finally rejected after two disputes. You can start a new attempt.':`The request was rejected. You have used ${latest.application_dispute_count} of 2 disputes. Review the explanation in the thread below.`}</p>
     {latest.application_status==='rejected'&&latest.application_dispute_count<2&&<form onSubmit={e=>{e.preventDefault();act('dispute',{id:latest.application_id,updatedAt:latest.application_updated_at,notes})}}><label className="mall-field-label">Dispute explanation<textarea className="mall-field-input" required maxLength={5000} disabled={!!busy} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="app-modal-btn-approve" disabled={!!busy||!notes.trim()}>Submit Dispute</button></form>}
     <button className="map-intake-link" disabled={!!busy||!context.eligibility.allowed} onClick={()=>{setNewAttempt(true);setFloors(context.floors.map(f=>({...f,changed:false,image:null})))}}>Start a new attempt instead</button></>}
    {context.development?.ar_development_status==='ready'&&!context.development.ar_development_mall_approved_at&&<div className="map-intake-note"><h3>Your updated AR is Ready</h3><label className="map-intake-check"><input type="checkbox" disabled={!!busy} checked={ack} onChange={e=>setAck(e.target.checked)}/>I reviewed and approve the current AR map</label><button className="app-modal-btn-approve" disabled={!!busy||!ack} onClick={()=>act('confirm',{id:latest.application_id,acknowledged:ack})}>Confirm &amp; Publish</button><p>Your active subscription continues. No additional annual subscription payment is required.</p></div>}
    {context.development?.ar_development_status==='ready'&&context.development.ar_development_mall_approved_at&&<p className="map-intake-note">Your AR confirmation is recorded. Publication is waiting for an active subscription.</p>}
   </section>}
   {!context.eligibility.allowed&&!revising&&(!isUpdate||rejected||context.development?.ar_development_status==='live')&&<p className="map-intake-note">{context.eligibility.reason}</p>}
   {(newForm||revising)&&<form onSubmit={e=>{e.preventDefault();if(revising)act('revise',{id:latest.application_id,updatedAt:formStamp.current,floors:payloadFloors,notes});else act('submit',{token:token.current,sourceApplicationId:formSource.current?.id,sourceMapRevision:formSource.current?.revision,reasonCategory:category,reasonNotes:reason,floors:payloadFloors})}}>
    <section className="map-intake-panel"><h2>{revising?'Correct the current application':`Request version ${context.eligibility.nextVersion}`}</h2><p className="map-intake-muted">Request a new version for physical layout changes that require remapping. Node, route, label and beacon corrections can be handled in the node editor. Your current floor details are already filled in; unchanged plans can be reused.</p><label className="mall-field-label">Reason category<select className="mall-field-input" required disabled={!!busy||revising} value={category} onChange={e=>setCategory(e.target.value)}><option value="">Select a category</option>{category&&!MAP_APPLICATION_CATEGORIES.includes(category)&&<option value={category}>{category}</option>}{MAP_APPLICATION_CATEGORIES.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label className="mall-field-label">Reason for the new version{category==='Other structural change'&&<span className="map-intake-muted">Describe the type of change and why a new AR version is needed.</span>}<textarea className="mall-field-input" required maxLength={5000} disabled={!!busy||revising} value={reason} onChange={e=>setReason(e.target.value)}/></label></section>
    {floors.map(f=><ApplicationFloor key={`${context.sourceApplicationId}-${f.floorId}`} floor={f} locked={revising} busy={!!busy||(revising&&!f.changed)} onPreview={showPlan} onChange={(updated,reset)=>setFloors(rows=>rows.map(row=>row.floorId===f.floorId?(reset?{...context.floors.find(base=>base.floorId===f.floorId),changed:false,image:null}:updated):row))}/>)}
    <section className="map-intake-panel"><h2>{revising?'Save corrections':'Review & submit'}</h2><p>{changed} changed {changed===1?'floor':'floors'} · {floors.length-changed} unchanged {floors.length-changed===1?'floor':'floors'}</p>{!revising&&<><p>Estimated update fee: <strong>{estimate==null?'Confirmed after review':money(estimate)}</strong></p><p className="map-intake-muted">The server confirms the rate and available included allowance when Super Admin accepts the request. This is a service fee, separate from your annual subscription.</p></>}{revising&&<label className="mall-field-label">Explain the corrections<textarea className="mall-field-input" required maxLength={10000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>}<button className="app-modal-btn-approve" disabled={!!busy||!changed}>{revising?'Save Corrections':'Submit Application'}</button>{newAttempt&&<button type="button" className="app-modal-btn-cancel" onClick={()=>setNewAttempt(false)}>Cancel</button>}</section>
   </form>}
   {isUpdate&&<section className="map-intake-panel"><h2>Application thread</h2><div className="map-intake-thread">{context.thread?.length?context.thread.map(message=><article key={message.id}><strong>{message.name}</strong><p>{message.message}</p>{message.attachments?.map(attachment=><a href={attachment.url} key={attachment.id} target="_blank" rel="noreferrer">{attachment.fileName}</a>)}<small>{message.date}</small></article>):<p className="map-intake-muted">No messages yet.</p>}</div>{context.threadReadOnly===false&&<form onSubmit={e=>{e.preventDefault();act('message',{id:latest.application_id,notes:text})}}><label className="mall-field-label">Message the review team<textarea className="mall-field-input" required maxLength={10000} value={text} onChange={e=>setText(e.target.value)} disabled={!!busy}/></label><button className="app-modal-btn-approve" disabled={!!busy||!text.trim()}>Send Message</button></form>}</section>}
   {context.requests.length>0&&<section className="map-intake-panel"><h2>Application history</h2><div className="map-intake-history">{context.requests.map(request=><div key={request.id}><strong>Version {request.version} · Attempt {request.attempt}</strong><span>{label(request.status)}</span><p>{request.reason}</p></div>)}</div></section>}
  </>}
  {busy&&createPortal(<div className="app-modal-overlay"><div className="app-modal-box" role="dialog" aria-modal="true" aria-label="Saving application"><LoadingSpinner label={busy==='submit'?'Submitting application...':busy==='pay'?'Recording payment...':busy==='preview'?'Loading floor plan...':'Saving changes...'} showLabel/><p className="app-modal-desc">Please keep this page open while the request completes.</p></div></div>,document.body)}
  {result&&!busy&&createPortal(<div className="app-modal-overlay"><div className="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="map-result-title"><div className="app-modal-icon">{result.success?<CircleCheck size={50} color="#16A34A"/>:<CircleAlert size={50} color="#D51D1D"/>}</div><h2 id="map-result-title" className="app-modal-title">{result.title}</h2><p className="app-modal-desc">{result.message}</p><div className="app-modal-actions"><button className="app-modal-btn-cancel" onClick={()=>setResult(null)}>Close</button></div></div></div>,document.body)}
  {preview&&createPortal(<div className="app-modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setPreview(null)}}><div className="app-modal-box map-intake-preview" role="dialog" aria-modal="true" aria-label="Floor plan preview"><h2 className="app-modal-title">{preview.label}</h2><img src={preview.url} alt={`Current plan for ${preview.label}`}/><div className="app-modal-actions"><button className="app-modal-btn-cancel" onClick={()=>setPreview(null)}>Close</button></div></div></div>,document.body)}
 </main>
}
