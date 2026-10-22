require('dotenv').config({quiet:true})
const {createClient}=require('@supabase/supabase-js')
const register=require('../modules/inquiries/routes')
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const requestId=require('node:crypto').randomUUID()
const check=r=>{if(r.error)throw r.error;return r.data}
async function main(){
 const row=check(await db.from('inquiry').select('inquiry_id,inquiry_mall_name,inquiry_contact_email,inquiry_status,mall_id,inquiry_updated_at,inquiry_reviewed_by').eq('inquiry_id',9).single())
 if(row.inquiry_mall_name!=='SM Hyper Market'||row.inquiry_contact_email!=='macahibaglloyd@gmail.com'||row.mall_id!==19||row.inquiry_status!=='Approved')throw Error('Inquiry scope changed')
 const actor=check(await db.from('admin').select('admin_id,admin_full_name,admin_role,admin_is_deactivated,admin_account_status').eq('admin_id',row.inquiry_reviewed_by).single())
 if(actor.admin_role!=='super_admin'||actor.admin_is_deactivated||actor.admin_account_status!=='official')throw Error('Reviewing admin is not active')
 // Invoke the existing route in-process; do not start inbox/outbox workers or a public server.
 const routes=new Map(),cleanup=[]
 const log={warn:(data,message)=>console.log(JSON.stringify({level:'warn',message,...data})),error:(data,message)=>console.log(JSON.stringify({level:'error',message,...data}))}
 const app={supabase:db,log,addHook:(name,handler)=>{if(name==='onClose'||name==='preClose')cleanup.push(handler)},get:()=>{},patch:()=>{},post:(path,...args)=>routes.set(path,args.at(-1))}
 register(app)
 let status=200
 const reply={header(){return this},code(value){status=value;return this},send(value){return value}}
 try{
  const result=await routes.get('/api/inquiries/:id/followup')({params:{id:'9'},body:{action:'reissue',requestId,updatedAt:row.inquiry_updated_at,acknowledgeUncertain:true},admin:{id:actor.admin_id,name:actor.admin_full_name},log,routeOptions:{url:'/api/inquiries/:id/followup'}},reply)
  console.log(JSON.stringify({httpStatus:status,result}))
  const message=check(await db.from('inquiry_message').select('i_message_id,i_message_delivery_status,i_message_delivered_at').eq('i_message_request_id',requestId).maybeSingle())
  console.log(JSON.stringify({verification:message}))
  if(status!==200||!result?.ok||message?.i_message_delivery_status!=='sent')throw Error('Invitation delivery was not confirmed; do not automatically resend')
 }finally{for(const close of cleanup)await close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
