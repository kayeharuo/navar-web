'use strict'
const {loadAnalytics}=require('./service')
module.exports=function registerAnalyticsRoutes(app){
 app.get('/api/analytics',async(request,reply)=>{
  if(request.admin?.role!=='super_admin')return reply.code(403).send({message:'Access denied.'})
  try{return await loadAnalytics(app.supabase,request.query)}
  catch(error){request.log.error({code:error.code,message:error.message},'Analytics could not be loaded');return reply.code(error.statusCode===400?400:500).send({message:error.statusCode===400?error.message:'Unable to load analytics. Please try again.'})}
 })
}
