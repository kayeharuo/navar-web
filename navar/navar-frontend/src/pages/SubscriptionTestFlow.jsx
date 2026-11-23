import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import SubscriptionResultModal from '../components/subscriptionManagement/SubscriptionResultModal'
import { presentationText } from '../utils/presentationText'
import { runTestAction } from '../components/subscriptionManagement/testAction'
import '../styles/subscriptionManagement/subscriptionModal.css'
import { Link, useParams } from 'react-router-dom'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { apiRequest } from '../config/api'
import '../styles/subscriptionManagement/subscriptionManagement.css'
import '../styles/mallManagement/mallModal.css'
const money = cent => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(cent/100)
export default function SubscriptionTestFlow() {
  const { mallId }=useParams()
  const [context,setContext]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [inputs,setInputs]=useState({stores:3,tenants:3,averageRent:50000,floors:[]})
  const [tier,setTier]=useState('basic'),[ack,setAck]=useState(false),[review,setReview]=useState({})
  const [progress,setProgress]=useState(''),[resultModal,setResultModal]=useState(null)
  const [estimate,setEstimate]=useState(null)
  const [onboardingCheck,setOnboardingCheck]=useState(false),[subscriptionCheck,setSubscriptionCheck]=useState(false),[otherPaymentCheck,setOtherPaymentCheck]=useState(false)
  const reload=useCallback(async ()=>{const data=await apiRequest(`/api/subscriptions/${mallId}/test-context`,{signal:AbortSignal.timeout(10000)});setContext(data);if(data.contract?.tier_snapshot?.s_tier_key)setTier(data.contract.tier_snapshot.s_tier_key);if(data.quote){setInputs(data.quote.raw_inputs);setEstimate(data.quote.breakdown);return}setInputs(v=>({...v,floors:data.floors.map(f=>v.floors.find(i=>i.floorNum===f.floor_num)||{floorNum:f.floor_num,areaSqm:f.floor_area_sqm||100})}))},[mallId])
  useEffect(()=>{reload().catch(e=>setError(presentationText(e.message)));const refresh=()=>{reload().catch(e=>setError(presentationText(e.message)))};window.addEventListener('focus',refresh);return ()=>window.removeEventListener('focus',refresh)},[reload])
  async function act(path,body){
    const titles={'test-approve':'Mall approval recorded','test-readiness':'AR marked Ready','test-floor-details':'Floor details saved','test-quote':'Quote created','test-downgrade':'Tier change scheduled'}
    setBusy(true);setResultModal(null);setError('');setMessage('')
    setProgress(path==='test-simulate-payment'?'Recording payment and updating the subscription...':path==='test-approve'?'Recording mall approval...':'Saving workflow changes...')
    try{
      const {result,refreshError}=await runTestAction(
        ()=>apiRequest(`/api/subscriptions/${mallId}/${path}`,{method:'POST',body:JSON.stringify(body)}),
        ()=>{setProgress('Action saved. Refreshing workflow status...');return reload()},
      )
      const title=result.alreadyPaid?'Payment already recorded':path==='test-simulate-payment'?(body.feeType==='subscription'?'Subscription activated':`${body.feeType[0].toUpperCase()+body.feeType.slice(1)} payment recorded`):titles[path]||'Changes saved'
      const confirmation=(path==='test-approve'?'Mall approval has been recorded. Choose a subscription tier and confirm payment next.':path==='test-simulate-payment'?(result.alreadyPaid?'This payment is already recorded.':body.feeType==='subscription'?'Subscription payment recorded. The subscription is active and the AR is Live.':'Payment has been recorded in the payment history.'):null)||({ 'test-readiness':'The AR is now Ready for mall review. Record mall approval next.','test-quote':'Your quote has been saved.','test-floor-details':'Your entered floor details have been saved.','test-downgrade':'The lower tier is scheduled for the next renewal.' }[path])||'Your changes were saved successfully.'
      const details=confirmation+(result.requestId?` Payment reference: #${result.requestId}.`:'')+(refreshError?' The action succeeded, but the status display could not refresh. Use Refresh status to check the latest saved data.':'')
      setMessage(details);setResultModal({success:true,title,message:details});return result
    }catch(e){setError(presentationText(e.message));setResultModal({success:false,title:'Action could not be completed',message:presentationText(e.message)})}
    finally{setBusy(false);setProgress('')}
  }
  async function preview(){
    setBusy(true);setResultModal(null);setProgress('Calculating onboarding estimate...');setError('')
    try{const value=await apiRequest(`/api/subscriptions/${mallId}/test-estimate`,{method:'POST',body:JSON.stringify({inputs})});setEstimate(value);setResultModal({success:true,title:'Estimate ready',message:`Estimated onboarding fee: ${money(value.amountCent)}. Review the estimate before preparing the quote. No payment has been recorded.`})}
    catch(e){setError(presentationText(e.message));setResultModal({success:false,title:'Estimate could not be loaded',message:presentationText(e.message)})}
    finally{setBusy(false);setProgress('')}
  }
  async function refreshStatus(){
    setBusy(true);setProgress('Checking the saved workflow status...')
    try{await reload();setError('');setResultModal({success:true,title:'Status refreshed',message:'The page now shows the latest saved approval, subscription, AR status and payment history.'})}
    catch(e){setResultModal({success:false,title:'Could not refresh status',message:presentationText(e.message)})}
    finally{setBusy(false);setProgress('')}
  }
  const number=(key,label)=><div className="mall-field-group"><label className="mall-field-label">{label}</label><input disabled={busy||Boolean(context?.onboarding?.quote_id)} className="mall-field-input" type="number" min="0" value={inputs[key]} onChange={e=>{setEstimate(null);setInputs(v=>({...v,[key]:Number(e.target.value)}))}}/></div>
  const paid = fee => Boolean(context?.payments.some(p=>p.fee_type===fee&&p.status==='paid'&&p.fulfilled_at&&!p.fulfillment_error&&!p.reconciliation_reason))
  const onboardingPaid=paid('onboarding'),subscriptionPaid=paid('subscription')
  const simulationEnabled=Boolean(context?.mall.is_subscription_test&&context?.quote?.is_test)
  const arStatus=context?.development?.ar_development_status
  const approved=Boolean(context?.development?.ar_development_mall_approved_at)
  const canActivate=simulationEnabled&&onboardingPaid&&arStatus==='ready'&&approved&&context?.issues.length===0
  async function simulate(fee,confirmed){const result=await act('test-simulate-payment',{feeType:fee,tier,acknowledged:confirmed});if(result){setOnboardingCheck(false);setSubscriptionCheck(false);setOtherPaymentCheck(false)}}
  return <div className="sub-mgmt-content">
    <div className="sub-mgmt-header"><h1 className="sub-mgmt-title">Subscription setup</h1><p className="sub-mgmt-subtitle">{context?.mall.mall_name}. Review mall approval, choose a tier and complete the subscription.</p><Link to="/subscription-management">Back to subscriptions</Link></div>
    <div className="sub-test-notice"><strong>Subscription activation</strong><p>Complete mall approval, select a tier and confirm payment to publish the AR.</p></div>
    {error&&<p className="mall-field-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {!context?<p>Loading…</p>:<>
      <section className="sub-test-status" aria-label="Saved workflow status">
        <div><span>Onboarding</span><strong>{onboardingPaid?'Paid':'Not paid'}</strong></div>
        <div><span>Mall approval</span><strong>{approved?'Approved':'Awaiting approval'}</strong></div>
        <div><span>Subscription</span><strong>{context.contract?.contract_status?context.contract.contract_status[0].toUpperCase()+context.contract.contract_status.slice(1):'Not started'}</strong></div>
        <div><span>AR status</span><strong>{arStatus?arStatus[0].toUpperCase()+arStatus.slice(1).replaceAll('_',' '):'Not started'}</strong></div>
        <button type="button" className="settings-save-btn" disabled={busy} onClick={refreshStatus}>Refresh status</button>
      </section>
      <label className="sub-test-check"><input type="checkbox" disabled={busy} checked={ack} onChange={e=>setAck(e.target.checked)}/> I have reviewed the mall details and authorize the selected action.</label>
      {onboardingPaid?<section className="settings-panel sub-test-panel"><h2>1. Onboarding paid</h2><p className="sub-test-success">Recorded {new Date(context.payments.find(p=>p.fee_type==='onboarding'&&p.status==='paid').paid_at).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}. The application is already submitted and approved.</p></section>:<section className="settings-panel sub-test-panel"><h2>1. Onboarding quote</h2><p>Defaults are synthetic: 3 stores, 3 tenants, ₱50,000 average monthly rent, and 100 sqm per floor unless a saved area exists. These are not factual claims about the mall. Review and change them before preparing the quote.</p>
        <div className="mall-modal-grid">{number('stores','Store capacity')}{number('tenants','Rent-paying tenants')}{number('averageRent','Average monthly rent (PHP)')}
          {inputs.floors.map((f,i)=><div className="mall-field-group" key={f.floorNum}><label className="mall-field-label">Floor {f.floorNum} area (sqm)</label><input disabled={busy||Boolean(context?.onboarding?.quote_id)} className="mall-field-input" type="number" min="1" value={f.areaSqm} onChange={e=>{setEstimate(null);setInputs(v=>({...v,floors:v.floors.map((row,j)=>j===i?{...row,areaSqm:Number(e.target.value)}:row)}))}}/></div>)}
        </div><p>Mall-owned stores: {inputs.stores-inputs.tenants}. Hallways default to {Number(((estimate?.rateSnapshot || context.rateCard.rates).defaultHallwayRate*100).toFixed(4))}% and connectors to {(estimate?.rateSnapshot || context.rateCard.rates).defaultConnectors} per floor.</p>
        <button className="settings-save-btn" disabled={busy||Boolean(context?.onboarding?.quote_id)} onClick={preview}>Preview estimate</button>
        {estimate&&<div className="sub-history-card"><p>Onboarding fee: <strong>{money(estimate.amountCent)}</strong>. Cost: {money(estimate.costCent)}; rounded margin price: {money(estimate.marginCent)}; rent ceiling: {money(estimate.ceilingCent)}.</p><p>{estimate.installed} installed beacons and {estimate.spares} spares. Rate card: {estimate.rateVersion}.</p>{estimate.requiresReview&&<p role="alert">The rent ceiling is below cost. This quote requires admin review.</p>}</div>}
        <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> I have reviewed the onboarding details and authorize this action.</label>
        {!context.onboarding?.quote_id?<button className="settings-save-btn" disabled={busy||!ack||!estimate} onClick={()=>act('test-quote',{inputs,rateVersion:estimate.rateVersion,acknowledged:ack})}>Prepare quote</button>:<p>Quote #{context.onboarding.quote_id} is recorded. Historical amounts stay locked.</p>}
        <div className="sub-test-payment-box">
          <label className="sub-test-check"><input type="checkbox" checked={onboardingPaid||onboardingCheck} disabled={busy||!simulationEnabled||onboardingPaid} onChange={e=>setOnboardingCheck(e.target.checked)}/> Confirm the onboarding payment</label>
          {onboardingPaid?<p className="sub-test-success">Onboarding payment is recorded.</p>:<button className="settings-save-btn" disabled={busy||!ack||!onboardingCheck||!simulationEnabled} onClick={()=>simulate('onboarding',onboardingCheck)}>Confirm onboarding payment</button>}
        </div>
      </section>}
      <section className="settings-panel sub-test-panel"><h2>2. AR readiness and review</h2><p>Current status: <strong>{arStatus?arStatus[0].toUpperCase()+arStatus.slice(1).replaceAll('_',' '):'No development'}</strong>. Complete the real application requirements before marking the map Ready.</p>
        <p><Link to="/ar-development">Open AR Development</Link> to finish mapping and submit the map for testing. Then return here to mark it Ready and record mall approval.</p>
        {context.issues.length?<ul>{context.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<p>Application requirements are complete.</p>}
        {context.issues.length>0&&<><p>Complete the floor-specific route descriptions and entry-point details in the application. This form saves only what you enter; it does not invent public navigation instructions.</p>
        {context.floors.map(f=><div key={f.floor_id} className="mall-field-group"><h3>{f.floor_label}</h3>{[['accessibility','Accessibility route description'],['emergency','Emergency route description'],['entryLabel','Entry point label'],['entryDescription','Entry point description']].map(([key,label])=><label key={key} className="mall-field-label">{label}<input className="mall-field-input" value={review[f.floor_id]?.[key]||''} onChange={e=>setReview(v=>({...v,[f.floor_id]:{...v[f.floor_id],[key]:e.target.value}}))}/></label>)}</div>)}
        <button className="settings-save-btn" disabled={busy||!ack} onClick={()=>act('test-floor-details',{acknowledged:ack,floors:review})}>Save entered floor details</button></>}
        <button className="settings-save-btn" disabled={busy||!ack||context.issues.length>0||context.development?.ar_development_status!=='testing'} onClick={()=>act('test-readiness',{})}>Mark Ready</button>
        <p>Mall reviewer: <strong>{context.mallAdmins?.[0]?.admin_full_name||'No active mall administrator'}</strong>.</p>
        <button className="settings-save-btn" disabled={busy||!ack||context.development?.ar_development_status!=='ready'||approved||context.mallAdmins?.length!==1} onClick={()=>act('test-approve',{acknowledged:ack})}>{approved ? 'Mall approval recorded' : 'Approve AR'}</button>
      </section>
      <section className="settings-panel sub-test-panel"><h2>3. Subscription payment and publication</h2>
        <p>Choose a tier. Once onboarding is paid and the Ready AR has mall approval, confirm the annual payment to start the subscription and publish the AR.</p>
        <label className="mall-field-label">Subscription tier<select className="mall-field-input" disabled={busy||subscriptionPaid||!approved} value={tier} onChange={e=>setTier(e.target.value)}>{context.tiers.map(t=><option key={t.s_tier_key} value={t.s_tier_key}>{t.s_tier_label} - {money(t.s_tier_annual_fee*100)} yearly</option>)}</select></label>
        <div className="sub-test-payment-box"><label className="sub-test-check"><input type="checkbox" checked={subscriptionPaid||subscriptionCheck} disabled={busy||subscriptionPaid||!canActivate} onChange={e=>setSubscriptionCheck(e.target.checked)}/> Confirm the annual subscription payment</label>
          <button className="settings-save-btn" disabled={busy||!ack||!subscriptionCheck||!canActivate||subscriptionPaid} onClick={()=>simulate('subscription',subscriptionCheck)}>Confirm payment &amp; activate subscription</button>
          {!subscriptionPaid&&!canActivate&&<p>Required: An onboarding quote, paid onboarding, AR status Ready, and mall approval.</p>}
          {subscriptionPaid&&<p className="sub-test-success">Subscription payment is recorded. AR status: <strong>{arStatus==='live'?'Live':arStatus}</strong>. Contract: <strong>{context.contract?.contract_status?context.contract.contract_status[0].toUpperCase()+context.contract.contract_status.slice(1):'No current contract'}</strong>.</p>}
        </div>
        {arStatus==='live'&&<p className="sub-test-success">This mall now has a published AR. Stall applications and subscription features are now available.</p>}
      </section>
      <section className="settings-panel sub-test-panel"><h2>4. Subscription actions</h2>
        <p>Renewal dates, upgrade pricing and reinstatement rules apply.</p>
        <label className="mall-field-label">Target tier<select className="mall-field-input" disabled={busy||!context.contract?.contract_start} value={tier} onChange={e=>setTier(e.target.value)}>{context.tiers.map(t=><option key={t.s_tier_key} value={t.s_tier_key}>{t.s_tier_label}</option>)}</select></label>
        <label className="sub-test-check"><input type="checkbox" checked={otherPaymentCheck} disabled={busy||!context.contract?.contract_start} onChange={e=>setOtherPaymentCheck(e.target.checked)}/> Confirm the selected subscription payment</label>
        <div className="sub-test-actions">{['renewal','reinstatement','upgrade'].map(fee=><button className="settings-save-btn" key={fee} disabled={busy||!ack||!otherPaymentCheck||!context.contract?.contract_start} onClick={()=>simulate(fee,otherPaymentCheck)}>Confirm {fee[0].toUpperCase()+fee.slice(1)} payment</button>)}
          <button className="settings-save-btn" disabled={busy||!ack||!context.contract?.contract_start} onClick={()=>act('test-downgrade',{tier})}>Schedule lower tier at renewal</button>
        </div>
      </section>
      <section className="settings-panel sub-test-panel"><h2>Payment history</h2>
        {!context.payments.length&&<p>No payments recorded yet.</p>}
        {context.payments.map(p=><div className="sub-history-card" key={p.request_id}><strong>#{p.request_id} {p.fee_type[0].toUpperCase()+p.fee_type.slice(1).replaceAll('_',' ')} - {money(p.amount_cent)} - {p.status[0].toUpperCase()+p.status.slice(1)}</strong>
          <p>{p.paid_at&&<>Paid {new Date(p.paid_at).toLocaleDateString('en-PH')} ? </>}{p.fulfilled_at?'Workflow completed':p.status==='paid'?'Payment recorded; workflow needs review':'Not completed'}</p>
          {p.fulfillment_error&&<p className="mall-field-error">{p.fulfillment_error}</p>}
        </div>)}
      </section>
    </>}
    {busy&&createPortal(<div className="sub-modal-overlay sub-result-overlay"><section className="sub-modal-box sub-modal-box--sm sub-test-progress" role="dialog" aria-modal="true" aria-busy="true" aria-labelledby="test-progress-title"><h2 id="test-progress-title" className="sub-modal-title">Please wait</h2><LoadingSpinner label={progress||'Working...'} showLabel/><p>Your request is being processed. Please keep this page open.</p></section></div>,document.body)}
    {resultModal&&!busy&&createPortal(<SubscriptionResultModal result={resultModal} onClose={()=>setResultModal(null)}/>,document.body)}
  </div>
}
