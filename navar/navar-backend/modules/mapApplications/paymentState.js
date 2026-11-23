const checked=result=>{if(result.error)throw result.error;return result.data}
async function mapUpdateState(db,applicationId){
 const rows=checked(await db.from('mall_service_request').select('status,quote,inputs,payment_request_id').eq('application_id',applicationId).eq('kind','map_update').order('service_id',{ascending:false}).limit(1))
 const s=rows?.[0]
 if(!s)return null
 const amount=Number(s.quote?.amount_cent)
 let paymentCleared=['queued','in_progress'].includes(s.status)&&amount===0&&!s.payment_request_id
 if(['queued','in_progress'].includes(s.status)&&amount>0&&s.payment_request_id){
  const pay=checked(await db.from('contract_payment_request').select('status,fulfilled_at,reconciliation_reason,amount_cent').eq('request_id',s.payment_request_id).maybeSingle())
  paymentCleared=!!pay&&pay.status==='paid'&&!!pay.fulfilled_at&&pay.reconciliation_reason==null&&Number(pay.amount_cent)===amount
 }
 return {...s,changedFloors:s.inputs?.floorIds?.length||0,paymentCleared}
}
module.exports={mapUpdateState}
