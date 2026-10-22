'use strict'
const createGates = require('./subscriptionGate')

async function action(supabase, applicationId, actorId, name, text = '', target = null) {
	const result = await supabase.rpc('workflow_action', {
		p_id: applicationId, p_actor: actorId, p_action: name, p_text: text, p_target: target,
	})
	if (result.error) {
		const conflicts = {
			'Older versions are read-only': 'A newer application version or attempt exists. This version is read-only.',
			'Published versions are read-only': 'Live and Unpublished AR versions are read-only.',
			'AR transition not allowed': 'The AR status could not change. The application must be Approved, its latest AR must be in the expected stage, and mall approval must not already be recorded. Refresh and check the current statuses.',
			'Existing AR is not On Hold': 'The linked AR must be On Hold before this application can be approved again.',
			'Only submitted applications can be approved': 'The database still requires resubmission. Apply migration 24 to enable approval directly from For Revision.',
			'Only submitted or For Revision applications can be approved': 'Only Submitted or For Revision applications can be approved.',
			'Revision not allowed once AR has reached Ready': 'Revision requires an eligible application and a linked AR before Ready. An Approved application with a deleted AR cannot request revision.',
			'Approve the application and complete every profile, floor plan, scale, route and entry-point requirement before marking AR ready.': 'This AR cannot be marked Ready because its application requirements are incomplete. Complete the mall operating hours and every floor\'s accessibility route, emergency route, and entry points, then try again.',
		}
		const message = result.error.code === '42501' ? 'Access denied.' : conflicts[result.error.message]
		const error = new Error(message || 'The workflow action failed. Please ask the administrator to check the backend workflow log.', { cause: result.error })
		error.statusCode = result.error.code === '42501' ? 403 : result.error.code === 'P0001' ? 409 : 500
		error.workflowMessage = error.message
		throw error
	}
	return result.data
}

function createARService(supabase, gates = createGates(supabase)) {
	return {
		// Future payment/renewal code calls this after confirming a payment.
		async tryPublish(arDevelopmentId, actorId) {
			const development = await supabase.from('ar_development').select('*').eq('ar_development_id', arDevelopmentId).single()
			if (development.error) throw development.error
			const d = development.data
			if (d.ar_development_status === 'live') return { published: true }
			if (d.ar_development_status !== 'ready' || !d.ar_development_mall_approved_at) return { published: false }
			const application = await supabase.from('application').select('mall_id').eq('application_id', d.application_id).single()
			if (application.error) throw application.error
			const allowed = d.ar_development_version === 1
				? await gates.isFirstSubscriptionPaid(application.data.mall_id)
				: await gates.isSubscriptionValid(application.data.mall_id)
			if (!allowed) return { published: false, waiting: true }
			// With no initiating request, attribute publication to the verified mall approver in the audit log.
			if (!actorId) {
				const audit = await supabase.from('audit_log').select('audit_log_performed_by')
					.eq('mall_id', application.data.mall_id).eq('audit_log_action', 'mall_approve').like('audit_log_details', `%AR #${arDevelopmentId}`)
					.order('audit_log_performed_at', { ascending: false }).limit(1).maybeSingle()
				if (audit.error) throw audit.error
				actorId = audit.data?.audit_log_performed_by
				if (!actorId) throw new Error('A recorded mall approver is required to publish.')
			}
			await action(supabase, d.application_id, actorId, 'publish')
			return { published: true }
		},
	}
}

module.exports = createARService
module.exports.action = action
// Explicit export supports callers which keep the database dependency outside the factory.
module.exports.tryPublish = (supabase, arDevelopmentId, actorId) => createARService(supabase).tryPublish(arDevelopmentId, actorId)
