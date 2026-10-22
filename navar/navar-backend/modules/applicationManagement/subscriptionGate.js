'use strict'

// One hand-off point for the future subscription implementation.
module.exports = function subscriptionGate(supabase) {
	return {
		async isOnboardingPaid(mallId) { // TODO(subscription): verify onboarding payment.
			return true
		},
		async isFirstSubscriptionPaid(mallId) { // TODO(subscription): verify first annual payment.
			return true
		},
		async isSubscriptionValid(mallId) { // TODO(subscription): active only; exclude grace and suspension.
			return true
		},
		async getMapUpdateAllowance(mallId) {
			// TODO(subscription): keep the contract snapshot when connecting subscription events.
			const result = await supabase.from('contract').select('contract_map_updates_per_year')
				.eq('mall_id', mallId).eq('contract_is_current', true).maybeSingle()
			if (result.error) throw result.error
			return result.data?.contract_map_updates_per_year ?? null
		},
	}
}
