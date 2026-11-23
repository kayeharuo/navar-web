const {test}=require('node:test')
const assert=require('node:assert/strict')
const Fastify=require('fastify')
const nodemailer=require('nodemailer')
const register=require('../modules/emailDelivery/routes')

function database(rows) {
  return {from(table) {
    assert.equal(table,'email_log')
    let operation='select',payload,filters=[],descending=false
    const run=()=>{
      if(operation==='insert') {
        const row={email_log_id:Math.max(0,...rows.map(r=>r.email_log_id))+1,...payload};rows.push(row);return {data:[row]}
      }
      const found=rows.filter(r=>filters.every(fn=>fn(r)))
      if(descending)found.sort((a,b)=>b.email_log_id-a.email_log_id)
      if(operation==='update')found.forEach(r=>Object.assign(r,payload))
      return {data:found}
    }
    const q={select(){return q},order(_key,options){descending=options?.ascending===false;return q},limit(){return q},
      insert(value){operation='insert';payload=value;return q},update(value){operation='update';payload=value;return q},
      eq(key,value){filters.push(r=>String(r[key])===String(value));return q},
      gt(key,value){filters.push(r=>r[key]>value);return q},
      lt(key,value){filters.push(r=>r[key]!=null&&r[key]<value);return q},
      in(key,values){filters.push(r=>values.map(String).includes(String(r[key])));return q},
      async single(){const result=run();return {data:result.data[0]}},async maybeSingle(){const result=run();return {data:result.data[0]||null}},
      then(resolve,reject){return Promise.resolve().then(run).then(resolve,reject)},
    };return q
  }}
}
test('resend reports actual acceptance or failure, preserves attempts, and sends only the requested email',async()=>{
  const oldTransport=nodemailer.createTransport
  const envKeys=['SMTP_USER','SMTP_PASS','SMTP_FROM','OFFICIAL_SMTP_USER','OFFICIAL_SMTP_PASS']
  const oldEnv=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]))
  Object.assign(process.env,{SMTP_USER:'sender@example.test',SMTP_PASS:'fake-test-password',SMTP_FROM:'sender@example.test'})
  delete process.env.OFFICIAL_SMTP_USER;delete process.env.OFFICIAL_SMTP_PASS
  let fail=false;const recipients=[]
  nodemailer.createTransport=()=>({async sendMail(mail){recipients.push(mail.to);assert.match(mail.html, /Please renew\./);assert.match(mail.text,/^Good day,/);assert.match(mail.text,/Please renew\./);assert.equal(mail.attachments.length,2);if(fail)throw Object.assign(new Error('Rejected credentials'),{code:'EAUTH'});return {accepted:[mail.to],messageId:'test-provider-id'}},close(){}})
  const original={email_log_id:1,email_log_type:'subscription_expiry_5',email_log_to_email:'target@example.test',email_log_subject:'Renewal',email_log_body:'Please renew.',email_log_status:'failed',email_log_source_type:'subscription',email_log_source_id:'1'}
  const rows=[{...original},{...original,email_log_id:2,email_log_to_email:'unrelated@example.test',email_log_status:'queued',email_log_source_id:'2'}]
  const app=Fastify();app.decorate('supabase',database(rows));app.addHook('preHandler',async req=>{req.admin={id:1}});register(app)
  try {
    const resend=()=>app.inject({method:'POST',url:'/api/email-logs/1/resend',payload:{acknowledged:true}})
    const accepted=await resend()
    assert.equal(accepted.statusCode,200,accepted.body)
    assert.equal(accepted.json().attempt.status,'sent')
    assert.deepEqual(recipients,['target@example.test'])
    assert.equal(rows[0].email_log_status,'failed')
    assert.equal(rows[1].email_log_status,'queued')
    assert.equal(rows[2].email_log_attempt_of,1)
    const state=await app.inject(`/api/email-logs/${accepted.json().attemptId}/status`)
    assert.equal(state.json().status,'sent')
    fail=true
    const failed=await resend()
    assert.equal(failed.json().attempt.status,'failed')
    assert.match(failed.json().attempt.reason,/sender login/)
    assert.equal(rows[2].email_log_status,'sent')
    rows[0].email_log_status='unconfirmed'
    const blocked=await app.inject({method:'POST',url:'/api/email-logs/1/resend',payload:{acknowledged:false}})
    assert.equal(blocked.statusCode,409)
    assert.equal(recipients.length,2)
  }finally{
    await app.close();nodemailer.createTransport=oldTransport
    for(const k of envKeys){if(oldEnv[k]===undefined)delete process.env[k];else process.env[k]=oldEnv[k]}
  }
})
