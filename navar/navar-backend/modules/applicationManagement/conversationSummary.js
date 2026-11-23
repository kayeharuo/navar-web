'use strict'
const isOwnMessage=(message,adminId)=>message.message_sender!=null && String(message.message_sender)===String(adminId)
function summarizeMessages(messages,adminId,lastRead=0){
 const ordered=[...messages].sort((a,b)=>Number(b.message_id)-Number(a.message_id))
 const incoming=ordered.filter(m=>!isOwnMessage(m,adminId))
 const unread=incoming.filter(m=>Number(m.message_id)>Number(lastRead))
 const latest=unread[0]||ordered[0]
 return {
  preview:latest ? `${isOwnMessage(latest,adminId)?'You: ':''}${latest.message_content||'Image attachment'}` : 'No messages yet.',
  time:latest?.message_sent_at,
  unread:unread.length>0,
  unreadCount:unread.length,
  latestMessageId:ordered[0]?.message_id||null,
 }
}
module.exports={summarizeMessages,isOwnMessage}
