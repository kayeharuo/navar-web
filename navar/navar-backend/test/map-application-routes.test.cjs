const {test}=require('node:test'),assert=require('node:assert/strict'),Fastify=require('fastify')
const routes=require('../modules/mapApplications/routes'),guards=require('../modules/auth/authGuard')
function database(){
 const calls=[]
 const admins=[{admin_id:7,admin_auth_user_id:'super-user',admin_role:'super_admin',admin_account_status:'official',admin_is_deactivated:false},{admin_id:8,admin_auth_user_id:'mall-user',admin_role:'mall_admin',admin_account_status:'official',admin_is_deactivated:false,mall_id:12}]
 return {calls,auth:{getUser:async token=>({data:{user:token==='super'?{id:'super-user'}:token==='mall'?{id:'mall-user'}:null}})},
  from(table){const filters=[];let single=false;const q=new Proxy({},{get(_,key){if(key==='then')return resolve=>{const rows=(table==='admin'?admins:[]).filter(row=>filters.every(([field,value])=>row[field]===value));return Promise.resolve({data:single?rows[0]||null:rows,error:null}).then(resolve)};return(...args)=>{if(key==='eq')filters.push(args);if(['single','maybeSingle'].includes(key))single=true;return q}}});return q},
  async rpc(name,args){calls.push({name,args});return {data:{latest:null,floors:[],message:'Recorded'},error:null}}
 }
}
async function server(db,mall=false){const app=Fastify();app.decorate('supabase',db);const g=guards(db);app.addHook('preHandler',g.requireAuth());if(mall){require('../modules/applicationManagement/mallWorkflowRoutes')(app);routes.registerMall(app)}else{app.addHook('preHandler',g.requireSuperAdmin);routes(app)}await app.ready();return app}
test('assisted version portal requires Super Admin and binds actor and mall independently of body fields',async()=>{
 const db=database(),app=await server(db)
 try{
  assert.equal((await app.inject({method:'GET',url:'/api/map-portal/12'})).statusCode,401)
  assert.equal((await app.inject({method:'GET',url:'/api/map-portal/12',headers:{authorization:'Bearer mall'}})).statusCode,403)
  const response=await app.inject({method:'POST',url:'/api/map-portal/12/submit',headers:{authorization:'Bearer super'},payload:{p_actor:8,mallId:5,floors:[{floorId:49,changed:true,meterLength:6}]}})
  assert.equal(response.statusCode,200);assert.equal(db.calls[0].name,'map_application_portal');assert.equal(db.calls[0].args.p_actor,7);assert.equal(db.calls[0].args.p_mall,12)
  assert.equal((await app.inject({method:'POST',url:'/api/map-portal/12/submit',headers:{authorization:'Bearer super'},payload:{floors:[{floorId:49,changed:true,meterLength:'NaN'}]}})).statusCode,400)
  assert.equal((await app.inject({method:'POST',url:'/api/map-portal/12/approve',headers:{authorization:'Bearer super'},payload:{}})).statusCode,400)
 }finally{await app.close()}
})
test('Mall API uses authenticated ownership and has no manual payment endpoint',async()=>{
 const db=database(),app=await server(db,true)
 try{
  const response=await app.inject({method:'POST',url:'/api/mall/map-applications/dispute',headers:{authorization:'Bearer mall'},payload:{id:5,mallId:99,notes:'Please review'}})
  assert.equal(response.statusCode,200);assert.equal(db.calls[0].args.p_actor,8);assert.equal(db.calls[0].args.p_mall,12)
  assert.equal((await app.inject({method:'POST',url:'/api/mall/map-applications/pay',headers:{authorization:'Bearer mall'},payload:{acknowledged:true}})).statusCode,400)
  assert.equal(db.calls.length,1)
 }finally{await app.close()}
})
