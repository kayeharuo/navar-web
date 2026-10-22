'use strict'

const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const { safeOrigin } = require('../inquiries/followup')
const { uploadImage, signedImageUrl } = require('../storage/imageStorage')

const accountFields = 'admin_id, admin_role, admin_email, admin_full_name, admin_contact_num, admin_job_title, admin_is_primary, admin_account_status, admin_is_deactivated, admin_deactivated_on, admin_last_login, admin_created_at, admin_updated_at, admin_profile_picture, admin_profile_picture_path, mall_id, mall:mall_id(mall_name)'
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
	return `${safeOrigin(process.env.APP_BASE_URL || process.env.FRONTEND_ORIGIN, 'http://localhost:5173', process.env)}${path}?request=${requestId}`
}

async function issuePasswordRequest(supabase, authUserId, kind, requestId) {
	return supabase.rpc('issue_admin_password_request', {
		p_auth_user_id: authUserId,
		p_request_fingerprint: requestFingerprint(requestId),
		p_request_kind: kind,
		p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
	})
}

async function sendInviteEmail(email, actionLink, reset = false) {
    const parsedLink = new URL(actionLink)
    if (!['https:', 'http:'].includes(parsedLink.protocol)) throw new Error('Invalid password link')
    const htmlLink = escapeHtml(actionLink)
    const attachments = ['navar-icon-png.png','navar-wordmark-png.png'].map(filename => ({filename,content:readFileSync(join(__dirname,'../../email_template/inquiry/images',filename)),cid:`account-${filename}@navar`,contentType:'image/png'}))
    const title = reset ? 'Reset your NavAR password' : "You've been invited to NavAR"
    const description = reset ? 'A password reset was requested for your NavAR account. Use the button below to choose a new password. If you did not request this change, ignore this email.' : 'An administrator has created an account for you on NavAR. To get started, click the button below to set your password. This link can only be used once.'
	const user = process.env.SMTP_USER
	const pass = process.env.SMTP_PASS
	if (!user || !pass) throw new Error('SMTP_USER and SMTP_PASS are required to resend invites.')
	const transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST || 'smtp.gmail.com',
		port: Number(process.env.SMTP_PORT || 465),
		secure: (process.env.SMTP_SECURE || 'true') === 'true',
		auth: { user, pass },
		connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
	})
	try {
	const sent = await transporter.sendMail({
        attachments,
		from: `${process.env.SMTP_FROM_NAME || 'NavAR'} <${process.env.SMTP_FROM || user}>`,
		to: email,
		subject: title,
		text: `${title}. Set your password using this link: ${actionLink}`,
		html: `<!DOCTYPE html>
<html lang="en">
	<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title></head>
	<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;"><tr><td align="center">
			<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
				<tr><td align="center" style="background-color:#cfe8ff;padding:32px 24px;">
					<img src="cid:account-navar-icon-png.png@navar" width="44" height="44" alt="NavAR" style="display:block;margin:0 auto 12px auto;" />
					<img src="cid:account-navar-wordmark-png.png@navar" width="140" alt="NavAR" style="display:block;margin:0 auto;height:auto;" />
				</td></tr>
				<tr><td style="padding:32px 32px 8px 32px;">
					<p style="margin:0 0 16px 0;font-size:20px;line-height:28px;color:#0f172a;font-weight:bold;">${title}</p>
					<p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#374151;">${description}</p>
				</td></tr>
				<tr><td align="center" style="padding:0 32px 32px 32px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:8px;background-color:#0f172a;"><a href="${htmlLink}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">Set your password</a></td></tr></table></td></tr>
				<tr><td style="padding:0 32px 32px 32px;"><p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p><p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${htmlLink}" style="color:#2563eb;">${htmlLink}</a></p></td></tr>
				<tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td></tr>
				<tr><td style="padding:24px 32px 32px 32px;"><p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;">If you weren't expecting this invitation, you can safely ignore this email. Your account will not be activated unless this link is used.</p></td></tr>
			</table>
			<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;"><tr><td align="center" style="padding:20px 8px;"><p style="margin:0;font-size:12px;color:#9ca3af;">NavAR &middot; Indoor navigation, augmented</p></td></tr></table>
		</td></tr></table>
	</body>
</html>`,
	})
	if (!sent.accepted?.length) throw new Error('Email delivery was not confirmed.')
    } finally { transporter.close() }
}

function accountResponse(row) {
	return {
		id: row.admin_id,
		role: row.admin_role,
		mallId: row.mall_id,
		...(row.admin_role === 'mall_admin' ? { mall: row.mall?.mall_name || 'Unassigned mall' } : {}),
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
		mall_id: request.admin.mallId,
	})
	if (result.error) request.log.error({ code: result.error.code }, 'Audit log write failed')
}

function accountError(error) {
 if (['PGRST202','PGRST203','42883'].includes(error.code)) return 'An account database function is unavailable. Apply migration 26 and reload the Supabase schema cache.'
 if (error.code === '23502') return 'A required database field rejected this change. Apply account repair migration 26 to allow Super Admin audit records without a mall.'
 if (error.code === '23505') return 'An account with these details already exists.'
 if (['42501','22023','P0002'].includes(error.code)) return error.message
 if (error.code === 'P0001' && /quota|limit|allowance|subscription|primary/i.test(error.message || '')) return error.message
 return 'The database rejected the account change. Check the backend log for the error code.'
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
            role: { type: 'string', enum: ['super_admin', 'mall_admin'], default: 'super_admin' },
            mall_id: { type: 'integer', minimum: 1 },
            is_primary: { type: 'boolean', default: false },
			name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
			job_title: { type: 'string', maxLength: 100 },
			contact_num: { type: 'string', pattern: '^(|[+]?[0-9][0-9 ()-]{6,19})$', maxLength: 20 },
		},
	}
	const editBody = {
		type: 'object',
		additionalProperties: false,
		minProperties: 1,
		properties: {
			name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
			job_title: { type: 'string', maxLength: 100 },
			contact_num: { type: 'string', pattern: '^(|[+]?[0-9][0-9 ()-]{6,19})$', maxLength: 20 },
		},
	}
	const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1, maximum: 9007199254740991 } } }

	app.get('/api/admin-accounts', { onRequest: adminOnly }, async (request, reply) => {
        reply.header('Cache-Control', 'no-store')
        const rows = []
        for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from('admin').select(accountFields)
                .in('admin_role', ['super_admin', 'mall_admin'])
                .order('admin_created_at', { ascending: false }).order('admin_id', { ascending: false }).range(offset, offset + 499)
            if (error) { request.log.error({ code: error.code }, 'Account list failed'); return reply.code(500).send({ message: genericFailure }) }
            rows.push(...data)
            if (data.length < 500) break
        }
        return rows.map(accountResponse)
    })

    app.get('/api/admin-accounts/malls', { onRequest: adminOnly }, async (request, reply) => {
        reply.header('Cache-Control', 'no-store')
        const rows = []
        for (let offset = 0; ; offset += 500) {
            const result = await supabase.from('mall').select('mall_id,mall_name').order('mall_id').range(offset, offset + 499)
            if (result.error) return reply.code(503).send({ message: 'Unable to load mall choices.' })
            rows.push(...result.data.map(row => ({ id: row.mall_id, name: row.mall_name })))
            if (result.data.length < 500) return rows
        }
    })

	app.post('/api/admin-accounts', { onRequest: adminOnly, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { body: accountBody } }, async (request, reply) => {
		const email = request.body.email.trim().toLowerCase()
        reply.header('Cache-Control', 'no-store')
        const mallAccount = request.body.role === 'mall_admin'
        if (mallAccount && !request.body.contact_num?.trim()) return reply.code(400).send({ message: 'A contact number is required for mall admins.' })
        if (mallAccount && !request.body.mall_id) return reply.code(400).send({ message: 'Select a mall.' })
        if (!mallAccount && (request.body.mall_id || request.body.is_primary)) return reply.code(400).send({ message: 'Super Admin accounts cannot be assigned to a mall or made primary here.' })
		const existing = await supabase.from('admin').select('admin_id').eq('admin_email', email).maybeSingle()
		if (existing.error) {
			request.log.error({ code: existing.error.code }, 'Admin account lookup failed')
			return reply.code(500).send({ message: genericFailure })
		}
		if (existing.data) return reply.code(409).send({ message: 'An account with this email already exists.' })

		const requestId = crypto.randomUUID()
		// Create an identity without sending email; existing Auth identities are never adopted or deleted.
        const redirectTo = mallAccount ? safeOrigin(process.env.MALL_ADMIN_ORIGIN, 'http://localhost:5174', process.env) + (request.body.is_primary ? '/complete-setup' : '/reset-password') : passwordLinkRedirect('/auth/set-password', requestId)
        const invited = await supabase.auth.admin.createUser({ email, email_confirm: false })
		if (invited.error || !invited.data?.user) {
			request.log.error({
				code: invited.error?.code,
				status: invited.error?.status,
				name: invited.error?.name,
				message: invited.error?.message,
			}, 'Admin invite failed at Supabase Auth')
			if (['email_exists','user_already_exists','email_already_exists'].includes(invited.error?.code)) return reply.code(409).send({ message: 'This email already has a sign-in account. Use another email or review the existing account.' })
			return reply.code(invited.error?.status >= 500 ? 503 : 400).send({ message: 'The invitation service is unavailable. Please try again later.' })
		}
		const requestRecord = mallAccount ? {} : await issuePasswordRequest(supabase, invited.data.user.id, 'invite', requestId)
		if (requestRecord.error) {
			request.log.error({ code: requestRecord.error.code }, 'Invite request record failed')
			await supabase.auth.admin.deleteUser(invited.data.user.id)
			return reply.code(400).send({ message: 'This account cannot be created.' })
		}

        const inserted = await supabase.rpc('create_managed_admin', { p_actor: request.admin.id, p_auth: invited.data.user.id, p_data: {...request.body, email} })
		if (inserted.error) {
			request.log.error({ code: inserted.error.code }, 'Admin profile insert failed')
			await supabase.auth.admin.deleteUser(invited.data.user.id)
			return reply.code(400).send({ message: accountError(inserted.error) })
		}

		let warning = null
        try {
            const generated = await supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
            if (generated.error || generated.data?.user?.id !== invited.data.user.id || !generated.data?.properties?.action_link) throw new Error('Unable to prepare invitation')
            await sendInviteEmail(email, generated.data.properties.action_link)
        }
        catch { warning = 'Account created, but email delivery was not confirmed. Check the inbox before using Resend invite.' }
        return reply.code(201).send({ ...accountResponse(inserted.data), warning })
	})

    async function mutate(request, reply, action) {
        const result = await supabase.rpc('manage_super_admin_account', {
            p_actor: request.admin.id, p_target: request.params.id, p_action: action, p_data: request.body || {},
        })
        if (result.error) {
            request.log.warn({ code: result.error.code, message: result.error.message, details: result.error.details }, 'Account change rejected')
            const known = ['42501', '22023', 'P0002'].includes(result.error.code)
            reply.code(result.error.code === '42501' ? 403 : known ? 409 : 503).send({ message: accountError(result.error) })
            return null
        }
        return result.data
    }
    app.patch('/api/admin-accounts/:id', { onRequest: adminOnly, schema: { params: idParams, body: editBody } }, async (request, reply) => {
        const row = await mutate(request, reply, 'edit')
        if (row) return accountResponse(row)
    })

    for (const action of ['resend-invite', 'reset-password']) {
        app.post(`/api/admin-accounts/:id/${action}`, { onRequest: primaryAdminOnly, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { params: idParams } }, async (request, reply) => {
            // Reserve before generating any link. Concurrent clicks cannot issue duplicate emails.
            const row = await mutate(request, reply, action)
            if (!row) return
            try {
                const requestId = crypto.randomUUID()
                const mall = row.admin_role === 'mall_admin'
                const invite = action === 'resend-invite'
                let redirectTo
                if (mall) redirectTo = safeOrigin(process.env.MALL_ADMIN_ORIGIN, 'http://localhost:5174', process.env) + (invite && row.admin_is_primary ? '/complete-setup' : '/reset-password')
                else {
                    redirectTo = passwordLinkRedirect(invite ? '/auth/set-password' : '/auth/reset-password', requestId)
                    const recorded = await issuePasswordRequest(supabase, row.admin_auth_user_id, invite ? 'invite' : 'reset', requestId)
                    if (recorded.error) throw recorded.error
                }
                const generated = await supabase.auth.admin.generateLink({ type: invite ? 'magiclink' : 'recovery', email: row.admin_email, options: { redirectTo } })
                if (generated.error || generated.data?.user?.id !== row.admin_auth_user_id || !generated.data?.properties?.action_link) throw new Error('Identity mismatch or link unavailable')
                await sendInviteEmail(row.admin_email, generated.data.properties.action_link, !invite)
                return { message: invite ? 'Invitation submitted to the email provider.' : 'Password reset submitted to the email provider.' }
            } catch (error) {
                request.log.warn({ code: error.code || 'ACCOUNT_EMAIL_UNCONFIRMED' }, 'Account email delivery unconfirmed')
                return reply.code(502).send({ message: 'Email delivery could not be confirmed. Check the inbox before trying again in one minute.' })
            }
        })
    }

	app.post('/api/auth/password-link/validate', { preHandler: [requireAuth({ allowPartial: true }), requireSuperAdmin], schema: { body: passwordLinkBody } }, async (request, reply) => {
		const valid = await supabase.rpc('validate_admin_password_request', {
			p_auth_user_id: request.admin.authUserId,
			p_request_fingerprint: requestFingerprint(request.body.request_id),
		})
		if (valid.error) return reply.code(400).send({ message: 'This link is invalid or expired.' })
		return { valid: valid.data === true }
	})

	app.post('/api/auth/password-link/claim', { preHandler: [requireAuth({ allowPartial: true }), requireSuperAdmin], schema: { body: passwordLinkBody } }, async (request, reply) => {
		const claimed = await supabase.rpc('claim_admin_password_request', {
			p_auth_user_id: request.admin.authUserId,
			p_request_fingerprint: requestFingerprint(request.body.request_id),
		})
		if (claimed.error || !claimed.data) return reply.code(400).send({ message: 'This link is invalid or expired.' })
		return { kind: claimed.data }
	})

	app.post('/api/auth/password-link/complete', { preHandler: [requireAuth({ allowPartial: true }), requireSuperAdmin], schema: { body: passwordLinkBody } }, async (request, reply) => {
		const requestRecord = await supabase.from('admin_password_request').select('apr_request_kind').eq('apr_request_fingerprint', requestFingerprint(request.body.request_id)).eq('apr_auth_user_id', request.admin.authUserId).not('apr_claimed_at', 'is', null).is('apr_superseded_at', null).gt('apr_expires_at', new Date().toISOString()).maybeSingle()
		if (requestRecord.error || !requestRecord.data) return reply.code(400).send({ message: genericFailure })
		if (requestRecord.data.apr_request_kind === 'invite' && request.admin.status === 'partial') {
			if (!request.admin.usedPassword) return reply.code(400).send({ message: genericFailure })
			const completed = await supabase.from('admin').update({ admin_account_status: 'official', admin_last_login: new Date().toISOString(), admin_updated_at: new Date().toISOString() }).eq('admin_id', request.admin.id).eq('admin_account_status', 'partial').select('admin_id').maybeSingle()
			if (completed.error || !completed.data) return reply.code(400).send({ message: genericFailure })
		}
		return { message: 'Password updated' }
	})

    for (const action of ['deactivate', 'reactivate']) {
        app.post(`/api/admin-accounts/:id/${action}`, { onRequest: primaryAdminOnly, schema: { params: idParams } }, async (request, reply) => {
            if (action === 'reactivate') {
                // Validate permissions/state without granting access, then restore Auth first.
                const row = await mutate(request, reply, 'check-reactivate')
                if (!row) return
                const result = await supabase.auth.admin.updateUserById(row.admin_auth_user_id, { ban_duration: 'none' })
                if (result.error) return reply.code(503).send({ message: 'Authentication could not be restored. The account remains deactivated; please retry.' })
            }
            const row = await mutate(request, reply, action)
            if (!row) return
            let warning = null
            if (action === 'deactivate') {
                const result = await supabase.auth.admin.updateUserById(row.admin_auth_user_id, { ban_duration: '876000h' })
                if (result.error) {
                    request.log.error({ code: result.error.code, accountId: row.admin_id }, 'Account disabled but Auth ban needs retry')
                    warning = 'Account access is disabled, but the Auth ban could not be confirmed. Check backend logs.'
                }
            }
            return { message: action === 'deactivate' ? 'Account deactivated' : 'Account reactivated', warning }
        })
    }

	app.post('/api/auth/login-complete', { preHandler: [requireAuth({ allowPartial: true }), requireSuperAdmin] }, async (request, reply) => {
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
					name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
					job_title: { type: 'string', maxLength: 100 },
					contact_num: { type: 'string', pattern: '^(|[+]?[0-9][0-9 ()-]{6,19})$', maxLength: 20 },
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
		if (request.body.profile_picture !== undefined) {
			if (request.body.profile_picture === null) { updates.admin_profile_picture_path = null; updates.admin_profile_picture = null }
			else {
				const picturePath = `admins/${request.admin.id}/profile`
				try {
					await uploadImage(supabase, picturePath, request.body.profile_picture)
					updates.admin_profile_picture_path = picturePath
					updates.admin_profile_picture = null
				} catch (storageError) {
					request.log.error({ message: storageError.message }, 'Profile picture storage upload failed')
					return reply.code(400).send({ message: genericFailure })
				}
			}
		}
		const result = await supabase.from('admin').update(updates).eq('admin_id', request.admin.id).select(accountFields).single()
		if (result.error) {
			request.log.error({ code: result.error.code }, 'Profile update failed')
			return reply.code(400).send({ message: genericFailure })
		}
		const response = accountResponse(result.data)
		if (result.data.admin_profile_picture_path) response.profilePicture = await signedImageUrl(supabase, result.data.admin_profile_picture_path)
		return response
	})
}

module.exports = registerAccountManagementRoutes
module.exports.sendInviteEmail = sendInviteEmail
