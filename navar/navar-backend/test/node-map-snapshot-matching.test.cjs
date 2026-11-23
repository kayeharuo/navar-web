const {test}=require('node:test')
const assert=require('node:assert/strict')
const {canonicalContent,findMatchingSnapshot}=require('../modules/nodeMap/beacons')
const body=()=>({nodes:[{clientId:'old-a',dbId:null,floorId:1,type:'WALKWAY',label:'Entrance',pixelX:20,pixelY:30},{clientId:'old-b',floorId:1,type:'WALKWAY',label:'Corridor',pixelX:50,pixelY:30}],edges:[{fromClientId:'old-a',toClientId:'old-b',pathType:'normal',direction:'both'}],calibrations:[{floorId:1,refStart:{x:0,y:0},refEnd:{x:100,y:0},meters:10,pathLossExponent:2}],transitionGroups:[],beacons:[{clientId:'draft-beacon',beaconCode:'BCN-1',label:'Door',minor:1,txPower:-30,nodeId:'old-a',batteryBrand:'Brand',dateInstalled:'2026-11-23',batteryInstallDate:'2026-11-23',lastMaintenanceDate:'2026-11-23'}]})
test('reopening a map changes IDs without changing snapshot content',async()=>{
 const saved=body(),current=body()
 current.nodes[0]={...current.nodes[0],clientId:'db100',dbId:100}
 current.nodes[1]={...current.nodes[1],clientId:'db200',dbId:200}
 current.nodes.reverse()
 current.edges=[{fromClientId:'db200',toClientId:'db100',pathType:'normal',direction:'both'}]
 current.beacons[0]={...current.beacons[0],clientId:'beacon-12',dbId:12,nodeId:'db100'}
 assert.equal(canonicalContent(saved),canonicalContent(current))
 const {snapshotContent}=await import('../../navar-frontend/src/components/nodeEditor/snapshotContent.js')
 assert.equal(snapshotContent(saved),snapshotContent(current))
 assert.equal(snapshotContent(current),canonicalContent(current))
})
test('geometry, topology, paths, calibration and beacon edits all require a different snapshot',()=>{
 const original=body(),fingerprint=canonicalContent(original)
 for(const change of [b=>b.nodes[0].pixelX++,b=>b.nodes[0].label='Other',b=>b.edges[0].direction='forward',b=>b.edges[0].pathType='restricted',b=>b.edges=[],b=>b.calibrations[0].meters=20,b=>b.beacons[0].nodeId='old-b',b=>b.beacons[0].minor=9,b=>b.beacons[0].batteryBrand='Other']) {
  const changed=structuredClone(original);change(changed);assert.notEqual(canonicalContent(changed),fingerprint)
 }
})
test('transition groups compare by name and type rather than generated UUID',()=>{
 const a=body(),b=body()
 a.transitionGroups=[{id:'old',name:'Stairs A',type:'STAIRS'}];a.nodes[0].transitionGroupId='old'
 b.transitionGroups=[{id:'new',name:'Stairs A',type:'STAIRS'}];b.nodes[0].transitionGroupId='new'
 assert.equal(canonicalContent(a),canonicalContent(b))
 b.transitionGroups[0].name='Stairs B';assert.notEqual(canonicalContent(a),canonicalContent(b))
})
test('database float serialization does not count as a user edit',()=>{
 const saved=body(),loaded=body()
 saved.nodes[0].pixelX=239.14930191502398;loaded.nodes[0].pixelX=239.149301915024
 assert.equal(canonicalContent(saved),canonicalContent(loaded))
 loaded.nodes[0].pixelX+=0.00001
 assert.notEqual(canonicalContent(saved),canonicalContent(loaded))
})
test('matching scans all snapshot pages of this AR version and can reuse an older copy',async()=>{
 const saved=body(),different=body();different.nodes[0].pixelX=99
 const calls=[]
 const db={from(table){assert.equal(table,'node_map_snapshot');return{select(){return this},eq(field,value){calls.push([field,value]);return this},order(){return this},async range(start){return{data:start===0?Array.from({length:100},(_,i)=>({snapshot_id:200-i,name:'Different',saved_map:different})):[{snapshot_id:1,name:'Original entrance',saved_map:saved}]}}}}}
 const match=await findMatchingSnapshot(db,17,saved)
 assert.deepEqual(match,{id:1,name:'Original entrance'})
 assert.deepEqual(calls,[['ar_development_id',17],['ar_development_id',17]])
})
test('no match and incomplete legacy snapshots do not bypass snapshot creation',async()=>{
 const db={from(){return{select(){return this},eq(){return this},order(){return this},async range(){return{data:[{snapshot_id:1,name:'Legacy',saved_map:{nodes:[]}}]}}}}}
 assert.equal(await findMatchingSnapshot(db,17,body()),null)
})
