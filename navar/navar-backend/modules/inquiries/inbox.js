const {ImapFlow}=require('imapflow')
const {simpleParser}=require('mailparser')
const {sharedInbox,replyTokens,authenticatedSender,replyBody}=require('./mailThread')
const check=result=>{if(result.error)throw result.error;return result.data}
function inboxClient(env) {
 const user=sharedInbox(env)
 if(!env.SMTP_PASS) throw new Error('Configure the shared Gmail App Password in SMTP_PASS.')
 const client=new ImapFlow({host:'imap.gmail.com',port:993,secure:true,auth:{user,pass:env.SMTP_PASS},
  logger:false,disableAutoIdle:false,maxIdleTime:25000,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:60000})
 // Errors are reported by the poll/verification caller; never log raw messages or credentials.
 client.on('error',()=>{})
 return client
}
function createInboxSync({db,env,log,clientFactory=inboxClient,onImport=()=>{}}) {
 let timer,running,stopped=false,activeClient
 const state={enabled:env.INQUIRY_INBOX_ENABLED==='true',lastCheckedAt:null,lastImportedAt:null,error:null}
 async function scan() {
  const mailbox=sharedInbox(env)
  // Check migration before opening the mailbox.
  const saved=check(await db.from('inquiry_inbox_cursor').select('uid_validity,last_uid').eq('mailbox',mailbox).maybeSingle())
  let client=activeClient
  if(!client?.usable) {
   client?.close()
   client=clientFactory(env);activeClient=client
   // Gmail's EXISTS notification wakes the worker instead of waiting for polling.
   client.on?.('exists',()=>{if(!running && !stopped)setImmediate(()=>{void poll()})})
  }
  let lock
  try {
   if(!client.usable)await client.connect()
   lock=await client.getMailboxLock('INBOX',{readOnly:true})
   const mailboxStatus=await client.status('INBOX',{uidNext:true,uidValidity:true})
   const validity=String(mailboxStatus.uidValidity)
   const highest=Number(mailboxStatus.uidNext)-1
   let cursor=saved?.uid_validity===validity?Number(saved.last_uid):Math.max(0,highest-500)
   const saveCursor=async uid=>check(await db.from('inquiry_inbox_cursor').upsert({mailbox,uid_validity:validity,last_uid:uid,updated_at:new Date().toISOString()},{onConflict:'mailbox'}))
   if(cursor<highest) {
    const uids=(await client.search({uid:`${cursor+1}:${highest}`},{uid:true})).filter(uid=>uid>cursor && uid<=highest).sort((a,b)=>a-b).slice(0,50)
    for(const uid of uids) {
     if(stopped) break
     const meta=await client.fetchOne(uid,{headers:true,size:true,internalDate:true},{uid:true})
     let reason='unrelated'
     if(meta) {
      const header=await simpleParser(meta.headers,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true})
      const tokens=replyTokens(header,mailbox)
      if(tokens.length) {
       const senders=header.from?.value || []
       const sender=String(senders[0]?.address || '').toLowerCase()
       const automated=header.headers.get('auto-submitted')
       if(senders.length!==1 || !authenticatedSender(header,sender)) reason='sender_authentication_failed'
       else if(automated && String(automated).toLowerCase()!=='no') reason='automatic_reply'
       else if(meta.size>10*1024*1024) reason='message_over_10mb'
       else {
        const refs=check(await db.from('inquiry_message').select('inquiry_id,i_message_request_id').in('i_message_request_id',tokens).in('i_message_sender_type',['admin','super_admin']))
        if(new Set(refs.map(r=>r.inquiry_id)).size===1) {
         const full=await client.fetchOne(uid,{source:true},{uid:true})
         if(!full?.source) throw new Error('Incoming email source unavailable')
         const mail=await simpleParser(full.source,{skipTextToHtml:true,skipImageLinks:true,maxHtmlLengthToParse:1024*1024})
         const body=replyBody(mail.text)
         if(!body || body.length>20000 || !mail.messageId || mail.messageId.length>998) reason='unsupported_message_content'
         else {
          const result=check(await db.rpc('import_inquiry_email',{p_request:refs[0].i_message_request_id,p_email_id:mail.messageId,
           p_sender:sender,p_body:body,p_received_at:new Date(meta.internalDate).toISOString()}))
          reason=result.imported?'imported':result.reason || 'duplicate'
          if(result.imported) {state.lastImportedAt=new Date().toISOString();onImport(result.inquiry_id)}
         }
        } else reason='unmatched_or_ambiguous_thread'
       }
       if(!['imported','duplicate'].includes(reason))log.warn({uid,reason},'Inquiry email not imported; retained in Gmail')
      }
     }
     // Advance only after successful processing. Database/connection errors retry on next scan.
     await saveCursor(uid);cursor=uid
    }
    if(!uids.length)await saveCursor(highest)
   } else if(!saved || saved.uid_validity!==validity) await saveCursor(cursor)
   state.lastCheckedAt=new Date().toISOString();state.error=null
  } catch(error) {
   client.close();activeClient=null
   throw error
  } finally {
   lock?.release()
  }
 }
 function poll() {
  if(running || stopped || !state.enabled)return running
  running=scan().catch(error=>{
   state.error=['42P01','42703','PGRST202','PGRST205'].includes(error.code)
    ? 'Apply inquiry inbox migration 22 to enable incoming replies.'
    : 'Inbox synchronization failed. Check the shared Gmail credentials and backend connection.'
   log.warn({code:error.code || (error.authenticationFailed?'IMAP_AUTH':'INBOX_SYNC')},state.error)
  }).finally(()=>{running=null})
  return running
 }
 return {state,poll,start(){if(!state.enabled)return;stopped=false;timer=setInterval(poll,3000);timer.unref();void poll()},
  async stop(){stopped=true;clearInterval(timer);activeClient?.close();await running}}
}
module.exports={createInboxSync,inboxClient}
