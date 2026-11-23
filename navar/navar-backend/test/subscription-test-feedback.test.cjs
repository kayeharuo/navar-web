const {test}=require('node:test')
const assert=require('node:assert/strict')
const {pathToFileURL}=require('node:url')
const path=require('node:path')
const helper=()=>import(pathToFileURL(path.resolve(__dirname,'../../navar-frontend/src/components/subscriptionManagement/testAction.js')).href)
test('completed subscription action stays successful if the following status reload fails',async()=>{
 const {runTestAction}=await helper()
 const result={fulfilled:true,requestId:21,message:'Subscription paid and AR published'}
 const outcome=await runTestAction(async()=>result,async()=>{throw new Error('Refresh unavailable')})
 assert.deepEqual(outcome,{result,refreshError:'Refresh unavailable'})
})
test('rejected subscription action is reported and never treated as a successful save',async()=>{
 const {runTestAction}=await helper();let refreshed=false
 await assert.rejects(runTestAction(async()=>{throw new Error('AR approval is required')},async()=>{refreshed=true}),/approval is required/)
 assert.equal(refreshed,false)
})
test('successful action returns its reference after the status refresh',async()=>{
 const {runTestAction}=await helper();let refreshed=false
 const outcome=await runTestAction(async()=>({requestId:23,fulfilled:true}),async()=>{refreshed=true})
 assert.equal(refreshed,true);assert.equal(outcome.refreshError,null);assert.equal(outcome.result.requestId,23)
})
