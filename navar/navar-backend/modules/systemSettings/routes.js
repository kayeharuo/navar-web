const { recordAudit } = require('../auditLog/routes')

const { randomUUID } = require('node:crypto')
const { currentRateCard, validateRates } = require('./rateCard')

const tierKeys = ['basic', 'standard', 'premium']
const money = value => {
	const text = String(value ?? '').trim().replace(/^₱\s*/, '').replace(/,/g, '').replace(/\s*(days|%|each|per floor)$/i, '').trim()
	return /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : NaN
}
const integer = value => Number.isInteger(money(value)) ? money(value) : NaN
const percentage = value => money(value) / 100
const peso = value => `₱${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

function displayValues(rows) {
	const byKey = new Map(rows.map(row => [row.s_tier_key, row]))
	const values = {}
	const field = (key, mapper) => Object.fromEntries(tierKeys.map(tierKey => [tierKey, mapper(byKey.get(tierKey), tierKey)]))
	values.annualFee = field('annualFee', row => peso(row.s_tier_annual_fee))
	values.gracePeriod = field('gracePeriod', row => `${row.s_tier_grace_period_days} days`)
	values.reinstatementFee = field('reinstatementFee', row => `${Number(row.s_tier_reinstatement_rate) * 100}%`)
	values.adminAccounts = field('adminAccounts', row => String(row.s_tier_max_admin_account))
	values.analyticsHistory = field('analyticsHistory', row => row.s_tier_analytics_level.replace(' history', '').replace('Full', 'Full'))
	values.analyticsTools = field('analyticsTools', row => row.s_tier_analytics_tools)
	values.mapQueue = field('mapQueue', row => row.s_tier_ar_priority)
	values.remoteResponse = field('remoteResponse', row => row.s_tier_remote_response_sla)
	values.onsiteDispatch = field('onsiteDispatch', row => row.s_tier_onsite_dispatch_sla)
	values.includedVisits = field('includedVisits', row => String(row.s_tier_included_onsite_visits))
	values.extraVisit = field('extraVisit', row => peso(row.s_tier_extra_onsite_visit_fee))
	values.beaconReplacement = field('beaconReplacement', row => `${peso(row.s_tier_beacon_replacement_fee)} each`)
	values.extraStall = field('extraStall', row => peso(row.s_tier_additional_stall_fee))
	values.freeStalls = field('freeStalls', row => String(row.s_tier_free_extra_stalls_per_year))
	values.freeMapUpdates = field('freeMapUpdates', row => String(row.s_tier_map_updates_per_year))
	values.paidMapUpdate = field('paidMapUpdate', row => `${Number(row.s_tier_map_update_rate) * 100}%`)
	return values
}

module.exports = function registerSystemSettingsRoutes(app) {
	app.get('/api/system-settings/subscription-tiers', async (_request, reply) => {
		const result = await app.supabase.from('subscription_tier').select('*').in('s_tier_key', tierKeys)
		if (result.error) return reply.code(500).send({ message: 'Unable to load subscription tiers.' })
		if (result.data?.length !== tierKeys.length) return reply.code(500).send({ message: 'Subscription tier configuration is incomplete.' })
    return { values: displayValues(result.data), rateCard: await currentRateCard(app.supabase) }
	})

	app.put('/api/system-settings/subscription-tiers', async (request, reply) => {
		const values = request.body?.values
		if (!values) return reply.code(400).send({ message: 'Subscription tier values are required.' })
    let rates
    if (request.body.onboardingRates) {
      try { rates = validateRates(request.body.onboardingRates) }
      catch (error) { return reply.code(400).send({ message: error.message }) }
      if (!request.body.rateVersion) return reply.code(400).send({ message: 'Reload pricing before saving changes.' })
    }
		const updates = []
		for (const key of tierKeys) {
			const annualFee = money(values.annualFee?.[key])
			const graceDays = integer(values.gracePeriod?.[key])
			const reinstatementRate = percentage(values.reinstatementFee?.[key])
			const adminAccounts = integer(values.adminAccounts?.[key])
			const includedVisits = integer(values.includedVisits?.[key])
			const extraVisitFee = money(values.extraVisit?.[key])
			const replacementFee = money(values.beaconReplacement?.[key])
			const extraStallFee = money(values.extraStall?.[key])
			const freeExtraStalls = integer(values.freeStalls?.[key])
			const freeMapUpdates = integer(values.freeMapUpdates?.[key])
			const mapUpdateRate = percentage(values.paidMapUpdate?.[key])
			const analyticsHistory = String(values.analyticsHistory?.[key] || '').trim()
			const textValues = ['analyticsTools', 'mapQueue', 'remoteResponse', 'onsiteDispatch'].map(field => String(values[field]?.[key] || '').trim())
			if (![annualFee, graceDays, reinstatementRate, adminAccounts, includedVisits, extraVisitFee, replacementFee, extraStallFee, freeExtraStalls, freeMapUpdates, mapUpdateRate].every(Number.isFinite) || annualFee <= 0 || graceDays < 0 || reinstatementRate < 0 || reinstatementRate > 1 || mapUpdateRate <= 0 || mapUpdateRate > 1 || adminAccounts < 1 || includedVisits < 0) {
				return reply.code(400).send({ message: `Check the numeric values entered for the ${key} tier.` })
			}
			if (!analyticsHistory || textValues.some(value => !value)) return reply.code(400).send({ message: `Complete every ${key} tier feature.` })
			const update = {
				s_tier_key: key,
				s_tier_annual_fee: annualFee,
				s_tier_grace_period_days: graceDays,
				s_tier_reinstatement_rate: reinstatementRate,
				s_tier_max_admin_account: adminAccounts,
				s_tier_analytics_level: /history$/i.test(analyticsHistory) ? analyticsHistory : `${analyticsHistory} history`,
				s_tier_analytics_tools: values.analyticsTools[key],
				s_tier_ar_priority: values.mapQueue[key],
				s_tier_remote_response_sla: values.remoteResponse[key],
				s_tier_onsite_dispatch_sla: values.onsiteDispatch[key],
				s_tier_included_onsite_visits: includedVisits,
				s_tier_extra_onsite_visit_fee: extraVisitFee,
				s_tier_beacon_replacement_fee: replacementFee,
				s_tier_additional_stall_fee: extraStallFee,
				s_tier_free_extra_stalls_per_year: freeExtraStalls,
				included_visits_per_year: includedVisits,
				free_stalls_per_year: freeExtraStalls,
				s_tier_map_updates_per_year: freeMapUpdates,
				s_tier_map_update_rate: mapUpdateRate,
				s_tier_map_update_fee_per_floor: 0,
				s_tier_map_update_pricing: `${freeMapUpdates ? `First ${freeMapUpdates} update(s) each year free (up to one floor each), then ` : ""}${Number((mapUpdateRate*100).toFixed(2))}% of original onboarding cost per floor`,
				s_tier_updated_at: new Date().toISOString(),
			}
			updates.push(update)
		}
    const result = rates
      ? await app.supabase.rpc('save_system_pricing', { p_updates: updates, p_rates: rates, p_expected_version: request.body.rateVersion, p_version: 'rates-' + randomUUID() })
      : await app.supabase.rpc('save_system_subscription_tiers', { p_updates: updates })
    if (result.error) return reply.code(result.error.code === '40001' ? 409 : 400).send({ message: result.error.code === '40001' ? 'Pricing changed. Reload this page before saving again.' : 'Unable to save pricing. No rates or tiers were changed.' })
		await recordAudit(app.supabase, request, { module: 'subscription_management', action: 'updated_subscription_tiers', targetType: 'subscription_tier', targetName: 'Subscription tiers', details: 'Updated subscription tier pricing and features.' })
		const saved = await app.supabase.from('subscription_tier').select('*').in('s_tier_key', tierKeys)
		if (saved.error) return reply.code(500).send({ message: 'Subscription tiers were saved but could not be reloaded.' })
    return { values: displayValues(saved.data || []), rateCard: await currentRateCard(app.supabase) }
	})
}
