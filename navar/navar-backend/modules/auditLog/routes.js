const MODULE_LABELS = {
	account_management: 'Account Management', application_management: 'Application Management',
	application_ar: 'Application Management', ar_development: 'AR Development', node_map: 'AR Development',
	mall_management: 'Mall Management', inquiry_management: 'Mall Management', subscription_management: 'Subscription Management',
}

function displayName(value) {
	return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
}

async function recordAudit(supabase, request, event) {
	const row = {
		audit_log_module: event.module,
		audit_log_action: event.action,
		audit_log_details: event.details || null,
		audit_log_performed_at: new Date().toISOString(),
		audit_log_performed_by: request.admin.id,
		mall_id: event.mallId || null,
		audit_log_target_type: event.targetType || null,
		audit_log_target_id: event.targetId == null ? null : String(event.targetId),
		audit_log_target_name: event.targetName || null,
		audit_log_metadata: event.metadata || {},
		audit_log_request_id: event.requestId || request.id || null,
		audit_log_actor_name: request.admin.name || null,
		audit_log_actor_role: request.admin.role || null,
	}
	const result = await supabase.from('audit_log').insert(row)
	if (result.error) throw result.error
}

function registerAuditLogRoutes(app) {
	app.get('/api/audit-logs', async (request, reply) => {
		const page = Math.max(1, Number(request.query?.page) || 1)
		const pageSize = Math.min(100, Math.max(10, Number(request.query?.pageSize) || 25))
		let query = app.supabase.from('audit_log').select('*', { count: 'exact' })
		if (request.query?.module) query = query.eq('audit_log_module', request.query.module)
		if (request.query?.adminId) query = query.eq('audit_log_performed_by', Number(request.query.adminId))
		if (request.query?.mallId) query = query.eq('mall_id', Number(request.query.mallId))
		if (request.query?.from) query = query.gte('audit_log_performed_at', request.query.from)
		if (request.query?.to) query = query.lte('audit_log_performed_at', request.query.to)
		const search = String(request.query?.search || '').trim()
		if (search) query = query.or(`audit_log_action.ilike.%${search.replace(/[,%]/g, '')}%,audit_log_details.ilike.%${search.replace(/[,%]/g, '')}%,audit_log_target_name.ilike.%${search.replace(/[,%]/g, '')}%`)
		const result = await query.order('audit_log_performed_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
		if (result.error) return reply.code(500).send({ message: 'Unable to load audit logs.' })
		const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
		const recentActors = await app.supabase.from('audit_log').select('audit_log_performed_by').gte('audit_log_performed_at', weekStart)
		if (recentActors.error) return reply.code(500).send({ message: 'Unable to load audit log statistics.' })
		const actorIds = [...new Set(result.data.map(row => row.audit_log_performed_by).filter(Boolean))]
		const mallIds = [...new Set(result.data.map(row => row.mall_id).filter(Boolean))]
		const [actors, malls] = await Promise.all([
			actorIds.length ? app.supabase.from('admin').select('admin_id,admin_full_name,admin_role').in('admin_id', actorIds) : Promise.resolve({ data: [], error: null }),
			mallIds.length ? app.supabase.from('mall').select('mall_id,mall_name').in('mall_id', mallIds) : Promise.resolve({ data: [], error: null }),
		])
		if (actors.error || malls.error) return reply.code(500).send({ message: 'Unable to load audit log details.' })
		const actorById = new Map((actors.data || []).map(actor => [String(actor.admin_id), actor]))
		const mallById = new Map((malls.data || []).map(mall => [String(mall.mall_id), mall.mall_name]))
		const items = result.data.map(row => {
			const actor = actorById.get(String(row.audit_log_performed_by))
			const mallName = mallById.get(String(row.mall_id))
			return {
				id: row.audit_log_id, timestamp: row.audit_log_performed_at,
				adminId: row.audit_log_performed_by, admin: row.audit_log_actor_name || actor?.admin_full_name || `Admin #${row.audit_log_performed_by}`,
				actorRole: row.audit_log_actor_role || actor?.admin_role || null,
				module: MODULE_LABELS[row.audit_log_module] || displayName(row.audit_log_module),
				moduleKey: row.audit_log_module, action: displayName(row.audit_log_action), actionKey: row.audit_log_action,
				target: row.audit_log_target_name || mallName || (row.mall_id ? 'Unknown mall' : 'System'),
				targetType: row.audit_log_target_type, targetId: row.audit_log_target_id,
				details: row.audit_log_details || '', metadata: row.audit_log_metadata || {}, mallId: row.mall_id,
			}
		})
		return { items, page, pageSize, total: result.count || 0, stats: { thisWeek: recentActors.data.length, adminsActive: new Set(recentActors.data.map(row => row.audit_log_performed_by).filter(Boolean)).size, systemActions: recentActors.data.filter(row => !row.audit_log_performed_by).length } }
	})
}

module.exports = { recordAudit, registerAuditLogRoutes }
