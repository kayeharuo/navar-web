// Explicitly requested demo records. No emails or account invitations are sent.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true })
const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('node:crypto')

async function main() {
 const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
 const emails=['miguel.santos.inquiry@example.com','isabella.reyes.inquiry@example.com']
 const existing=await db.from('inquiry').select('inquiry_id,inquiry_contact_email,inquiry_status').in('inquiry_contact_email',emails)
 if(existing.error) throw existing.error
 const tiers=await db.from('subscription_tier').select('s_tier_key').order('s_tier_id').limit(2)
 if(tiers.error) throw tiers.error
 const now=new Date().toISOString()
 const common={inquiry_mall_floor_count:3,inquiry_coverage_area:'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm',inquiry_created_at:now,inquiry_updated_at:now,mall_id:null}
 const records=[
  {...common,inquiry_email_token:randomUUID(),inquiry_mall_name:'Luntian Town Center',inquiry_mall_state:'Laguna',inquiry_mall_city:'Santa Rosa',inquiry_mall_zip_code:'4026',inquiry_mall_address:'Sample Commercial Avenue, Santa Rosa, Laguna',inquiry_contact_person:'Miguel Santos',inquiry_contact_job_title:'Mall Operations Manager',inquiry_contact_num:'+63 900 000 0001',inquiry_contact_email:emails[0],inquiry_interested_tier:tiers.data[0]?.s_tier_key || null,inquiry_status:'New',inquiry_mall_description:'We would like to learn how NavAR can help visitors locate stores and facilities across our three floors. Please share the onboarding requirements and available subscription options.'},
  {...common,inquiry_email_token:randomUUID(),inquiry_mall_name:'Hiraya Commercial Center',inquiry_mall_state:'Cebu',inquiry_mall_city:'Mandaue City',inquiry_mall_zip_code:'6014',inquiry_mall_address:'Sample Business Road, Mandaue City, Cebu',inquiry_contact_person:'Isabella Reyes',inquiry_contact_job_title:'Property Manager',inquiry_contact_num:'+63 900 000 0002',inquiry_contact_email:emails[1],inquiry_interested_tier:(tiers.data[1] || tiers.data[0])?.s_tier_key || null,inquiry_status:'In Progress',inquiry_mall_description:'We are interested in indoor navigation for our shopping center, including accessible routes and store directories. We would like to discuss floor plan requirements, implementation scheduling, and subscription pricing.'}
 ].filter(row=>!existing.data.some(saved=>saved.inquiry_contact_email===row.inquiry_contact_email))
 if(records.length) {
  const inserted=await db.from('inquiry').insert(records)
  if(inserted.error) throw inserted.error
 }
 const verified=await db.from('inquiry').select('inquiry_id,inquiry_mall_name,inquiry_contact_person,inquiry_status').in('inquiry_contact_email',emails).order('inquiry_id')
 if(verified.error) throw verified.error
 if(verified.data.length!==2) throw new Error('Expected exactly two example inquiries. Review records before rerunning.')
 console.log(JSON.stringify({inserted:records.length,records:verified.data},null,2))
}
main().catch(error=>{console.error('Inquiry seed failed:',error.code || '',error.message);process.exitCode=1})
