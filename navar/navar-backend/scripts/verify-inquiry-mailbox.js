require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true})
const {inboxClient}=require('../modules/inquiries/inbox')
async function main(){
 const client=inboxClient(process.env)
 try {
  await client.connect()
  const lock=await client.getMailboxLock('INBOX',{readOnly:true})
  lock.release()
  console.log('NavAR Gmail IMAP verified. No email sent, read, changed, or deleted.')
 } finally {await client.logout().catch(()=>client.close())}
}
main().catch(error=>{console.error('Mailbox verification failed:',error.code || (error.authenticationFailed?'IMAP_AUTH':'IMAP_CONNECTION'));process.exitCode=1})
