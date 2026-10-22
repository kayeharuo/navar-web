'use strict'

// AR statuses that count as "has been published" for the next-version rule.
// 'unpublished' means it was live once, so it still qualifies.
const PUBLISHED_STATUSES = ['live', 'published', 'unpublished']
// AR statuses that count as "currently live" for the stall-application rule.
const LIVE_STATUSES = ['live', 'published']

const lower = value => String(value || '').toLowerCase()

function hasBeenPublished(development) {
	return PUBLISHED_STATUSES.includes(lower(development.ar_development_status)) || Boolean(development.ar_development_activated_at)
}

// A mall may only submit a new application version once the AR development
// linked to its latest application is published, or has been published before.
async function getVersionEligibility(supabase, mallId) {
	const latest = await supabase.from('application').select('application_id, application_version')
		.eq('mall_id', mallId).order('application_version', { ascending: false }).limit(1)
	if (latest.error) throw latest.error
	if (!latest.data?.length) return { allowed: true, latestVersion: 0, nextVersion: 1, reason: '' }

	const { application_id: applicationId, application_version: latestVersion } = latest.data[0]
	const developments = await supabase.from('ar_development').select('ar_development_status, ar_development_activated_at').eq('application_id', applicationId)
	if (developments.error) throw developments.error
	const allowed = (developments.data || []).some(hasBeenPublished)
	return {
		allowed,
		latestVersion,
		nextVersion: latestVersion + 1,
		reason: allowed ? '' : `Version ${latestVersion} has not been published yet. A new version can be submitted once its AR development is published.`,
	}
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

module.exports = { PUBLISHED_STATUSES, LIVE_STATUSES, getVersionEligibility, getStallEligibility }