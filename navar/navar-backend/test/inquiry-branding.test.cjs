const {test}=require('node:test')
const assert=require('node:assert/strict')
const {inquiryEmailParts}=require('../modules/inquiries/emailTemplate')

test('invitation rendering works without network access and preserves the setup link',async()=>{
 const previous=global.fetch
 global.fetch=async()=>{throw new Error('Network unavailable')}
 try {
  const result=await inquiryEmailParts({row:{inquiry_mall_name:'Example Mall'},message:'Complete setup',link:'https://example.com/complete-setup?token=test',env:{SUPABASE_URL:'https://offline.example.com',SMTP_USER:'navar@gmail.com'}})
  assert.equal(result.attachments.length,6)
  assert.match(result.html,/https:\/\/example.com\/complete-setup\?token=test/)
  for(const item of result.attachments){
   assert.match(result.html,new RegExp('cid:'+item.cid.replaceAll('.','\\.')))
   assert.equal(item.content.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
  }
 }finally{global.fetch=previous}
})
