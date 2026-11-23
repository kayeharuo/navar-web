const {test}=require('node:test'),assert=require('node:assert/strict'),Fastify=require('fastify')
const {agreementLabel}=require('../modules/applicationManagement/agreementLabel')
test('pre-subscription phases display Onboarding; actual subscription statuses retain readable casing',()=>{
 for(const contract of [null,{contract_status:'setup'},{contract_status:'pending'},{contract_status:'active',contract_start:null}])assert.equal(agreementLabel(contract),'Onboarding')
 for(const [status,label] of [['active','Active'],['grace_period','Grace Period'],['suspended','Suspended'],['cancelled','Cancelled']])assert.equal(agreementLabel({contract_status:status,contract_start:'2026-11-01'}),label)
})
test('application list, detail and AR list consistently use the current subscription',async()=>{
 const rows={mall:[1,2,3].map(mall_id=>({mall_id,mall_name:'Mall '+mall_id})),
  application:[{application_id:1,mall_id:1,application_version:2,application_attempt:1,application_status:'approved'},{application_id:2,mall_id:2,application_version:1,application_attempt:1,application_status:'draft'}],
  contract:[{mall_id:1,contract_status:'active',contract_start:'2026-11-01',contract_is_current:true},{mall_id:2,contract_status:'cancelled',contract_start:'2026-10-01',contract_is_current:false}],
  ar_development:[1,2].map(application_id=>({application_id,ar_development_id:application_id,ar_development_version:application_id===1?2:1,ar_development_status:'testing'}))}
 const app=Fastify();app.decorate('supabase',{from(table){let values=[...(rows[table]||[])],single=false;const q={
  select(){return q},eq(key,value){values=values.filter(r=>String(r[key])===String(value));return q},in(key,ids){values=values.filter(r=>ids.map(String).includes(String(r[key])));return q},
  order(){return q},not(){return q},limit(n){values=values.slice(0,n);return q},single(){single=true;return q},maybeSingle(){single=true;return q},
  then(resolve,reject){return Promise.resolve({data:single?values[0]||null:values,error:null}).then(resolve,reject)}};return q}})
 require('../modules/applicationManagement/routes')(app)
 try{
  for(const endpoint of ['/api/applications','/api/ar-developments']){
   const r=await app.inject(endpoint);assert.equal(r.statusCode,200,r.body);const data=r.json();assert.equal(data.find(r=>r.mallId===1).agreement,'Active');assert.equal(data.find(r=>r.mallId===2).agreement,'Onboarding');if(endpoint==='/api/applications')assert.equal(data.find(r=>r.mallId===3).agreement,'Onboarding')
  }
  for(const [id,label]of [[1,'Active'],[2,'Onboarding']]){const r=await app.inject('/api/applications/'+id);assert.equal(r.statusCode,200,r.body);assert.equal(r.json().agreement,label)}
 }finally{await app.close()}
})
