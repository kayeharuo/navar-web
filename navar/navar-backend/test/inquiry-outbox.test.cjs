const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createOutbox}=require('../modules/inquiries/outbox')

test('a restarted outbox resumes durable pending rows without resending uncertain mail',async()=>{
 const rows=[{i_message_id:1,status:'pending'},{i_message_id:2,status:'unconfirmed'},{i_message_id:3,status:'sending'}]
 const sent=[]
 const options={log:{warn(){}},listPending:async()=>rows.filter(row=>row.status==='pending'),
  send:async row=>{row.status='sent';sent.push(row.i_message_id)}}
 const stopped=createOutbox(options)
 await stopped.stop() // Simulates a process ending with a persisted queued message.
 await stopped.kick();assert.deepEqual(sent,[])
 const restarted=createOutbox(options)
 await Promise.all([restarted.kick(),restarted.kick()])
 await restarted.kick()
 assert.deepEqual(sent,[1])
 assert.equal(rows[1].status,'unconfirmed');assert.equal(rows[2].status,'sending')
 await restarted.stop()
})
