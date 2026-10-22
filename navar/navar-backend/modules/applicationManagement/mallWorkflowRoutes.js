'use strict'
// API hand-off for the separate mall portal. This repository adds no mall screens.
const createARService = require('./arService')
const { action } = createARService
const { getVersionEligibility } = require('./versionRules')

module.exports = function mallWorkflowRoutes(app) {
	app.addHook('preHandler', async (request, reply) => {
		if (request.admin?.role !== 'mall_admin' || !request.admin.mallId) return reply.code(403).send({ message: 'Access denied.' })
	})
	app.get('/api/mall/workflow/eligibility', request => getVersionEligibility(app.supabase, request.admin.mallId))
	for (const name of ['dispute', 'resubmit', 'mall_approve']) {
		app.post(`/api/mall/applications/:id/${name}`, { schema: {
			params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
			body: { type: 'object', additionalProperties: false, properties: { notes: { type: 'string', maxLength: 10000 }, acknowledged: { type: 'boolean' } } },
		} }, async (request, reply) => {
			const a = await app.supabase.from('application').select('mall_id').eq('application_id', request.params.id).maybeSingle()
			if (a.error) throw a.error
			if (!a.data || String(a.data.mall_id) !== String(request.admin.mallId)) return reply.code(404).send({ message: 'Application not found.' })
			if (name === 'mall_approve' && request.body?.acknowledged !== true) return reply.code(400).send({ message: 'Confirm that you carefully reviewed the AR before approving.' })
			const result = await action(app.supabase, request.params.id, request.admin.id, name, name === 'mall_approve' ? 'acknowledged' : request.body?.notes || '')
			if (name === 'mall_approve') return createARService(app.supabase).tryPublish(result.arDevelopmentId, request.admin.id)
			return result
		})
	}
}
