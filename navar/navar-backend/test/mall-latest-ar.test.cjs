const {test}=require('node:test'),assert=require('node:assert/strict'),Fastify=require('fastify')

async function mallResponse({contract=null,developments=[]}={}){
 const rows={mall:[{mall_id:100,mall_name:'Mall'}],application:[{application_id:30,mall_id:100,application_version:3,application_attempt:1,application_status:'draft'}],ar_development:developments,contract:contract?[contract]:[]}
 const app=Fastify()
 app.decorate('supabase',{rpc:async()=>({data:{},error:null}),from(table){
  let values=[...(rows[table]||[])],single=false
  const q={select(){return q},eq(column,value){values=values.filter(row=>column==='application.mall_id'?row.application.mall_id===Number(value):row[column]===value||String(row[column])===String(value));return q},
   or(){return q},in(){return q},order(column,{ascending=true}={}){values.sort((a,b)=>(a[column]-b[column])*(ascending?1:-1));return q},limit(n){values=values.slice(0,n);return q},single(){single=true;return q},maybeSingle(){single=true;return q},
   then(resolve,reject){return Promise.resolve({data:single?values[0]||null:values,error:null}).then(resolve,reject)}}
  return q
 }})
 require('../modules/mallManagement/routes')(app)
 try{const response=await app.inject('/api/malls/100');assert.equal(response.statusCode,200,response.body);return response.json()}finally{await app.close()}
}
const ar=[{ar_development_id:1,application_id:10,ar_development_version:1,ar_development_status:'live',application:{mall_id:100}},{ar_development_id:2,application_id:20,ar_development_version:2,ar_development_status:'node_mapping',application:{mall_id:100}}]
test('latest existing AR remains visible without a subscription or AR for the latest application',async()=>{
 const mall=await mallResponse({developments:ar});assert.equal(mall.applicationVersion,3);assert.equal(mall.arDevelopment,'Node Mapping');assert.equal(mall.arDevelopmentVersion,2)
})
test('a current subscription does not change which AR version is displayed',async()=>{
 const mall=await mallResponse({developments:ar,contract:{mall_id:100,contract_is_current:true,contract_status:'active'}});assert.equal(mall.arDevelopment,'Node Mapping');assert.equal(mall.arDevelopmentVersion,2)
})
test('malls with no AR development show an empty marker',async()=>{
 const mall=await mallResponse();assert.equal(mall.arDevelopment,'-');assert.equal(mall.arDevelopmentVersion,null)
})
