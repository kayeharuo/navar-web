const {signedImageUrl,floorPlanImageUrl}=require('../storage/imageStorage')
const checked=result=>{if(result.error)throw result.error;return result.data}
const title=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const date=value=>value?new Date(value).toLocaleDateString('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'long',day:'numeric'}):'-'
async function reviewHistory(db,applicationIds){
 return checked(await db.from('application_review_history').select('history_id,application_id,review_round,decision_status,reviewed_at').in('application_id',applicationIds.length?applicationIds:[0]).order('reviewed_at',{ascending:false}))
}
async function historyRecord(db,applicationId,historyId){
 return checked(await db.from('application_review_history').select('*').eq('application_id',applicationId).eq('history_id',historyId).maybeSingle())
}
async function historyDetails(db,base,record,normalizeDay=value=>value){
 const payload=record.payload,a=payload.application,mall=payload.mall||{}
 // Recovered unaccepted requests only closed their service after final rejection.
 const service=record.recovered&&record.review_round<3&&payload.service?.status==='cancelled'&&!payload.service.payment_request_id?{...payload.service,status:'requested'}:payload.service
 const floors=new Map((payload.floors||[]).map(f=>[f.floor_id,f]))
 const floorLabel=id=>floors.get(id)?.floor_label||`Floor ${floors.get(id)?.floor_num??id}`
 const plans=(payload.plans||[]).map(p=>({app_floor_plan_id:p.app_floor_plan_id,floor_id:p.floor_id,floor:floorLabel(p.floor_id),filename:p.app_floor_plan_file_name||p.plan_filename||'Floor plan',size:p.app_floor_plan_file_size?`${(p.app_floor_plan_file_size/1048576).toFixed(1)} MB`:'-',referenceLine:p.app_floor_plan_reference_line,lengthInMeters:p.app_floor_plan_meter_length,accessibilityRoute:p.app_floor_plan_accessibility_route,emergencyRoute:p.app_floor_plan_emergency_route,previewEndpoint:`/api/applications/${base.id}/review-history/${record.history_id}/plans/${p.floor_id}`}))
 const messages=await Promise.all((payload.messages||[]).map(async m=>({
  id:m.message_id,threadId:m.thread_id,name:['admin','super_admin'].includes(m.message_sender_type)?'Super Admin':'Mall Admin',isAdmin:['admin','super_admin'].includes(m.message_sender_type),date:new Date(m.message_sent_at).toLocaleString('en-US',{timeZone:'Asia/Manila'}),message:m.message_content,
  attachments:await Promise.all((payload.attachments||[]).filter(x=>x.thread_message_id===m.message_id).map(async x=>{
   let url=null;try{url=await signedImageUrl(db,x.thread_message_attachment_storage_path,300)}catch{ /* Keep the recorded filename even if Storage is temporarily unavailable. */ }
   return {id:x.thread_message_attachment_id,fileName:x.thread_message_attachment_file_name,mimeType:x.thread_message_attachment_mime_type,fileSize:x.thread_message_attachment_file_size,url}
  })),
 })))
 return {...base,historyId:record.history_id,reviewRound:record.review_round,rejectionReason:record.rejection_reason,reviewedAt:record.reviewed_at,readOnly:true,threadReadOnly:true,canRevise:false,
  applicationStatus:title(record.decision_status),attempt:a.application_attempt,version:a.application_version,reasonCategory:a.application_reason_category,reasonNotes:a.application_reason_notes,disputeCount:a.application_dispute_count,submittedDate:date(a.application_created_at),lastUpdated:date(record.reviewed_at),updatedAt:record.reviewed_at,
  mallName:mall.mall_name||base.mallName,city:mall.mall_city||base.city,address:mall.mall_address||base.address,cityProvince:[mall.mall_city,mall.mall_state].filter(Boolean).join(', '),floors:payload.floors?.length||base.floors,operatingHours:(payload.hours||[]).map(h=>({...h,opthrs_day_of_week:normalizeDay(h.opthrs_day_of_week)})),_floorRecords:payload.floors||[],floorPlans:plans,
  scaleReference:plans[0]?{referenceLine:plans[0].referenceLine,lengthInMeters:`${plans[0].lengthInMeters} m`,floor:plans[0].floor}:undefined,
  accessibilityRoutes:plans.filter(p=>p.accessibilityRoute).map(p=>({floor:p.floor,description:p.accessibilityRoute})),emergencyExits:plans.filter(p=>p.emergencyRoute).map(p=>({floor:p.floor,description:p.emergencyRoute})),
  entryPoints:(payload.entries||[]).map(e=>({name:e.app_entry_point_label,note:e.app_entry_point_description||'',floor:floorLabel(e.floor_id)})),thread:messages,
  mapUpdate:service?{...service,changedFloors:service.inputs?.floorIds?.length||0,paymentCleared:false}:null,
 }
}
async function historyPlan(db,applicationId,historyId,floorId){
 const record=await historyRecord(db,applicationId,historyId)
 const plan=record?.payload?.plans?.find(p=>p.floor_id===floorId)
 if(!plan)return null
 return {url:await floorPlanImageUrl(db,plan,300),fileName:plan.app_floor_plan_file_name||plan.plan_filename||'floor-plan'}
}
module.exports={reviewHistory,historyRecord,historyDetails,historyPlan}
