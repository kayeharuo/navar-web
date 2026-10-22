// inquiry_message is the durable queue. The delivery function atomically claims
// pending rows, so overlapping workers cannot send the same message twice.
function createOutbox({listPending,send,log,intervalMs=5000}) {
 let running,timer,stopped=false,again=false
 async function drain(){
  do {
   again=false
   const rows=await listPending()
   for(const row of rows){
    if(stopped)break
    try {await send(row)}
    catch(error){log.warn({messageId:row.i_message_id,code:error.code || 'OUTBOX_SEND'},'Inquiry outbox attempt failed')}
   }
  } while(again && !stopped)
 }
 function kick(){
  if(stopped)return Promise.resolve()
  if(running){again=true;return running}
  running=drain().catch(error=>log.warn({code:error.code || 'OUTBOX_READ'},'Inquiry outbox unavailable')).finally(()=>{running=null})
  return running
 }
 return {kick,start(){stopped=false;timer=setInterval(kick,intervalMs);timer.unref();void kick()},
  async stop(){stopped=true;clearInterval(timer);await running}}
}
module.exports={createOutbox}
