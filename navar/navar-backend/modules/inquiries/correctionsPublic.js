const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const {hashToken,correctionFields}=require('./followup')
module.exports=function registerCorrections(app) {
 const base=join(__dirname,'correction-page')
 for(const [route,file,type] of [['/inquiry-corrections','index.html','text/html; charset=utf-8'],['/inquiry-corrections/client.js','client.js','application/javascript; charset=utf-8'],['/inquiry-corrections/style.css','style.css','text/css; charset=utf-8']]) {
  const content=readFileSync(join(base,file),'utf8')
  app.get(route,async(req,reply)=>reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer').type(type).send(content))
 }
 for(const file of ['navar-icon-png.png','navar-wordmark-png.png']) {
  const content=readFileSync(join(base,file))
  app.get(`/inquiry-corrections/${file}`,async(req,reply)=>reply.header('Cache-Control','public, max-age=86400').type('image/png').send(content))
 }
 app.post('/api/inquiry-corrections',{bodyLimit:20000,config:{rateLimit:{max:15,timeWindow:'1 minute'}}},async(req,reply)=>{
  reply.header('Cache-Control','no-store')
  try {
   const token=req.body?.token
   if(typeof token!=='string' || !/^[a-f0-9]{64}$/.test(token))return reply.code(400).send({message:'This correction link is invalid or expired.'})
   const fields=req.body.fields===undefined?null:correctionFields(req.body.fields)
   const result=await app.supabase.rpc('submit_inquiry_correction',{p_hash:hashToken(token),p_data:fields})
   if(result.error) {
    req.log.warn({code:result.error.code},'Inquiry correction unavailable')
    if(['PGRST202','42P01','42883'].includes(result.error.code))return reply.code(503).send({message:'Inquiry corrections are temporarily unavailable. Please contact NavAR.'})
    return reply.code(400).send({message:'This link is expired, already submitted, or the inquiry changed. Ask NavAR for a new correction link.'})
   }
   if(result.data?.fields) {
    const address=result.data.fields.address || ''
    const barangay=address.match(/(?:^|,)\s*Barangay\s+([^,]+)/i)?.[1]?.trim() || ''
    return {...result.data,fields:{...result.data.fields,barangay,
     address:address.replace(/(?:^|,)\s*Barangay\s+[^,]+/gi,'').replace(/^,\s*/, '').trim()}}
   }
   return result.data
  } catch(error) {return reply.code(error.statusCode || 500).send({message:error.statusCode===400?error.message:'Unable to update the inquiry. Please try again.'})}
 })
}
