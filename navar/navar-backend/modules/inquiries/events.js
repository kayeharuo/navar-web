// Auth is enforced by the parent Super Admin plugin before opening this stream.
function createInquiryEvents() {
 const clients=new Set()
 return {
  open(request,reply) {
   if(clients.size>=100)return reply.code(503).send({message:'Too many live inquiry connections.'})
   reply.hijack()
   const response=reply.raw
   response.writeHead(200,{...reply.getHeaders(),'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'})
   const send=data=>{
    if(response.destroyed)return
    if(!response.write(`data: ${JSON.stringify(data)}\n\n`))response.end()
   }
   const client={send,close:()=>response.end()}
   clients.add(client)
   send({type:'connected'})
   const heartbeat=setInterval(()=>send({type:'heartbeat'}),15000)
   // Reconnect through the auth guard regularly, including after access revocation.
   const expiry=setTimeout(()=>response.end(),60000)
   const cleanup=()=>{clearInterval(heartbeat);clearTimeout(expiry);clients.delete(client)}
   response.once('close',cleanup)
   request.raw.once('aborted',client.close)
  },
  publish(inquiryId){for(const client of clients)client.send({type:'inquiry_changed',inquiryId})},
  close(){for(const client of clients)client.close();clients.clear()},
 }
}
module.exports={createInquiryEvents}
