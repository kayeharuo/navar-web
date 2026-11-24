const {test}=require('node:test'),assert=require('node:assert/strict'),Fastify=require('fastify')
const {dateRange,buildAnalytics,allRows}=require('../modules/analytics/service')
const now=new Date('2026-11-24T05:00:00Z')
function fixture(){return {
 malls:[{mall_id:1,mall_name:'Mall, "One"',mall_city:'Cebu'},{mall_id:2,mall_name:'=HYPERLINK("bad")',mall_city:'Talisay'}],
 sessions:[
  {navsesh_id:1,mall_id:1,user_id:10,navsesh_start_time:'2026-11-22T15:59:59Z'},
  {navsesh_id:2,mall_id:1,user_id:10,store_id:1,destination_node_id:1,navsesh_start_time:'2026-11-22T16:00:00Z',navsesh_arrived_time:'2026-11-22T16:01:00Z',navsesh_is_completed:true},
  {navsesh_id:3,mall_id:1,user_id:20,store_id:1,destination_node_id:1,navsesh_start_time:'2026-11-23T15:59:00Z',navsesh_arrived_time:'2026-11-23T15:59:30Z',navsesh_is_completed:true},
  {navsesh_id:4,mall_id:2,user_id:null,navsesh_start_time:'2026-11-23T04:00:00Z',navsesh_arrived_time:null,navsesh_is_completed:false},
  {navsesh_id:5,mall_id:1,user_id:20,navsesh_start_time:'2026-11-23T16:00:00Z'},
 ],
 nodes:[{node_id:1,node_type:'STORE_ENTRANCE',store_id:1}],stores:[{store_id:1,store_name:'Store\n"One", =1',mall_id:1}],
 contracts:[{contract_id:1,mall_id:1,contract_is_current:true,contract_status:'active',contract_start:'2026-01-01T00:00:00Z',contract_end:'2027-01-01T00:00:00Z',contract_annual_fee:25000}],suspensions:[],
 requests:[
  {request_id:1,mall_id:1,fee_type:'subscription',status:'paid',amount_cent:10000,paid_at:'2026-11-23T00:00:00Z',payment_reference:'ONE'},
  {request_id:2,mall_id:1,fee_type:'onboarding',status:'pending',amount_cent:999999,paid_at:null},
  {request_id:3,mall_id:1,fee_type:'onboarding',status:'paid',amount_cent:1000000,paid_at:'2026-11-23T00:00:00Z',payment_reference:'BAD',reconciliation_reason:'Mismatch'},
 ],
 payments:[{payment_id:1,mall_id:1,payment_type:'Annual Subscription Fee',payment_amount:100,payment_paid_at:'2026-11-23T00:00:00Z',payment_ref_num:'ONE'},{payment_id:2,mall_id:2,payment_type:'Stall Addon',payment_amount:25.5,payment_paid_at:'2026-11-23T00:00:00Z',payment_ref_num:'TWO'},{payment_id:3,mall_id:1,payment_type:'Onboarding',payment_amount:10000,payment_paid_at:'2026-11-23T00:00:00Z',payment_ref_num:'BAD'}],
 developments:[{ar_development_id:1,application_id:1,ar_development_status:'live'},{ar_development_id:2,application_id:2,ar_development_status:'node_mapping'}],
 applications:[{application_id:1,mall_id:1},{application_id:2,mall_id:1}],
}}
const report=()=>buildAnalytics(fixture(),dateRange({from:'2026-11-23',to:'2026-11-23'},now),now)

test('analytics uses Manila day boundaries, actual navigation history and valid completed durations',()=>{
 const r=report()
 assert.equal(r.summary.sessions,3);assert.equal(r.summary.completedSessions,2)
 assert.equal(r.summary.averageDurationSeconds,45);assert.equal(r.summary.durationSampleCount,2)
 assert.equal(r.sessionsOverTime.length,1);assert.equal(r.sessionsOverTime[0].sessions,3)
 assert.equal(r.peakHours[0].value,1);assert.equal(r.peakHours[23].value,1)
 assert.deepEqual(r.userType,{newUsers:1,returningUsers:1,totalUnique:2})
 assert.equal(r.summary.liveMalls,1);assert.equal(r.summary.activeMalls,1)
 assert.equal(r.summary.annualSubscriptionValue,25000)
 assert.equal(r.topStores[0].value,2);assert.equal(r.quality.missingSessionUser,1)
 assert.equal(r.mallBreakdown.find(m=>m.id===2).changePercent,null)
 assert(!JSON.stringify(r).includes('user_id'))
})

test('paid requests are authoritative, legacy copies deduplicate and pending/reconciliation amounts do not inflate revenue',()=>{
 const r=report()
 assert.equal(r.summary.recordedPayments,125.5);assert.equal(r.summary.paymentCount,2)
 assert.equal(r.monthlyRevenue[0].value,125.5)
 assert.equal(r.mallPerformance.reduce((n,m)=>n+m.revenue,0),125.5)
 assert.equal(r.paymentTypes.reduce((n,p)=>n+p.value,0),125.5)
 assert.equal(r.quality.duplicateLegacyPayments,2)
 assert.equal(r.quality.excludedPaymentRecords,1)
 const data=fixture();data.suspensions.push({contract_id:1,suspension_lifted_at:null})
 assert.equal(buildAnalytics(data,dateRange({},now),now).summary.annualSubscriptionValue,0)
})

test('empty periods show zero observations and unavailable rankings/durations instead of sample data',()=>{
 const r=buildAnalytics(fixture(),dateRange({from:'2025-01-01',to:'2025-01-03'},now),now)
 assert.equal(r.summary.sessions,0);assert.equal(r.summary.recordedPayments,0)
 assert.equal(r.summary.topMall,null);assert.equal(r.summary.peakHour,null);assert.equal(r.summary.averageDurationSeconds,null)
 assert.equal(r.topStores.length,0);assert.equal(r.topDestinations.length,0)
 assert(r.sessionsOverTime.every(d=>d.sessions===0));assert.equal(r.userType.totalUnique,0)
})

test('ranges validate calendar dates and bounds; pagination reads beyond the default Supabase limit',async()=>{
 for(const query of [{from:'2026-02-30'},{to:'bad'},{from:'2026-12-01',to:'2026-11-01'},{from:'2020-01-01',to:'2026-11-23'}])assert.throws(()=>dateRange(query,now),e=>e.statusCode===400)
 const rows=Array.from({length:1201},(_,id)=>({id})),calls=[]
 const db={from(){return {select(){return this},order(){return this},async range(start,end){calls.push([start,end]);return {data:rows.slice(start,end+1),error:null}}}}}
 assert.equal((await allRows(db,'navigation_session','*','id')).length,1201)
 assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]])
})

function parseCsv(csv){
 const rows=[];let row=[],value='',quoted=false
 for(let i=1;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(value);value=''}else if(c==='\r'&&!quoted&&csv[i+1]==='\n'){row.push(value);rows.push(row);row=[];value='';i++}else value+=c}
 return rows
}
test('one UTF-8 CSV contains every analytics section, all daily rows and safe quoted spreadsheet cells',async()=>{
 const {analyticsCsv}=await import('../../navar-frontend/src/components/analytics/exportCsv.js')
 const r=report(),csv=analyticsCsv(r),rows=parseCsv(csv)
 assert.equal(csv.charCodeAt(0),0xFEFF);assert(rows.every(row=>row.length===15))
 const sections=new Set(rows.slice(1).map(r=>r[0]))
 for(const section of ['Report','Definitions','Summary','Sessions Over Time','Mall Performance','Peak Hours','Top Destinations','User Type','Monthly Payments','Payment Types','Mall Breakdown','Top Stores','Data Quality'])assert(sections.has(section),section)
 assert(rows.some(row=>row[5]==='Mall, "One"'));assert(rows.some(row=>row[5]==='\'=HYPERLINK("bad")'))
 assert(rows.some(row=>row[10]==='Store\n"One", =1'))
 assert.equal(rows.filter(row=>row[0]==='Peak Hours').length,24)
 assert.equal(rows.filter(row=>row[0]==='Sessions Over Time').length,r.sessionsOverTime.length)
 const empty=buildAnalytics(fixture(),dateRange({from:'2025-01-01',to:'2025-01-03'},now),now)
 assert(analyticsCsv(empty).includes('No recorded data for the selected period.'))
})

test('analytics endpoint rejects unauthorized roles and invalid ranges and reports source errors explicitly',async()=>{
 const app=Fastify();app.decorate('supabase',{from(){throw Error('Database unavailable')}})
 app.addHook('preHandler',async req=>{if(req.headers.authorization==='super')req.admin={role:'super_admin'}})
 require('../modules/analytics/routes')(app)
 try{
  assert.equal((await app.inject('/api/analytics')).statusCode,403)
  assert.equal((await app.inject({url:'/api/analytics?from=2026-02-30',headers:{authorization:'super'}})).statusCode,400)
  const failed=await app.inject({url:'/api/analytics',headers:{authorization:'super'}})
  assert.equal(failed.statusCode,500);assert.match(failed.json().message,/Unable to load analytics/)
 }finally{await app.close()}
})

test('analytics ZIP has one rectangular CSV per dataset, including clean empty tables',async()=>{
 const {analyticsZip,analyticsTables}=await import('../../navar-frontend/src/components/analytics/exportBundle.js')
 const r=report(),tables=analyticsTables(r)
 assert.equal(tables.length,13)
 for(const table of tables.filter(t=>t.name.endsWith('.csv'))){const rows=parseCsv(table.text);assert(rows.length>0);assert(rows.every(row=>row.length===rows[0].length),table.name)}
 const bytes=new Uint8Array(await analyticsZip(r).arrayBuffer()),view=new DataView(bytes.buffer)
 assert.equal(view.getUint32(0,true),0x04034b50)
 assert.equal(view.getUint32(bytes.length-22,true),0x06054b50)
 assert.equal(view.getUint16(bytes.length-12,true),13)
 let offset=0,files=0
 while(view.getUint32(offset,true)===0x04034b50){const length=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true);const name=new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLength));assert.equal(name,tables[files].name);const text=new TextDecoder('utf-8',{ignoreBOM:true}).decode(bytes.slice(offset+30+nameLength,offset+30+nameLength+length));assert.equal(text,tables[files].text);offset+=30+nameLength+length;files++}
 assert.equal(files,13)
 const empty=buildAnalytics(fixture(),dateRange({from:'2025-01-01',to:'2025-01-03'},now),now)
 assert.equal(parseCsv(analyticsTables(empty).find(t=>t.name==='10_top_stores.csv').text).length,1)
})
