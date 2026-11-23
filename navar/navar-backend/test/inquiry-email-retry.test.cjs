const { test } = require('node:test')
const assert = require('node:assert/strict')
const { retryReason, loadInquiryRetryReasons } = require('../modules/emailDelivery/inquiryRetry')

test('historical uncertainty does not permit another send after a newer accepted attempt', () => {
  const log = { email_log_id: 2, email_log_status: 'unconfirmed' }
  const current = { i_message_kind: 'reply', i_message_delivery_status: 'sent' }
  assert.match(retryReason(log,current,{email_log_id:30,email_log_status:'sent'}),/newer delivery attempt.*accepted/)
  assert.match(retryReason(log,{...current,i_message_delivery_status:'sending'},{email_log_id:30,email_log_status:'sending'}),/already queued or sending/)
})
test('completed account setup blocks a fresh setup link, but eligible unconfirmed links remain retryable', () => {
  const log = { email_log_id: 21, email_log_status: 'unconfirmed' }
  const current = { i_message_kind: 'convert', i_message_delivery_status: 'unconfirmed' }
  const owner = { admin_account_status:'partial',admin_is_deactivated:false }
  assert.equal(retryReason(log,current,log,{},owner,{setup_completed_at:null}),null)
  assert.match(retryReason(log,current,log,{}, {...owner,admin_account_status:'official'}, {setup_completed_at:'2026-10-21'}),/completed account setup.*Password Reset/)
  assert.equal(retryReason(log,{i_message_kind:'reply',i_message_delivery_status:'not_recorded'},log),null)
  assert.match(retryReason(log,{i_message_kind:'correction',i_message_delivery_status:'unconfirmed'},log,{mall_id:19}),/finalized/)
})
test('batch retry eligibility reproduces the two reported historical records without changing them',async()=>{
  const logs=[{email_log_id:2,email_log_status:'unconfirmed',email_log_source_type:'inquiry',email_log_source_id:'1'},
    {email_log_id:30,email_log_status:'sent',email_log_source_type:'inquiry',email_log_source_id:'1'},
    {email_log_id:21,email_log_status:'unconfirmed',email_log_source_type:'inquiry',email_log_source_id:'34'}]
  const tables={inquiry_message:[{i_message_id:1,inquiry_id:3,i_message_kind:'reply',i_message_delivery_status:'sent'},{i_message_id:34,inquiry_id:9,i_message_kind:'convert',i_message_delivery_status:'unconfirmed'}],
    inquiry:[{inquiry_id:3,mall_id:13,inquiry_contact_email:'one@example.test'},{inquiry_id:9,mall_id:19,inquiry_contact_email:'owner@example.test'}],
    admin:[{admin_id:25,mall_id:19,admin_email:'owner@example.test',admin_is_primary:true,admin_role:'mall_admin',admin_account_status:'official',admin_is_deactivated:false}],
    mall_admin_account:[{admin_id:25,setup_completed_at:'2026-10-21'}]}
  const db={from(table){let rows=tables[table];const q={select(){return q},in(key,values){rows=rows.filter(r=>values.includes(r[key]));return q},eq(key,value){rows=rows.filter(r=>r[key]===value);return q},then(resolve,reject){return Promise.resolve({data:rows}).then(resolve,reject)}};return q}}
  const result=await loadInquiryRetryReasons(db,logs)
  assert.match(result.get(2),/newer delivery attempt/)
  assert.match(result.get(21),/Password Reset/)
  assert.equal(logs[0].email_log_status,'unconfirmed')
})
