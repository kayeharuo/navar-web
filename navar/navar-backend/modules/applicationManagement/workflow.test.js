'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const Fastify = require('fastify')
const createGuards = require('../auth/authGuard')
const registerRoutes = require('./routes')
const registerMallRoutes = require('./mallWorkflowRoutes')
const createARService = require('./arService')
const { getVersionEligibility } = require('./versionRules')

test('workflow conflicts expose only known messages and retain diagnostic causes', async () => {
	const known = database({}, { data: null, error: { code: 'P0001', message: 'Older versions are read-only' } })
	await assert.rejects(createARService.action(known, 4, 7, 'ar_status', '', 'ready'), error => {
		assert.equal(error.statusCode, 409)
		assert.match(error.workflowMessage, /newer application/)
		assert.equal(error.cause.message, 'Older versions are read-only')
		return true
	})
	const unknown = database({}, { data: null, error: { code: 'P0001', message: 'private database details' } })
	await assert.rejects(createARService.action(unknown, 4, 7, 'ar_status', '', 'ready'), error => {
		assert.doesNotMatch(error.workflowMessage, /private database details/)
		assert.equal(error.cause.message, 'private database details')
		return true
	})
	const requirements = database({}, { data: null, error: { code: 'P0001', message: 'Approve the application and complete every profile, floor plan, scale, route and entry-point requirement before marking AR ready.' } })
	await assert.rejects(createARService.action(requirements, 4, 7, 'ar_status', '', 'ready'), error => {
		assert.match(error.workflowMessage, /operating hours/)
		assert.doesNotMatch(error.workflowMessage, /Something went wrong/)
		return true
	})
})

function database(rows = {}, rpcResult = { data: {}, error: null }) {
	const calls = []
	return {
		calls,
		auth: { getUser: async token => ({ data: { user: token === 'valid-token' ? { id: 'verified-user' } : null } }) },
		from(table) {
			const filters = []
			const query = new Proxy({}, { get(_, method) {
				if (method === 'then') return (resolve, reject) => {
					let data = rows[table] || []
					for (const [column, value] of filters) data = data.filter(row => String(row[column]) === String(value))
					return Promise.resolve({ data, error: null }).then(resolve, reject)
				}
				if (method === 'single' || method === 'maybeSingle') return async () => {
					let data = rows[table] || []
					for (const [column, value] of filters) data = data.filter(row => String(row[column]) === String(value))
					return { data: data[0] || null, error: null }
				}
				return (...args) => { if (method === 'eq') filters.push(args); return query }
			} })
			return query
		},
		async rpc(name, args) { calls.push({ name, args }); return rpcResult },
	}
}

const admin = role => ({ admin_id: 7, admin_auth_user_id: 'verified-user', admin_role: role, mall_id: 1, admin_is_deactivated: false, admin_account_status: 'official' })
async function server(db, mall = false) {
	const app = Fastify()
	app.decorate('supabase', db)
	const guards = createGuards(db)
	app.addHook('preHandler', guards.requireAuth())
	if (mall) registerMallRoutes(app)
	else { app.addHook('preHandler', guards.requireSuperAdmin); registerRoutes(app) }
	await app.ready()
	return app
}

test('workflow routes require verified identity and super-admin role', async () => {
	const db = database({ admin: [admin('mall_admin')] })
	const app = await server(db)
	for (const path of ['/api/applications/1/approve', '/api/ar-developments/1/mark-ready']) {
		assert.equal((await app.inject({ method: 'POST', url: path, payload: {} })).statusCode, 401)
		assert.equal((await app.inject({ method: 'POST', url: path, headers: { authorization: 'Bearer valid-token' }, payload: {} })).statusCode, 403)
	}
	assert.equal(db.calls.length, 0)
	await app.close()
})

test('mall cannot approve another mall application', async () => {
	const db = database({ admin: [admin('mall_admin')], application: [{ application_id: 4, mall_id: 2 }] })
	const app = await server(db, true)
	const result = await app.inject({ method: 'POST', url: '/api/mall/applications/4/mall_approve', headers: { authorization: 'Bearer valid-token' }, payload: { acknowledged: true } })
	assert.equal(result.statusCode, 404)
	assert.equal(db.calls.length, 0)
	await app.close()
})

test('malformed IDs, missing rejection explanation and forward Change Status are refused', async () => {
	const db = database({ admin: [admin('super_admin')], ar_development: [{ ar_development_id: 3, application_id: 4, ar_development_status: 'node_mapping' }] })
	const app = await server(db)
	const headers = { authorization: 'Bearer valid-token' }
	assert.equal((await app.inject({ method: 'POST', url: '/api/applications/no/approve', headers, payload: {} })).statusCode, 400)
	assert.equal((await app.inject({ method: 'POST', url: '/api/applications/4/reject', headers, payload: {} })).statusCode, 400)
	assert.equal((await app.inject({ method: 'POST', url: '/api/ar-developments/3/change-status', headers, payload: { target: 'testing' } })).statusCode, 409)
	assert.equal((await app.inject({ method: 'POST', url: '/api/applications/4/thread', headers, payload: { content: 'x'.repeat(10001) } })).statusCode, 400)
	assert.equal(db.calls.length, 0)
	await app.close()
})

test('application approval calls the transaction with the verified actor', async () => {
	const db = database({ admin: [admin('super_admin')] })
	const app = await server(db)
	const result = await app.inject({ method: 'POST', url: '/api/applications/4/approve', headers: { authorization: 'Bearer valid-token' } })
	assert.equal(result.statusCode, 200, result.body)
	assert.deepEqual(db.calls[0].args, { p_id: 4, p_actor: 7, p_action: 'approve', p_text: '', p_target: null })
	await app.close()
})

test('tryPublish requires recorded approval and is idempotent for Live', async () => {
	for (const [status, approved] of [['ready', null], ['live', '2026-01-01']]) {
		const db = database({ ar_development: [{ ar_development_id: 3, ar_development_status: status, ar_development_mall_approved_at: approved }] })
		assert.equal((await createARService(db).tryPublish(3, 7)).published, status === 'live')
		assert.equal(db.calls.length, 0)
	}
})

test('approved Ready v2 calls publish through its subscription gate', async () => {
	const db = database({ ar_development: [{ ar_development_id: 3, application_id: 4, ar_development_version: 2, ar_development_status: 'ready', ar_development_mall_approved_at: '2026-01-01' }], application: [{ application_id: 4, mall_id: 1 }] })
	assert.equal((await createARService(db).tryPublish(3, 7)).published, true)
	assert.equal(db.calls[0].args.p_action, 'publish')
})

test('previously published but now Unpublished does not qualify for a new version', async () => {
	const db = database({ application: [{ application_id: 4, application_version: 1, mall_id: 1 }], ar_development: [{ application_id: 4, ar_development_status: 'unpublished', ar_development_activated_at: '2020-01-01' }] })
	const result = await getVersionEligibility(db, 1)
	assert.equal(result.allowed, false)
	assert.match(result.reason, /must be Live/)
})

test('unpaid v1 and invalid v2 subscription leave approved Ready waiting', async () => {
	for (const version of [1, 2]) {
		const db = database({ ar_development: [{ ar_development_id: 3, application_id: 4, ar_development_version: version, ar_development_status: 'ready', ar_development_mall_approved_at: '2026-01-01' }], application: [{ application_id: 4, mall_id: 1 }] })
		const gates = { isFirstSubscriptionPaid: async () => false, isSubscriptionValid: async () => false }
		assert.deepEqual(await createARService(db, gates).tryPublish(3, 7), { published: false, waiting: true })
		assert.equal(db.calls.length, 0)
	}
})

test('new attempt reuses the provisional version after rejection, but observes cooldown', async () => {
	const rows = { application: [{ application_id: 8, mall_id: 1, application_version: 2, application_attempt: 2, application_status: 'rejected_final' }, { application_id: 4, mall_id: 1, application_version: 1, application_status: 'approved' }], ar_development: [{ application_id: 4, ar_development_version: 1, ar_development_status: 'live', ar_development_activated_at: '2020-01-01' }] }
	const eligible = await getVersionEligibility(database(rows), 1)
	assert.equal(eligible.allowed, true)
	assert.equal(eligible.nextVersion, 2)
	assert.equal(eligible.attempt, 3)
	rows.ar_development[0].ar_development_activated_at = new Date().toISOString()
	assert.equal((await getVersionEligibility(database(rows), 1)).allowed, false)
})
