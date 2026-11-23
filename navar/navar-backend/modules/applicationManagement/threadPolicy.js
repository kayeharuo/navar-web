function hasNewerThreadVersion(applications,version){
 return applications.some(a=>Number(a.application_version)>Number(version))
}
function threadIsSuperseded(applications,application){
 return hasNewerThreadVersion(applications,application?.application_version)||applications.some(a=>Number(a.application_version)===Number(application?.application_version)&&Number(a.application_attempt||1)>Number(application?.application_attempt||1))
}
async function applicationThreads(db,application){
 const versions=await db.from('application').select('application_id').eq('mall_id',application.mall_id??application.mallId).eq('application_version',application.application_version??application.version)
 if(versions.error)throw versions.error
 const threads=await db.from('thread').select('*').in('application_id',(versions.data||[]).map(a=>a.application_id)).order('thread_id')
 if(threads.error)throw threads.error
 return threads
}
async function threadWriteState(db,actor,kind,id){
 const result=await db.rpc('thread_write_state',{p_actor:actor,p_kind:kind,p_id:id})
 if(result.error){const error=new Error(result.error.code==='42501'?'Access denied.':'Unable to check thread permissions.');error.statusCode=result.error.code==='42501'?403:409;throw error}
 return {...result.data,readOnly:result.data?.readOnly!==false}
}
module.exports={hasNewerThreadVersion,threadIsSuperseded,threadWriteState,applicationThreads}
