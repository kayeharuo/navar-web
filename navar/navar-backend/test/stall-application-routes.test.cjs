const {test}=require('node:test'),assert=require('node:assert/strict'),Fastify=require('fastify')
const guards=require('../modules/auth/authGuard')
const routes=require('../modules/stallApplications/routes')
const createAR=require('../modules/applicationManagement/arService')
function database(){
 const calls=[]
 const tables={admin:[{admin_id:7,admin_auth_user_id:'super-user',admin_role:'super_admin',admin_account_status:'official',admin_is_deactivated:false},{admin_id:8,admin_auth_user_id:'mall-user',admin_role:'mall_admin',admin_account_status:'official',admin_is_deactivated:false,mall_id:12}],stall_expansion:[{id:91,stall_application_id:63,mall_id:12,service_id:44,status:'submitted',revision:3,submitted_at:'2026-11-23T00:00:00Z'}],mall:[{mall_id:12,mall_name:'Gaisano Fiesta Mall',mall_city:'Talisay'}],mall_service_request:[{service_id:44,quote:{quantity:2,amount_cent:220000}}],thread:[{thread_id:9,s_application_id:63}],thread_message:[],ar_development:[{ar_development_id:17,application_id:16,ar_development_status:'ready',ar_development_version:1,ar_development_activated_at:'2026-11-23T00:00:00Z',ar_development_mall_approved_at:'2026-11-23T00:00:00Z'}],application:[{application_id:16,mall_id:12}]}
 const db={calls,auth:{getUser:async token=>({data:{user:token==='super'?{id:'super-user'}:token==='mall'?{id:'mall-user'}:null}})},from(table){const filters=[];let single=false;const q=new Proxy({},{get(_,method){if(method==='then')return resolve=>{const rows=(tables[table]||[]).filter(r=>filters.every(([k,v])=>String(r[k])===String(v)));return Promise.resolve({data:single?rows[0]||null:rows,error:null}).then(resolve)};return(...args)=>{if(method==='eq')filters.push(args);if(['single','maybeSingle'].includes(method))single=true;return q}}});return q},async rpc(name,args){calls.push({name,args});return {data:{status:'approved',id:91},error:null}}}
 db.tables=tables
 return db
}
async function server(db,mall=false){const app=Fastify();app.decorate('supabase',db);const g=guards(db);app.addHook('preHandler',g.requireAuth());if(mall){require('../modules/applicationManagement/mallWorkflowRoutes')(app);routes.registerMall(app)}else{app.addHook('preHandler',g.requireSuperAdmin);routes(app)}await app.ready();return app}
test('stall actions require verified Super Admin identity and cannot take actor identity from the request body',async()=>{
 const db=database(),app=await server(db)
 try{
  assert.equal((await app.inject({method:'GET',url:'/api/stall-applications'})).statusCode,401)
  assert.equal((await app.inject({method:'GET',url:'/api/stall-applications',headers:{authorization:'Bearer mall'}})).statusCode,403)
  const result=await app.inject({method:'POST',url:'/api/stall-portal/12/pay',headers:{authorization:'Bearer super'},payload:{id:91,acknowledged:true,p_actor:8,amount:1}})
  assert.equal(result.statusCode,200)
  assert.equal(db.calls[0].args.p_actor,7);assert.equal(db.calls[0].args.p_mall,12);assert.equal(db.calls[0].args.p_action,'pay')
 }finally{await app.close()}
})
test('real stall listing and review use stall application IDs separately from expansion IDs',async()=>{
 const db=database(),app=await server(db)
 try{
  const result=await app.inject({method:'GET',url:'/api/stall-applications',headers:{authorization:'Bearer super'}})
  assert.equal(result.statusCode,200);const [row]=result.json();assert.equal(row.id,63);assert.equal(row.expansionId,91);assert.equal(row.fee,2200);assert.equal(row.submittedStalls,2);assert.equal(row.applicationStatus,'Submitted')
  const review=await app.inject({method:'POST',url:'/api/stall-applications/63/approve',headers:{authorization:'Bearer super'},payload:{revision:3}})
  assert.equal(review.statusCode,200);assert.equal(db.calls[0].name,'review_stall_expansion');assert.equal(db.calls[0].args.p_id,91);assert.equal(db.calls[0].args.p_actor,7)
 }finally{await app.close()}
})
test('mall API binds ownership to the verified mall and exposes no manual payment action',async()=>{
 const db=database(),app=await server(db,true)
 try{
  const result=await app.inject({method:'POST',url:'/api/mall/stall-applications/prepare',headers:{authorization:'Bearer mall'},payload:{mall_id:99,floors:[{floor_id:1,quantity:2}]}})
  assert.equal(result.statusCode,200);assert.equal(db.calls[0].args.p_actor,8);assert.equal(db.calls[0].args.p_mall,12)
  const pay=await app.inject({method:'POST',url:'/api/mall/stall-applications/pay',headers:{authorization:'Bearer mall'},payload:{acknowledged:true}})
  assert.equal(pay.statusCode,400);assert.equal(db.calls.length,1)
 }finally{await app.close()}
})
test('previously Live version one reuses its active subscription instead of requiring another first payment',async()=>{
 const db=database();let usedCurrent=false
 const service=createAR(db,{isFirstSubscriptionPaid:async()=>{throw new Error('Must not request first payment again')},isSubscriptionValid:async(mall,options)=>{assert.equal(mall,12);assert.deepEqual(options,{allowGrace:false});usedCurrent=true;return true}})
 const result=await service.tryPublish(17,7)
 assert.equal(usedCurrent,true);assert.equal(result.published,true);assert.equal(db.calls[0].args.p_action,'publish')
})

test('Super Admin list excludes unsubmitted requests and keeps published applications Approved',async()=>{
 const db=database()
 db.tables.stall_expansion=['draft','awaiting_payment','cancelled','submitted','revision','approved','completed'].map((status,index)=>({id:index+1,stall_application_id:index+20,mall_id:12,service_id:44,status}))
 const app=await server(db)
 try{
  const response=await app.inject({method:'GET',url:'/api/stall-applications',headers:{authorization:'Bearer super'}})
  assert.equal(response.statusCode,200)
  assert.deepEqual(response.json().map(row=>row.applicationStatus),['Approved','Approved','For Revision','Submitted'])
 }finally{await app.close()}
})
