'use strict'

// One hand-off point for the future subscription implementation.
module.exports = function subscriptionGate(supabase) {
	return {
		async isOnboardingPaid(mallId) {
			const result = await supabase.from('contract_payment_request').select('request_id').eq('mall_id',mallId).eq('fee_type','onboarding').eq('status','paid').not('fulfilled_at','is',null).is('reconciliation_reason',null).limit(1)
			if(result.error) throw result.error
			return Boolean(result.data?.length)
		},
		async isFirstSubscriptionPaid(mallId) {
			const result=await supabase.from('contract_payment_request').select('request_id').eq('mall_id',mallId).eq('fee_type','subscription').eq('status','paid').is('reconciliation_reason',null).not('paymongo_payment_id','is',null).limit(1)
			if(result.error) throw result.error
			if (result.data?.length) return true
			const simulated = await supabase.rpc('has_simulated_subscription_payment', { p_mall: mallId })
			if (simulated.error) throw simulated.error
			return simulated.data === true
		},
		async isSubscriptionValid(mallId, { allowGrace = true } = {}) {
			const {subscriptionState}=require('../subscriptions/domain')
			const result=await supabase.from('contract').select('*').eq('mall_id',mallId).eq('contract_is_current',true).maybeSingle()
			if(result.error) throw result.error
			if(!result.data) return false
			const suspended=await supabase.from('suspension').select('*').eq('contract_id',result.data.contract_id).is('suspension_lifted_at',null).maybeSingle()
			if(suspended.error) throw suspended.error
			return (allowGrace ? ['Active','Grace Period'] : ['Active']).includes(subscriptionState(result.data,suspended.data).status)
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
