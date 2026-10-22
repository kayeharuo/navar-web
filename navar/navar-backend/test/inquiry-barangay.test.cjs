const {test}=require('node:test')
const assert=require('node:assert/strict')
const Fastify=require('fastify')
const {correctionFields}=require('../modules/inquiries/followup')
const register=require('../modules/inquiries/correctionsPublic')
const base={mallName:'Mall',contactPerson:'Ana',phone:'+639123456789',province:'Cebu',city:'Cebu City',address:'12 Main Street',zipCode:'0600',floors:2}

test('barangay corrections replace the previous barangay and preserve ZIP code',()=>{
 const saved=correctionFields({...base,address:'12 Main Street, Barangay Luz',barangay:'Lahug'})
 assert.equal(saved.address,'12 Main Street, Barangay Lahug')
 assert.equal(saved.zipCode,'0600')
 assert.equal(correctionFields({...base,address:saved.address}).address,saved.address)
 assert.throws(()=>correctionFields({...base,barangay:''}))
 assert.throws(()=>correctionFields({...base,barangay:'Luz, Cebu'}))
})

test('correction page loads barangay separately and persists it through the existing RPC',async()=>{
 const app=Fastify()
 let saved
 app.decorate('supabase',{rpc:async(name,args)=>{
  saved=args.p_data
  return {data:args.p_data?{ok:true}:{fields:{...base,address:'12 Main Street, Barangay Luz'}}}
 }})
 register(app)
 try {
  const load=await app.inject({method:'POST',url:'/api/inquiry-corrections',payload:{token:'a'.repeat(64)}})
  assert.equal(load.json().fields.barangay,'Luz')
  assert.equal(load.json().fields.address,'12 Main Street')
  const submit=await app.inject({method:'POST',url:'/api/inquiry-corrections',payload:{token:'a'.repeat(64),fields:{...load.json().fields,barangay:'Lahug'}}})
  assert.equal(submit.statusCode,200)
  assert.equal(saved.address,'12 Main Street, Barangay Lahug')
 } finally {await app.close()}
})
