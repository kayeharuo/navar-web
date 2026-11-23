'use strict'
const DAY=86400000,OFFSET=8*3600000
const day=value=>new Date(new Date(value).getTime()+OFFSET).toISOString().slice(0,10)
const title=value=>String(value||'Unspecified').toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const time=value=>value?Date.parse(value):NaN
const sum=(rows,key)=>rows.reduce((n,row)=>n+(Number(row[key])||0),0)
const byValue=(a,b)=>b.value-a.value||a.label.localeCompare(b.label)||String(a.id).localeCompare(String(b.id))

function dateRange(query={},now=new Date()){
 const to=query.to||day(now)
 const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
 if(!valid(to))throw Object.assign(new Error('Choose valid dates in YYYY-MM-DD format.'),{statusCode:400})
 const from=query.from||new Date(Date.parse(to+'T00:00:00Z')-29*DAY).toISOString().slice(0,10)
 if(!valid(from))throw Object.assign(new Error('Choose valid dates in YYYY-MM-DD format.'),{statusCode:400})
 const start=Date.parse(from+'T00:00:00+08:00'),end=Date.parse(to+'T00:00:00+08:00')+DAY
 if(end<=start||end-start>366*DAY)throw Object.assign(new Error('Choose a date range from 1 to 366 days.'),{statusCode:400})
 return {from,to,start,end,timeZone:'Asia/Manila'}
}

// Range pagination avoids Supabase's default row limit silently clipping reports.
async function allRows(db,table,columns,order,configure=q=>q){
 const rows=[]
 for(let offset=0;;offset+=500){
  const result=await configure(db.from(table).select(columns)).order(order).range(offset,offset+499)
  if(result.error)throw result.error
  rows.push(...(result.data||[]))
  if((result.data||[]).length<500)return rows
 }
}

async function loadAnalytics(db,query={},now=new Date()){
 const range=dateRange(query,now),asOf=now.getTime()
 const specs={
  malls:['mall','mall_id,mall_name,mall_city','mall_id'],
  sessions:['navigation_session','navsesh_id,navsesh_start_time,navsesh_arrived_time,navsesh_is_completed,user_id,mall_id,store_id,destination_node_id','navsesh_id',q=>q.lt('navsesh_start_time',new Date(Math.min(range.end,asOf+1)).toISOString())],
  nodes:['node','node_id,node_type,store_id','node_id'],
  stores:['store','store_id,store_name,mall_id','store_id'],
  contracts:['contract','contract_id,mall_id,contract_is_current,contract_status,contract_start,contract_end,contract_annual_fee','contract_id'],
  suspensions:['suspension','suspension_id,contract_id,suspension_lifted_at','suspension_id'],
  requests:['contract_payment_request','request_id,mall_id,contract_id,fee_type,status,amount_cent,paid_at,payment_reference,paymongo_payment_id,reconciliation_reason,fulfillment_error','request_id'],
  payments:['payment','payment_id,mall_id,contract_id,payment_type,payment_amount,payment_paid_at,payment_ref_num','payment_id'],
  developments:['ar_development','ar_development_id,application_id,ar_development_status','ar_development_id'],
  applications:['application','application_id,mall_id,application_version,application_attempt,application_status','application_id'],
 }
 const entries=await Promise.all(Object.entries(specs).map(async([key,args])=>[key,await allRows(db,...args)]))
 return buildAnalytics(Object.fromEntries(entries),range,now)
}

function buildAnalytics(data,range,now=new Date()){
 const mallById=new Map(data.malls.map(m=>[m.mall_id,m])),storeById=new Map(data.stores.map(s=>[s.store_id,s])),nodeById=new Map(data.nodes.map(n=>[n.node_id,n]))
 const contractsById=new Map(data.contracts.map(c=>[c.contract_id,c]))
 const quality={missingSessionUser:0,unspecifiedDestination:0,excludedPaymentRecords:0,duplicateLegacyPayments:0}
 const validSessions=data.sessions.filter(s=>Number.isFinite(time(s.navsesh_start_time))&&time(s.navsesh_start_time)<=now.getTime())
 const inRange=value=>time(value)>=range.start&&time(value)<range.end
 const sessions=validSessions.filter(s=>inRange(s.navsesh_start_time))
 const firstByUser=new Map()
 for(const s of validSessions)if(s.user_id!=null)firstByUser.set(s.user_id,Math.min(firstByUser.get(s.user_id)??Infinity,time(s.navsesh_start_time)))
 const users=new Set(sessions.filter(s=>s.user_id!=null).map(s=>s.user_id))
 const newUsers=[...users].filter(id=>firstByUser.get(id)>=range.start).length
 const daily=new Map()
 for(let d=range.start;d<range.end;d+=DAY)daily.set(day(d),{date:day(d),label:day(d).slice(5),sessions:0})
 const hours=Array.from({length:24},(_,hour)=>({hour,label:`${hour%12||12}${hour<12?'AM':'PM'}`,value:0}))
 const destinations=new Map(),stores=new Map(),mallSessions=new Map(),durations=[]
 for(const s of sessions){
  daily.get(day(s.navsesh_start_time)).sessions++
  hours[new Date(time(s.navsesh_start_time)+OFFSET).getUTCHours()].value++
  mallSessions.set(s.mall_id,(mallSessions.get(s.mall_id)||0)+1)
  if(s.user_id==null)quality.missingSessionUser++
  const node=nodeById.get(s.destination_node_id),store=storeById.get(s.store_id??node?.store_id)
  const kind=node?.node_type?title(node.node_type):store?'Store Destination':'Unspecified'
  if(kind==='Unspecified')quality.unspecifiedDestination++
  destinations.set(kind,(destinations.get(kind)||0)+1)
  if(store&&store.mall_id===s.mall_id){
   const row=stores.get(store.store_id)||{id:store.store_id,label:store.store_name,mallId:store.mall_id,mall:mallById.get(store.mall_id)?.mall_name||'Unknown mall',value:0}
   row.value++;stores.set(store.store_id,row)
  }
  const elapsed=(time(s.navsesh_arrived_time)-time(s.navsesh_start_time))/1000
  if(s.navsesh_is_completed&&Number.isFinite(elapsed)&&elapsed>=0&&time(s.navsesh_arrived_time)<=now.getTime())durations.push(elapsed)
 }
 const destinationRows=[...destinations].map(([label,value])=>({label,value})).sort(byValue)
 const storeRows=[...stores.values()].sort(byValue).map((s,i)=>({...s,rank:i+1,name:s.label}))
 const peak=hours.reduce((a,b)=>b.value>a.value?b:a,hours[0])
 const liveMallIds=new Set(data.developments.filter(d=>d.ar_development_status==='live').map(d=>data.applications.find(a=>a.application_id===d.application_id)?.mall_id).filter(id=>id!=null))
 const currentContracts=data.contracts.filter(c=>c.contract_is_current)
 const activeContracts=currentContracts.filter(c=>c.contract_status==='active'&&time(c.contract_start)<=now.getTime()&&time(c.contract_end)>now.getTime()&&!data.suspensions.some(s=>s.contract_id===c.contract_id&&!s.suspension_lifted_at))
 const activeMallIds=new Set(activeContracts.map(c=>c.mall_id))

 const paymentType=value=>{
  const type=String(value||'').toLowerCase()
  return type.includes('onboard')?'Onboarding':type.includes('subscr')?'Subscription':type.includes('stall')?'Stall Addon':title(type)
 }
 const records=[],seenRefs=new Set(),seenProviders=new Set()
 const requestRefs=new Set(data.requests.filter(r=>r.payment_reference).map(r=>`${r.mall_id??contractsById.get(r.contract_id)?.mall_id}:${String(r.payment_reference).trim()}`))
 for(const r of data.requests){
  if(r.status!=='paid')continue
  const amount=Number(r.amount_cent),mallId=r.mall_id??contractsById.get(r.contract_id)?.mall_id
  if(r.reconciliation_reason||r.fulfillment_error||!Number.isSafeInteger(amount)||amount<0||!Number.isFinite(time(r.paid_at))){quality.excludedPaymentRecords++;continue}
  const ref=r.payment_reference?`${mallId}:${String(r.payment_reference).trim()}`:null
  const provider=r.paymongo_payment_id?String(r.paymongo_payment_id):null
  if((ref&&seenRefs.has(ref))||(provider&&seenProviders.has(provider)))continue
  if(ref)seenRefs.add(ref);if(provider)seenProviders.add(provider)
  records.push({mallId,type:paymentType(r.fee_type),amountCent:amount,date:r.paid_at})
 }
 for(const p of data.payments){
  const mallId=p.mall_id??contractsById.get(p.contract_id)?.mall_id,ref=p.payment_ref_num?`${mallId}:${String(p.payment_ref_num).trim()}`:null
  if(ref&&(requestRefs.has(ref)||seenRefs.has(ref))){quality.duplicateLegacyPayments++;continue}
  const amount=Math.round(Number(p.payment_amount)*100)
  if(!Number.isSafeInteger(amount)||amount<0||!Number.isFinite(time(p.payment_paid_at))){quality.excludedPaymentRecords++;continue}
  if(ref)seenRefs.add(ref)
  records.push({mallId,type:paymentType(p.payment_type),amountCent:amount,date:p.payment_paid_at})
 }
 const periodPayments=records.filter(p=>inRange(p.date)),months=new Map(),types=new Map(),mallPayments=new Map()
 for(const d of daily.values()){const month=d.date.slice(0,7);if(!months.has(month))months.set(month,{month,value:0,amountCent:0,payments:0})}
 for(const p of periodPayments){
  const month=months.get(day(p.date).slice(0,7));month.amountCent+=p.amountCent;month.payments++
  types.set(p.type,(types.get(p.type)||0)+p.amountCent);mallPayments.set(p.mallId,(mallPayments.get(p.mallId)||0)+p.amountCent)
 }
 const last7Start=range.end-7*DAY,previous7Start=last7Start-7*DAY
 const breakdown=data.malls.map(m=>{
  const mallHistory=validSessions.filter(s=>s.mall_id===m.mall_id)
  const last7=mallHistory.filter(s=>time(s.navsesh_start_time)>=last7Start&&time(s.navsesh_start_time)<range.end).length
  const previous7=mallHistory.filter(s=>time(s.navsesh_start_time)>=previous7Start&&time(s.navsesh_start_time)<last7Start).length
  const top=new Map()
  for(const s of sessions.filter(s=>s.mall_id===m.mall_id)){const n=nodeById.get(s.destination_node_id);const kind=n?.node_type?title(n.node_type):storeById.has(s.store_id)?'Store Destination':'Unspecified';top.set(kind,(top.get(kind)||0)+1)}
  const destination=[...top].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||null
  const contract=currentContracts.find(c=>c.mall_id===m.mall_id)
  return {id:m.mall_id,name:m.mall_name,city:m.mall_city||'',status:contract?title(contract.contract_status):'Onboarding',sessions:mallSessions.get(m.mall_id)||0,last7,previous7,changePercent:previous7?Math.round((last7-previous7)/previous7*1000)/10:null,
   annualFee:contract?Number(contract.contract_annual_fee)||0:0,revenue:(mallPayments.get(m.mall_id)||0)/100,topDestination:destination,isLive:liveMallIds.has(m.mall_id)}
 }).sort((a,b)=>b.sessions-a.sessions||a.name.localeCompare(b.name))
 const topMall=breakdown.find(m=>m.sessions>0)
 return {
  range:{from:range.from,to:range.to,timeZone:range.timeZone},generatedAt:now.toISOString(),
  summary:{sessions:sessions.length,completedSessions:sessions.filter(s=>s.navsesh_is_completed).length,activeMalls:activeMallIds.size,liveMalls:liveMallIds.size,totalMalls:data.malls.length,
   peakHour:sessions.length?peak.label:null,annualSubscriptionValue:sum(activeContracts.map(c=>({amount:Math.round(Number(c.contract_annual_fee||0)*100)})),'amount')/100,
   recordedPayments:sum(periodPayments,'amountCent')/100,paymentCount:periodPayments.length,topMall:topMall?{name:topMall.name,sessions:topMall.sessions}:null,topDestination:destinationRows[0]||null,
   averageDurationSeconds:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null,durationSampleCount:durations.length},
  sessionsOverTime:[...daily.values()],mallPerformance:breakdown.map(m=>({...m,color:'#2563EB'})),peakHours:hours.map(h=>({...h,peak:sessions.length>0&&h.hour===peak.hour})),
  topDestinations:destinationRows,userType:{newUsers,returningUsers:users.size-newUsers,totalUnique:users.size},
  monthlyRevenue:[...months.values()].map(m=>({...m,value:m.amountCent/100})),paymentTypes:[...types].map(([label,amountCent])=>({label,value:amountCent/100})).sort(byValue),
  mallBreakdown:breakdown,topStores:storeRows,quality,
  definitions:{sessions:'Navigation sessions started during the selected dates, across all recorded malls.',users:'New users have their first recorded navigation during the period; returning users navigated before it. Sessions without a user are excluded from user counts.',payments:'Recorded paid payments and legacy payment entries, deduplicated by mall/reference. Pending, reconciliation-flagged and invalid payment records are excluded.',annualSubscriptionValue:'Current annual fees of active, started subscriptions as of report generation; not payment revenue.',comparison:'Last 7 days ending on the selected end date compared with the preceding 7 days. No percentage is calculated when the previous count is zero.',duration:'Average duration of completed sessions with valid arrival and start timestamps; unfinished sessions are excluded.',dataQuality:'Duplicate legacy payments and invalid payment records are counted before date filtering; missing users and destinations refer to sessions in the selected period.'},
 }
}
module.exports={dateRange,allRows,loadAnalytics,buildAnalytics}
