'use strict'
const createGates = require('./subscriptionGate')
const LIVE_STATUSES = ['live', 'published'] // Existing stall behavior is unchanged.
const lower = value => String(value || '').toLowerCase()
async function getVersionEligibility(supabase, mallId) {
 const gates = createGates(supabase)
 const applications = await supabase.from('application').select('*').eq('mall_id', mallId)
  .order('application_version', { ascending: false }).order('application_attempt', { ascending: false })
 if (applications.error) throw applications.error
 const rows = applications.data || []
 if (!rows.length) { const paid = await gates.isOnboardingPaid(mallId); return { allowed: paid, latestVersion: 0, nextVersion: 1, attempt: 1, reason: paid ? '' : 'Onboarding payment is required.' } }
 const ids = rows.map(a => a.application_id)
 const developments = await supabase.from('ar_development').select('*').in('application_id', ids).order('ar_development_version', { ascending: false })
 if (developments.error) throw developments.error
 const latestAR = developments.data?.[0]
 const latest = rows[0]
 const retry = ['rejected', 'rejected_final'].includes(latest.application_status) && !latest.application_accepted_at
 const base = { latestVersion: latest.application_version, nextVersion: retry ? latest.application_version : latest.application_version + 1, attempt: retry ? latest.application_attempt + 1 : 1 }
 const blocked = reason => ({ ...base, allowed: false, reason })
 if (!await gates.isSubscriptionValid(mallId)) return blocked('An active subscription is required. Grace and suspended subscriptions cannot request a new version.')
 if (!latestAR || latestAR.ar_development_status !== 'live') return blocked('The latest AR must be Live before requesting a new version.')
 const eligibleAt = new Date(new Date(latestAR.ar_development_activated_at).getTime() + 45 * 86400000)
 if (!latestAR.ar_development_activated_at || Date.now() < eligibleAt.getTime()) return { ...blocked('You can request a new version on ' + (Number.isNaN(eligibleAt.getTime()) ? 'a date established after publishing' : eligibleAt.toLocaleDateString('en-GB', { timeZone: 'Asia/Manila' })) + '.'), eligibleAt: Number.isNaN(eligibleAt.getTime()) ? null : eligibleAt.toISOString() }
 const allowance = await gates.getMapUpdateAllowance(mallId)
 if (allowance !== null) {
  const contract = await supabase.from('contract').select('contract_start,contract_end').eq('mall_id', mallId).eq('contract_is_current', true).single()
  if (contract.error) throw contract.error
  if (!contract.data.contract_start || !contract.data.contract_end) return blocked('The current contract term must be set before checking map updates.')
  const used = rows.filter(a => a.application_version > 1 && a.application_accepted_at && new Date(a.application_accepted_at) >= new Date(contract.data.contract_start) && new Date(a.application_accepted_at) < new Date(contract.data.contract_end)).length
  if (used >= allowance) return blocked('No map updates left in the current contract term.')
 }
 if (rows.some(a => ['pending','disputed','submitted','for_revision','draft'].includes(a.application_status) || (a.application_status === 'approved' && !(developments.data || []).some(d => d.application_id === a.application_id && ['live','unpublished'].includes(d.ar_development_status))))) return blocked('Another request or version is already in progress.')
 return { ...base, allowed: true, reason: '' }
}

// Stall applications are only for malls whose AR is already live.
async function getStallEligibility(supabase, mallId) {
	const applications = await supabase.from('application').select('application_id').eq('mall_id', mallId)
	if (applications.error) throw applications.error
	const ids = (applications.data || []).map(item => item.application_id)
	if (!ids.length) return { allowed: false, reason: 'This mall has no AR development yet.' }
	const developments = await supabase.from('ar_development').select('ar_development_status').in('application_id', ids)
	if (developments.error) throw developments.error
	const allowed = (developments.data || []).some(item => LIVE_STATUSES.includes(lower(item.ar_development_status)))
	return { allowed, reason: allowed ? '' : 'Stall applications can only be submitted once the mall\'s AR is live.' }
}

module.exports = { LIVE_STATUSES, getVersionEligibility, getStallEligibility }
