'use strict'

function tokenUsedPassword(token) {
	try {
		const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
		return Array.isArray(payload.amr) && payload.amr.some(item => item.method === 'password')
	} catch {
		return false
	}
}

function createAuthGuards(supabase) {
	function requireAuth({ allowPartial = false } = {}) {
		return async function authGuard(request, reply) {
			const header = request.headers.authorization || ''
			const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
			if (!token || token.length > 4096) return reply.code(401).send({ message: 'Authentication required.' })

			const { data, error } = await supabase.auth.getUser(token)
			if (error || !data?.user) return reply.code(401).send({ message: 'Authentication required.' })

			const { data: admin, error: adminError } = await supabase
				.from('admin')
				.select('admin_id, admin_role, admin_email, admin_full_name, admin_account_status, admin_is_deactivated, admin_is_primary, admin_job_title, admin_contact_num, admin_profile_picture, mall_id, store_id')
				.eq('admin_auth_user_id', data.user.id)
				.maybeSingle()

			if (adminError) {
				request.log.error({ code: adminError.code }, 'Admin lookup failed')
				return reply.code(500).send({ message: 'Something went wrong.' })
			}
			if (!admin || admin.admin_is_deactivated) return reply.code(403).send({ message: 'Access denied.' })
			if (admin.admin_account_status !== 'official' && !allowPartial) return reply.code(403).send({ message: 'Access denied.' })

			request.admin = {
				id: admin.admin_id,
				role: admin.admin_role,
				email: admin.admin_email,
				name: admin.admin_full_name,
				jobTitle: admin.admin_job_title,
				contactNum: admin.admin_contact_num,
				profilePicture: admin.admin_profile_picture,
				isPrimary: admin.admin_is_primary,
				status: admin.admin_account_status,
				mallId: admin.mall_id,
				storeId: admin.store_id,
				authUserId: data.user.id,
				usedPassword: tokenUsedPassword(token),
			}
		}
	}

	async function requireSuperAdmin(request, reply) {
		if (request.admin?.role !== 'super_admin') return reply.code(403).send({ message: 'Access denied.' })
	}

	async function requirePrimarySuperAdmin(request, reply) {
		if (request.admin?.role !== 'super_admin' || request.admin?.isPrimary !== true) return reply.code(403).send({ message: 'Access denied.' })
	}

	return { requireAuth, requireSuperAdmin, requirePrimarySuperAdmin }
}

module.exports = createAuthGuards