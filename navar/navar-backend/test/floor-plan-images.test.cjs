const {test}=require('node:test'),assert=require('node:assert/strict')
const {floorPlanImageUrl}=require('../modules/storage/imageStorage')
test('review and editor image resolution supports Storage paths, legacy path bytes and independent image bytes',async()=>{
 const calls=[]
 const db={storage:{from:()=>({createSignedUrl:async(path,expires)=>{calls.push({path,expires});return {data:{signedUrl:'https://example.invalid/'+path}}}})}}
 const path='applications/16/versions/1/floors/49/plan.png'
 assert.equal(await floorPlanImageUrl(db,{app_floor_plan_storage_path:path},300),'https://example.invalid/'+path)
 assert.equal(await floorPlanImageUrl(db,{app_floor_plan_image:'\\x'+Buffer.from(path).toString('hex')},600),'https://example.invalid/'+path)
 assert.equal(await floorPlanImageUrl(db,{app_floor_plan_image:path},900),'https://example.invalid/'+path)
 assert.deepEqual(calls.map(c=>c.expires),[300,600,900])
 const png=Buffer.from('89504e470d0a1a0a','hex')
 assert.equal(await floorPlanImageUrl(db,{app_floor_plan_image:'\\x'+png.toString('hex')}),'data:image/png;base64,'+png.toString('base64'))
 assert.equal(calls.length,3)
 await assert.rejects(()=>floorPlanImageUrl(db,{app_floor_plan_image:'\\x'+Buffer.from('Invalid image').toString('hex')}),/unavailable/)
})
