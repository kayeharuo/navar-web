const {test}=require('node:test')
const assert=require('node:assert/strict')
const helpers=()=>import('../../navar-frontend/src/components/nodeEditor/beaconChanges.js')
const fixture=()=>({
 nodes:{F1:[{id:'db1',dbId:1,label:'Walkway 1'},{id:'db2',dbId:2,label:'Walkway 1'}],F2:[{id:'db3',dbId:3}]},
 edges:{F1:[{from:'db1',to:'db2'}],__crossFloor:[{from:'db1',to:'db3'}]},
 groups:[{id:'g'}],calibration:{F1:{meters:10}},
 beacons:[{clientId:'beacon-1',dbId:1,nodeId:'db1',label:'Beacon A'},{clientId:'beacon-2',dbId:2,nodeId:'db3',label:'Beacon B'}],
})
test('deleting H&M unassigns its beacon without transferring it along the edge to Walkway 1',async()=>{
 const {planNodeDeletion}=await helpers()
 const original={nodes:{F1:[{id:'db58',dbId:58,label:'H&M'},{id:'db71',dbId:71,label:'Walkway 1'}]},edges:{F1:[{from:'db58',to:'db71'}]},calibration:{},groups:[],beacons:[{clientId:'beacon-23',dbId:23,nodeId:'db58',label:'H&M'}]}
 const plan=planNodeDeletion(original,'F1',['db58'])
 assert.equal(plan.affected.length,1)
 assert.equal(plan.snapshot.nodes.F1[0].id,'db71')
 assert.equal(plan.snapshot.beacons[0].nodeId,null)
 assert.notEqual(plan.snapshot.beacons[0].nodeId,'db71')
 assert.equal(original.beacons[0].nodeId,'db58')
})
test('a beacon label or connecting edge does not create an assignment to the store node',async()=>{
 const {planNodeDeletion}=await helpers()
 const original={nodes:{F1:[{id:'db58',dbId:58,label:'H&M'},{id:'db71',dbId:71,label:'Walkway 1'}]},edges:{F1:[{from:'db58',to:'db71'}]},calibration:{},groups:[],beacons:[{clientId:'beacon-23',dbId:23,nodeId:'db71',label:'H&M'}]}
 const plan=planNodeDeletion(original,'F1',['db58'])
 assert.equal(plan.affected.length,0)
 assert.equal(plan.snapshot.beacons[0].nodeId,'db71')
})
test('linked node deletion identifies affected beacon, clears its draft link and preserves immutable snapshot',async()=>{
 const {planNodeDeletion,findBeaconAssignmentChanges}=await helpers()
 const original=fixture(),copy=structuredClone(original)
 const plan=planNodeDeletion(original,'F1',['db1'])
 assert.equal(plan.affected.length,1)
 assert.equal(plan.affected[0].label,'Beacon A')
 assert.equal(plan.affected[0].removedNode.id,'db1')
 assert.equal(plan.snapshot.beacons[0].nodeId,null)
 assert.equal(plan.snapshot.beacons[1].nodeId,'db3')
 assert.deepEqual(plan.snapshot.edges,{F1:[],__crossFloor:[]})
 assert.deepEqual(plan.snapshot.groups,original.groups)
 assert.deepEqual(plan.snapshot.calibration,original.calibration)
 assert.deepEqual(original,copy)
 assert.deepEqual(findBeaconAssignmentChanges(original.beacons,plan.snapshot.beacons,plan.snapshot.nodes).map(b=>b.clientId),['beacon-1'])
})
test('same node labels do not confuse beacon deletion warnings',async()=>{
 const {planNodeDeletion}=await helpers()
 const original=fixture(),plan=planNodeDeletion(original,'F1',['db2'])
 assert.equal(plan.affected.length,0)
 assert.equal(plan.snapshot.beacons[0].nodeId,'db1')
})
test('database identity aliases detect links after restoring or continuing a saved map',async()=>{
 const {planNodeDeletion,findBeaconAssignmentChanges}=await helpers()
 const draft=fixture()
 draft.nodes.F1[0]={id:'editor-new',dbId:1,label:'Entrance'}
 const plan=planNodeDeletion(draft,'F1',['editor-new'])
 assert.equal(plan.affected.length,1)
 const current=[{clientId:'snapshot-beacon',dbId:1,nodeId:'editor-new'},draft.beacons[1]]
 assert.equal(findBeaconAssignmentChanges(draft.beacons,current,draft.nodes).length,0)
 current[0].nodeId=null
 assert.equal(findBeaconAssignmentChanges(draft.beacons,current,draft.nodes).length,1)
})
test('newly persisted editor identities warn on multi-node deletion and retain both original links for undo',async()=>{
 const {planNodeDeletion}=await helpers()
 const draft=fixture()
 draft.nodes.F1[0]={id:'new1',label:'Entrance'}
 const plan=planNodeDeletion(draft,'F1',['new1','db2'],new Map([['new1',1]]))
 assert.equal(plan.removed.length,2)
 assert.equal(plan.affected.length,1)
 assert.equal(plan.snapshot.beacons[0].nodeId,null)
 assert.equal(draft.beacons[0].nodeId,'db1')
 assert.equal(draft.nodes.F1.length,2)
})
test('already unassigned beacons remain part of save review even when the map has not changed',async()=>{
 const {getBeaconAssignmentIssues}=await helpers()
 const saved=fixture();saved.beacons[0].nodeId=null
 const review=getBeaconAssignmentIssues(saved.beacons,saved.nodes)
 assert.deepEqual(review.unassigned.map(b=>b.clientId),['beacon-1'])
 assert.equal(review.missing.length,0)
 assert.deepEqual(getBeaconAssignmentIssues(structuredClone(saved.beacons),saved.nodes),review)
})
test('missing-node references and explicit unassignments are different states',async()=>{
 const {getBeaconAssignmentIssues,planNodeDeletion}=await helpers()
 const draft=fixture();draft.nodes.F1=draft.nodes.F1.filter(n=>n.id!=='db1')
 let review=getBeaconAssignmentIssues(draft.beacons,draft.nodes)
 assert.equal(review.missing.length,1);assert.equal(review.unassigned.length,0)
 const deleted=planNodeDeletion(fixture(),'F1',['db1']).snapshot
 review=getBeaconAssignmentIssues(deleted.beacons,deleted.nodes)
 assert.equal(review.missing.length,0);assert.equal(review.unassigned.length,1)
})
