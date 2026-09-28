'use strict'

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const accountFields = 'admin_id, admin_role, admin_email, admin_full_name, admin_contact_num, admin_job_title, admin_is_primary, admin_account_status, admin_is_deactivated, admin_deactivated_on, admin_last_login, admin_created_at, admin_updated_at, admin_profile_picture'
const genericFailure = 'Something went wrong.'
const profilePicturePattern = '^data:image\\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$'
const passwordLinkBody = {
	type: 'object',
	additionalProperties: false,
	required: ['request_id'],
	properties: { request_id: { type: 'string', format: 'uuid' } },
}

function requestFingerprint(requestId) {
	return crypto.createHash('sha256').update(requestId).digest('hex')
}

function passwordLinkRedirect(path, requestId) {
	return `${process.env.APP_BASE_URL || process.env.FRONTEND_ORIGIN}${path}?request=${requestId}`
}

async function issuePasswordRequest(supabase, authUserId, kind, requestId) {
	return supabase.rpc('issue_admin_password_request', {
		p_auth_user_id: authUserId,
		p_request_fingerprint: requestFingerprint(requestId),
		p_request_kind: kind,
		p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
	})
}

function createPublishableClient() {
	const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
	if (!key) throw new Error('SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) must be set in .env')
	return createClient(process.env.SUPABASE_URL, key, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
	})
}

function accountResponse(row) {
	return {
		id: row.admin_id,
		role: row.admin_role,
		email: row.admin_email,
		name: row.admin_full_name,
		jobTitle: row.admin_job_title,
		contactNum: row.admin_contact_num,
		isPrimary: row.admin_is_primary,
		status: row.admin_account_status,
		isDeactivated: row.admin_is_deactivated,
		lastLogin: row.admin_last_login,
		deactivatedOn: row.admin_deactivated_on,
		createdAt: row.admin_created_at,
		updatedAt: row.admin_updated_at,
		profilePicture: row.admin_profile_picture || null,
	}
}

async function writeAudit(supabase, request, action, details) {
	const result = await supabase.from('audit_log').insert({
		audit_log_module: 'account_management',
		audit_log_action: action,
		audit_log_details: details,
		audit_log_performed_at: new Date().toISOString(),
		audit_log_performed_by: request.admin.id,
		audit_log_mall_id: request.admin.mallId,
	})
	if (result.error) request.log.error({ code: result.error.code }, 'Audit log write failed')
}

function registerAccountManagementRoutes(app, { supabase, requireAuth, requireSuperAdmin, requirePrimarySuperAdmin }) {
	const adminOnly = [requireAuth(), requireSuperAdmin]
	const primaryAdminOnly = [requireAuth(), requirePrimarySuperAdmin]
	const accountBody = {
		type: 'object',
		additionalProperties: false,
		required: ['email', 'name'],
		properties: {
			email: { type: 'string', format: 'email', maxLength: 100 },
			name: { type: 'string', minLength: 1, maxLength: 100 },
			job_title: { type: 'string', maxLength: 100 },
			contact_num: { type: 'string', pattern: '^[0-9]*$', maxLength: 20 },
		},
	}
	const editBody = {
		type: 'object',
		additionalProperties: false,
		minProperties: 1,
		properties: {
			name: { type: 'string', minLength: 1, maxLength: 100 },
			job_title: { type: 'string', maxLength: 100 },
			contact_num: { type: 'string', pattern: '^[0-9]*$', maxLength: 20 },
		},
	}
	const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } }

	app.get('/api/admin-accounts', { onRequest: adminOnly }, async (request, reply) => {
		const { data, error } = await supabase.from('admin').select(accountFields).order('admin_created_at', { ascending: false })
		if (error) {
			request.log.error({ code: error.code }, 'Admin account list failed')
			return reply.code(500).send({ message: genericFailure })
		}
		return data.map(accountResponse)
	})

	app.post('/api/admin-accounts', { onRequest: adminOnly, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { body: accountBody } }, async (request, reply) => {
		const email = request.body.email.trim().toLowerCase()
		const existing = await supabase.from('admin').select('admin_id').eq('admin_email', email).maybeSingle()
		if (existing.error) {
			request.log.error({ code: existing.error.code }, 'Admin account lookup failed')
			return reply.code(500).send({ message: genericFailure })
		}
		if (existing.data) return reply.code(400).send({ message: 'This account cannot be created.' })

		const requestId = crypto.randomUUID()
		const invited = await supabase.auth.admin.inviteUserByEmail(email, {
			redirectTo: passwordLinkRedirect('/auth/set-password', requestId),
		})
		if (invited.error || !invited.data?.user) {
			request.log.error({
				code: invited.error?.code,
				status: invited.error?.status,
				name: invited.error?.name,
				message: invited.error?.message,
			}, 'Admin invite failed at Supabase Auth')
			return reply.code(invited.error?.status >= 500 ? 503 : 400).send({ message: 'The invitation service is unavailable. Please try again later.' })
		}
		const requestRecord = await issuePasswordRequest(supabase, invited.data.user.id, 'invite', requestId)
		if (requestRecord.error) {
			request.log.error({ code: requestRecord.error.code }, 'Invite request record failed')
			await supabase.auth.admin.deleteUser(invited.data.user.id)
			return reply.code(400).send({ message: 'This account cannot be created.' })
		}

		const timestamp = new Date().toISOString()
		const inserted = await supabase.from('admin').insert({
			admin_role: 'super_admin',
			admin_email: email,
			admin_full_name: request.body.name.trim(),
			admin_contact_num: request.body.contact_num?.trim() || null,
			admin_job_title: request.body.job_title?.trim() || null,
			admin_is_primary: false,
			admin_is_deactivated: false,
			admin_deactivated_on: null,
			admin_last_login: null,
			admin_created_at: timestamp,
			admin_updated_at: timestamp,
			mall_id: null,
			store_id: null,
			admin_account_status: 'partial',
			admin_auth_user_id: invited.data.user.id,
		}).select(accountFields).single()
		if (inserted.error) {
			request.log.error({ code: inserted.error.code }, 'Admin profile insert failed')
			await supabase.auth.admin.deleteUser(invited.data.user.id)
			return reply.code(400).send({ message: 'This account cannot be created.' })
		}

		await writeAudit(supabase, request, 'admin_account_created', `Created admin account ${inserted.data.admin_id}`)
		return reply.code(201).send({ id: inserted.data.admin_id, name: inserted.data.admin_full_name, email: inserted.data.admin_email, status: 'pending' })
	})

	app.patch('/api/admin-accounts/:id', { onRequest: adminOnly, schema: { params: idParams, body: editBody } }, async (request, reply) => {
		const updates = { admin_updated_at: new Date().toISOString() }
		if (request.body.name !== undefined) updates.admin_full_name = request.body.name.trim()
		if (request.body.job_title !== undefined) updates.admin_job_title = request.body.job_title.trim() || null
		if (request.body.contact_num !== undefined) updates.admin_contact_num = request.body.contact_num.trim() || null
		const result = await supabase.from('admin').update(updates).eq('admin_id', request.params.id).eq('admin_role', 'super_admin').select(accountFields).single()
		if (result.error) {
			request.log.error({ code: result.error.code }, 'Admin profile update failed')
			return reply.code(result.error.code === 'PGRST116' ? 404 : 400).send({ message: genericFailure })
		}
		await writeAudit(supabase, request, 'admin_account_updated', `Updated admin account ${request.params.id}`)
		return accountResponse(result.data)
	})

	app.post('/api/admin-accounts/:id/resend-invite', { onRequest: primaryAdminOnly, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { params: idParams } }, async (request, reply) => {
		const target = await supabase.from('admin').select('admin_auth_user_id, admin_email').eq('admin_id', request.params.id).eq('admin_role', 'super_admin').eq('admin_account_status', 'partial').maybeSingle()
		if (target.error || !target.data) return reply.code(404).send({ message: genericFailure })
		const requestId = crypto.randomUUID()
		const result = await supabase.auth.admin.inviteUserByEmail(target.data.admin_email, { redirectTo: passwordLinkRedirect('/auth/set-password', requestId) })
		if (result.error) {
			request.log.error({ code: result.error.code }, 'Invite resend failed')
			return reply.code(400).send({ message: genericFailure })
		}
		const requestRecord = await issuePasswordRequest(supabase, target.data.admin_auth_user_id, 'invite', requestId)
		if (requestRecord.error) {
			request.log.error({ code: requestRecord.error.code }, 'Invite resend request record failed')
			return reply.code(400).send({ message: genericFailure })
		}
		return { message: 'Invitation sent' }
	})

	app.post('/api/admin-accounts/:id/reset-password', { onRequest: primaryAdminOnly, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { params: idParams } }, async (request, reply) => {
		const target = await supabase.from('admin').select('admin_auth_user_id, admin_email').eq('admin_id', request.params.id).eq('admin_role', 'super_admin').eq('admin_account_status', 'official').eq('admin_is_deactivated', false).maybeSingle()
		if (target.error || !target.data || String(target.data.admin_auth_user_id) === String(request.admin.authUserId)) return reply.code(400).send({ message: genericFailure })
		const requestId = crypto.randomUUID()
		const requestRecord = await issuePasswordRequest(supabase, target.data.admin_auth_user_id, 'reset', requestId)
		if (requestRecord.error) {
			request.log.error({ code: requestRecord.error.code }, 'Password reset request record failed')
			return reply.code(400).send({ message: genericFailure })
		}
		const result = await createPublishableClient().auth.resetPasswordForEmail(target.data.admin_email, { redirectTo: passwordLinkRedirect('/auth/reset-password', requestId) })
		if (result.error) {
			request.log.error({ code: result.error.code }, 'Password reset request failed')
			return reply.code(400).send({ message: genericFailure })
		}
		return { message: 'Reset email sent' }
	})

	app.post('/api/auth/password-link/validate', { preHandler: requireAuth({ allowPartial: true }), schema: { body: passwordLinkBody } }, async (request, reply) => {
		const valid = await supabase.rpc('validate_admin_password_request', {
			p_auth_user_id: request.admin.authUserId,
			p_request_fingerprint: requestFingerprint(request.body.request_id),
		})
		if (valid.error) return reply.code(400).send({ message: 'This link is invalid or expired.' })
		return { valid: valid.data === true }
	})

	app.post('/api/auth/password-link/claim', { preHandler: requireAuth({ allowPartial: true }), schema: { body: passwordLinkBody } }, async (request, reply) => {
		const claimed = await supabase.rpc('claim_admin_password_request', {
			p_auth_user_id: request.admin.authUserId,
			p_request_fingerprint: requestFingerprint(request.body.request_id),
		})
		if (claimed.error || !claimed.data) return reply.code(400).send({ message: 'This link is invalid or expired.' })
		return { kind: claimed.data }
	})

	app.post('/api/auth/password-link/complete', { preHandler: requireAuth({ allowPartial: true }), schema: { body: passwordLinkBody } }, async (request, reply) => {
		const requestRecord = await supabase.from('admin_password_request').select('request_kind').eq('request_fingerprint', requestFingerprint(request.body.request_id)).eq('auth_user_id', request.admin.authUserId).not('claimed_at', 'is', null).maybeSingle()
		if (requestRecord.error || !requestRecord.data) return reply.code(400).send({ message: genericFailure })
		if (requestRecord.data.request_kind === 'invite' && request.admin.status === 'partial') {
			if (!request.admin.usedPassword) return reply.code(400).send({ message: genericFailure })
			const completed = await supabase.from('admin').update({ admin_account_status: 'official', admin_last_login: new Date().toISOString(), admin_updated_at: new Date().toISOString() }).eq('admin_id', request.admin.id).eq('admin_account_status', 'partial').select('admin_id').maybeSingle()
			if (completed.error || !completed.data) return reply.code(400).send({ message: genericFailure })
		}
		return { message: 'Password updated' }
	})

	app.post('/api/admin-accounts/:id/deactivate', { onRequest: primaryAdminOnly, schema: { params: idParams } }, async (request, reply) => {
		const target = await supabase.from('admin').select('admin_id, admin_auth_user_id, admin_role, admin_account_status, admin_is_deactivated').eq('admin_id', request.params.id).maybeSingle()
		if (target.error || !target.data || String(target.data.admin_id) === String(request.admin.id) || target.data.admin_role !== 'super_admin' || target.data.admin_is_deactivated) return reply.code(400).send({ message: genericFailure })
		const active = await supabase.from('admin').select('admin_id', { count: 'exact', head: true }).eq('admin_role', 'super_admin').eq('admin_account_status', 'official').eq('admin_is_deactivated', false)
		if (active.error || active.count <= 1) return reply.code(400).send({ message: 'The last active Super Admin cannot be deactivated.' })
		const timestamp = new Date().toISOString()
		const updated = await supabase.from('admin').update({ admin_is_deactivated: true, admin_deactivated_on: timestamp, admin_updated_at: timestamp }).eq('admin_id', request.params.id).select('admin_id').single()
		if (updated.error) {
			request.log.error({ code: updated.error.code }, 'Admin deactivation failed')
			return reply.code(400).send({ message: genericFailure })
		}
		const banned = await supabase.auth.admin.updateUserById(target.data.admin_auth_user_id, { ban_duration: '876000h' })
		if (banned.error) request.log.error({ code: banned.error.code }, 'Auth ban failed')
		await writeAudit(supabase, request, 'admin_account_deactivated', `Deactivated admin account ${request.params.id}`)
		return { message: 'Account deactivated' }
	})

	app.post('/api/admin-accounts/:id/reactivate', { onRequest: primaryAdminOnly, schema: { params: idParams } }, async (request, reply) => {
		const target = await supabase.from('admin').select('admin_id, admin_auth_user_id, admin_role, admin_is_deactivated').eq('admin_id', request.params.id).maybeSingle()
		if (target.error || !target.data || target.data.admin_role !== 'super_admin' || !target.data.admin_is_deactivated) return reply.code(400).send({ message: genericFailure })
		const updated = await supabase.from('admin').update({ admin_is_deactivated: false, admin_updated_at: new Date().toISOString() }).eq('admin_id', request.params.id).eq('admin_is_deactivated', true).select('admin_id').single()
		if (updated.error) {
			request.log.error({ code: updated.error.code }, 'Admin reactivation failed')
			return reply.code(400).send({ message: genericFailure })
		}
		const unbanned = await supabase.auth.admin.updateUserById(target.data.admin_auth_user_id, { ban_duration: 'none' })
		if (unbanned.error) request.log.error({ code: unbanned.error.code }, 'Auth unban failed')
		await writeAudit(supabase, request, 'admin_account_reactivated', `Reactivated admin account ${request.params.id}`)
		return { message: 'Account reactivated' }
	})

	app.post('/api/auth/login-complete', { preHandler: requireAuth({ allowPartial: true }) }, async (request, reply) => {
		const timestamp = new Date().toISOString()
		const updates = { admin_last_login: timestamp, admin_updated_at: timestamp }
		if (request.admin.status === 'partial') {
			if (!request.admin.usedPassword) return reply.code(403).send({ message: 'Access denied.' })
			updates.admin_account_status = 'official'
		}
		const result = await supabase.from('admin').update(updates).eq('admin_id', request.admin.id).eq('admin_account_status', request.admin.status).select('admin_id, admin_full_name, admin_role, admin_account_status').maybeSingle()
		if (result.error || !result.data) return reply.code(403).send({ message: 'Access denied.' })
		return { id: result.data.admin_id, name: result.data.admin_full_name, role: result.data.admin_role, status: result.data.admin_account_status }
	})

	app.get('/api/auth/me', { preHandler: adminOnly }, async request => ({
		id: request.admin.id,
		name: request.admin.name,
		role: request.admin.role,
		status: request.admin.status,
		isPrimary: request.admin.isPrimary,
		jobTitle: request.admin.jobTitle || '',
		profilePicture: request.admin.profilePicture || null,
	}))

	app.get('/api/auth/profile', { preHandler: adminOnly }, async request => ({
		id: request.admin.id,
		name: request.admin.name,
		email: request.admin.email,
		role: request.admin.role,
		jobTitle: request.admin.jobTitle || '',
		contactNum: request.admin.contactNum || '',
		profilePicture: request.admin.profilePicture || null,
	}))

	app.patch('/api/auth/profile', {
		preHandler: adminOnly,
		schema: {
			body: {
				type: 'object',
				additionalProperties: false,
				properties: {
					name: { type: 'string', minLength: 1, maxLength: 100 },
					job_title: { type: 'string', maxLength: 100 },
					contact_num: { type: 'string', pattern: '^[0-9]*$', maxLength: 20 },
					profile_picture: { type: ['string', 'null'], maxLength: 1000000, pattern: profilePicturePattern },
				},
				minProperties: 1,
			},
		},
	}, async (request, reply) => {
		const updates = { admin_updated_at: new Date().toISOString() }
		if (request.body.name !== undefined) updates.admin_full_name = request.body.name.trim()
		if (request.body.job_title !== undefined) updates.admin_job_title = request.body.job_title.trim() || null
		if (request.body.contact_num !== undefined) updates.admin_contact_num = request.body.contact_num.trim() || null
		if (request.body.profile_picture !== undefined) updates.admin_profile_picture = request.body.profile_picture
		const result = await supabase.from('admin').update(updates).eq('admin_id', request.admin.id).select(accountFields).single()
		if (result.error) {
			request.log.error({ code: result.error.code }, 'Profile update failed')
			return reply.code(400).send({ message: genericFailure })
		}
		return accountResponse(result.data)
	})
}

module.exports = registerAccountManagementRoutes