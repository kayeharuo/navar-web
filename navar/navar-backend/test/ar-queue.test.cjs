const {test}=require('node:test')
const assert=require('node:assert/strict')
const {withQueueNumbers}=require('../modules/applicationManagement/queue')
const base={arStatus:'Pending',applicationStatus:'Approved',version:2,createdAt:'2026-01-01',readOnly:false}
test('map update queue uses tier then precise approval time; initial builds remain FIFO',()=>{
 const projects=[
  {...base,id:1,tierKey:'basic',applicationApprovedAt:'2026-01-01'},
  {...base,id:2,tierKey:'premium',applicationApprovedAt:'2026-03-01'},
  {...base,id:3,tierKey:'standard',applicationApprovedAt:'2026-01-01'},
  {...base,id:4,tierKey:'premium',applicationApprovedAt:'2026-02-01'},
  {...base,id:5,tierKey:'premium',version:1,applicationApprovedAt:'2026-04-01'},
  {...base,id:6,tierKey:'basic',version:1,applicationApprovedAt:'2026-01-01'},
  ...['Live','Unpublished','On Hold','Node Mapping','Testing','Ready'].map((arStatus,i)=>({...base,id:10+i,arStatus,tierKey:'premium'})),
  {...base,id:20,readOnly:true,tierKey:'premium'},
 ]
 const result=withQueueNumbers(projects),queued=result.filter(p=>p.queueNumber!=null)
 assert.deepEqual(queued.filter(p=>p.queueType==='Map update').sort((a,b)=>a.queueNumber-b.queueNumber).map(p=>p.id),[4,2,3,1])
 assert.deepEqual(queued.filter(p=>p.queueType==='Initial build').sort((a,b)=>a.queueNumber-b.queueNumber).map(p=>p.id),[6,5])
 assert.equal(result.filter(p=>p.id>=10).every(p=>p.queueNumber===null),true)
 assert.equal(projects[0].queueNumber,undefined)
})
test('legacy approval fallback and same-time ties produce stable queue positions',()=>{
 const rows=withQueueNumbers([{...base,id:2,tierKey:'basic'},{...base,id:1,tierKey:'basic'}])
 assert.equal(rows.find(p=>p.id===1).queueNumber,1)
 assert.equal(rows.find(p=>p.id===2).queueNumber,2)
})
