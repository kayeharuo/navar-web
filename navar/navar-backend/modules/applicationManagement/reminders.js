'use strict'
const {sendQueued}=require('../emailDelivery/service')
async function runReadyReminders(supabase) {
 const claimed=await supabase.rpc('claim_ready_reminders')
 if(claimed.error)throw claimed.error
 return {reminders:claimed.data,...await sendQueued(supabase)}
}
module.exports={runReadyReminders}
