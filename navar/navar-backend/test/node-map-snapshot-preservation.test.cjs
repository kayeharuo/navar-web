const {test}=require('node:test')
const assert=require('node:assert/strict')
const helper=async()=> (await import('../../navar-frontend/src/components/nodeEditor/snapshotPreservation.js')).preserveCurrentSnapshot
test('restoring with an identical saved map reuses it without a name or insert',async()=>{
 const preserve=await helper();let inserted=false
 const saved=await preserve({name:'',body:{nodes:[]},payload:{},findMatch:async()=>({match:{id:4,name:'Original layout'}}),create:async()=>{inserted=true;throw new Error('Duplicate snapshot')}})
 assert.deepEqual(saved,{snapshot_id:4,name:'Original layout',existing:true})
 assert.equal(inserted,false)
})
test('typing a different name still does not duplicate identical content',async()=>{
 const preserve=await helper()
 const saved=await preserve({name:'Another name',body:{},payload:{},findMatch:async()=>({match:{id:2,name:'Earlier copy'}}),create:async()=>{throw new Error('Duplicate snapshot')}})
 assert.equal(saved.name,'Earlier copy');assert.equal(saved.existing,true)
})
test('unsaved differences need a name before restore can preserve them',async()=>{
 const preserve=await helper();let inserted=false
 await assert.rejects(preserve({name:' ',body:{},payload:{},findMatch:async()=>({match:null}),create:async()=>{inserted=true}}),/Enter a name/)
 assert.equal(inserted,false)
})
test('a new layout is saved before allowing restore, while a failed check stops creation',async()=>{
 const preserve=await helper();const events=[];const payload={nodes:{F1:[]},beacons:[]}
 const saved=await preserve({name:' New layout ',body:{},payload,findMatch:async()=>{events.push('checked');return{match:null}},create:async value=>{events.push('saved');assert.deepEqual(value,{name:'New layout',payload});return{snapshot_id:8,name:value.name}}})
 assert.equal(saved.snapshot_id,8);assert.deepEqual(events,['checked','saved'])
 await assert.rejects(preserve({name:'Layout',body:{},payload,findMatch:async()=>{throw new Error('Network unavailable')},create:async()=>{throw new Error('Must not create')}}),/Network unavailable/)
})
