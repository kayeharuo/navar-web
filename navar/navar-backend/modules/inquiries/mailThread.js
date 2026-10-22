const uuidPattern='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
function sharedInbox(env) {
 const email=String(env.SMTP_USER || '').trim().toLowerCase()
 if (!/^[a-z0-9._%+-]+@(gmail\.com|googlemail\.com)$/.test(email)) throw new Error('Configure the shared NavAR Gmail in SMTP_USER.')
 return email
}
function outgoingThread(env,requestId) {
 if (!new RegExp(`^${uuidPattern}$`,'i').test(requestId || '')) throw new Error('Missing inquiry email reference')
 const [local,domain]=sharedInbox(env).split('@')
 return {replyTo:`${local.split('+')[0]}+inq.${requestId}@${domain}`,messageId:`<navar-inquiry.${requestId}@navar.mail>`}
}
function replyTokens(mail,mailbox) {
 const tokens=new Set()
 const refs=[mail.inReplyTo,...(Array.isArray(mail.references)?mail.references:[mail.references])].filter(Boolean).join(' ')
 for (const match of refs.matchAll(new RegExp(`<navar-inquiry\.(${uuidPattern})@navar\.mail>`,'gi'))) tokens.add(match[1].toLowerCase())
 const [local,domain]=mailbox.toLowerCase().split('@')
 const base=local.split('+')[0]
 const recipients=[...(mail.to?.value || []),...(mail.cc?.value || [])]
 for(const recipient of recipients) {
  const address=String(recipient.address || '').toLowerCase()
  const prefix=`${base}+inq.`
  if(address.startsWith(prefix) && address.endsWith(`@${domain}`)) {
   const token=address.slice(prefix.length,-domain.length-1)
   if(new RegExp(`^${uuidPattern}$`,'i').test(token)) tokens.add(token)
  }
 }
 return [...tokens]
}
function authenticatedSender(mail,sender) {
 // Gmail prepends its Authentication-Results. Do not trust later copied headers.
 const header=mail.headerLines?.find(h=>h.key.toLowerCase()==='authentication-results')?.line || ''
 const value=header.replace(/\r?\n\s+/g,' ')
 if(!/^Authentication-Results:\s*mx\.google\.com\s*;/i.test(value) || !/\bdmarc=pass\b/i.test(value)) return false
 const domain=sender.toLowerCase().split('@')[1]
 const from=value.match(/\bheader\.from\s*=\s*"?([a-z0-9.-]+)/i)?.[1]?.toLowerCase()
 return domain===from
}
function replyBody(text) {
 // Keep plain text only; remove common Gmail/Outlook quoted-history delimiters.
 const rows=String(text || '').replace(/\r\n/g,'\n').split('\n')
 const end=rows.findIndex((line,index)=>/^\s*>/.test(line) || /^On .{1,500}wrote:\s*$/i.test(line) || /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i.test(line) || (index>0 && /^From:\s+.+/i.test(line) && rows.slice(index+1,index+5).some(l=>/^Sent:|^Date:/i.test(l))))
 return (end<0?rows:rows.slice(0,end)).join('\n').replace(/\u0000/g,'').trim()
}
module.exports={sharedInbox,outgoingThread,replyTokens,authenticatedSender,replyBody}
