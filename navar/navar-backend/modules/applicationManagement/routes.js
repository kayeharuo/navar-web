'use strict'

const { signedImageUrl, uploadImage } = require('../storage/imageStorage')
const {
	parseImageDataUrl,
	MAX_THREAD_IMAGES_PER_MESSAGE,
	MAX_THREAD_TOTAL_BYTES,
	MAX_THREAD_IMAGE_BYTES,
} = require('../storage/attachmentValidation')

const now = () => new Date().toISOString()
const titleCase = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
const dateLabel = value => value
	? new Date(value).toLocaleDateString('en-US', {
		timeZone: 'Asia/Manila',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})
	: '-'
const timeLabel = value => {
	if (!value) return ''
	const [hours, minutes] = String(value).split(':').map(Number)
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value)
	const suffix = hours >= 12 ? 'PM' : 'AM'
	const displayHours = hours % 12 || 12
	return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`
}
const dayLabels = {
	monday: 'Mon',
	tuesday: 'Tue',
	wednesday: 'Wed',
	thursday: 'Thu',
	friday: 'Fri',
	saturday: 'Sat',
	sunday: 'Sun',
}
const normalizeDay = value => dayLabels[String(value || '').toLowerCase()] || String(value || '')

async function serializeMessages(supabase, messages, includeAttachments = true) {
	const messageIds = messages.map(message => message.message_id)
	const attachments = includeAttachments && messageIds.length
		? await supabase.from('thread_message_attachment').select('*').in('thread_message_id', messageIds).order('thread_message_attachment_created_at')
		: { data: [], error: null }
	if (attachments.error) throw attachments.error
	const attachmentsByMessage = new Map()
	for (const attachment of attachments.data || []) {
		const url = await signedImageUrl(supabase, attachment.thread_message_attachment_storage_path, 300)
		const item = {
			id: attachment.thread_message_attachment_id,
			fileName: attachment.thread_message_attachment_file_name,
			mimeType: attachment.thread_message_attachment_mime_type,
			fileSize: attachment.thread_message_attachment_file_size,
			url,
		}
		const current = attachmentsByMessage.get(attachment.thread_message_id) || []
		current.push(item)
		attachmentsByMessage.set(attachment.thread_message_id, current)
	}
	return messages.map(message => ({
		id: message.message_id,
		name: message.message_sender_type === 'admin' ? 'Super Admin' : 'Mall Admin',
		isAdmin: message.message_sender_type === 'admin',
		date: new Date(message.message_sent_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
		message: message.message_content,
		attachments: attachmentsByMessage.get(message.message_id) || [],
	}))
}

async function mallRecipients(supabase, mallId) {
	const result = await supabase.from('admin').select('admin_id, admin_role, mall_id').eq('admin_is_deactivated', false)
	if (result.error) throw result.error
	return (result.data || []).filter(admin =>
		admin.admin_role === 'mall_admin' && String(admin.mall_id) === String(mallId)
	)
}

async function notify(supabase, { mallId, sourceType, sourceId, title, message, actionUrl, actorId, actorRole }) {
	const recipients = await mallRecipients(supabase, mallId)
	if (!recipients.length) return
	const result = await supabase.from('admin_notification').insert(recipients.map(recipient => ({
		admin_notif_type: sourceType,
		admin_notif_title: title,
		admin_notif_message: message,
		admin_notif_action_url: actionUrl,
		admin_notif_action_label: 'View details',
		admin_notif_source_type: sourceType,
		admin_notif_source_id: sourceId,
		admin_notif_source_label: `Application #${sourceId}`,
		admin_notif_actor_id: actorId,
		admin_notif_actor_role: actorRole || 'admin',
		admin_notif_is_read: false,
		admin_notif_is_archived: false,
		admin_notif_created_at: now(),
		admin_id: recipient.admin_id,
		mall_id: mallId,
	})))
	if (result.error) throw result.error
}

async function applicationDetails(supabase, applicationId, request) {
	const application = await supabase.from('application').select('*').eq('application_id', applicationId).single()
	if (application.error) return null
	const mall = await supabase.from('mall').select('*').eq('mall_id', application.data.mall_id).single()
	const floors = await supabase.from('floor').select('*').eq('mall_id', application.data.mall_id).order('floor_num')
	const plans = await supabase.from('application_floor_plan').select('*').eq('application_id', applicationId).order('floor_id')
	const entries = await supabase.from('application_entry_point').select('*').eq('application_id', applicationId).order('floor_id')
	const developments = await supabase.from('ar_development').select('*').eq('application_id', applicationId).order('ar_development_id', { ascending: false }).limit(1)
	const thread = await supabase.from('thread').select('*').eq('application_id', applicationId).maybeSingle()
	let messages = []
	if (thread.data) {
		const messageResult = await supabase.from('thread_message').select('*').eq('thread_id', thread.data.thread_id).order('message_sent_at')
		messages = messageResult.data || []
	}
	const admin = await supabase.from('admin').select('admin_full_name, admin_email').eq('mall_id', application.data.mall_id).eq('admin_role', 'mall_admin').eq('admin_is_deactivated', false).limit(1).maybeSingle()
	const hours = await supabase.from('operating_hours').select('*').eq('mall_id', application.data.mall_id).eq('opthrs_is_mall', true).order('opthrs_id')
	const floorById = new Map((floors.data || []).map(floor => [floor.floor_id, floor]))
	const floorPlans = (plans.data || []).map(plan => {
		const floor = floorById.get(plan.floor_id)
		return {
			...plan,
			floor: floor?.floor_label || `Floor ${floor?.floor_num ?? plan.floor_id}`,
			filename: plan.app_floor_plan_file_name || 'Floor plan',
			size: plan.app_floor_plan_file_size ? `${(plan.app_floor_plan_file_size / 1024 / 1024).toFixed(1)} MB` : '-',
			referenceLine: plan.app_floor_plan_reference_line,
			lengthInMeters: plan.app_floor_plan_meter_length,
			accessibilityRoute: plan.app_floor_plan_accessibility_route,
			emergencyRoute: plan.app_floor_plan_emergency_route,
		}
	})
	const scalePlan = floorPlans.find(plan => plan.referenceLine)
	return {
		id: application.data.application_id,
		mallId: application.data.mall_id,
		mallName: mall.data?.mall_name || 'Unknown mall',
		city: mall.data?.mall_city || '',
		address: mall.data?.mall_address || '',
		cityProvince: [mall.data?.mall_city, mall.data?.mall_state].filter(Boolean).join(', '),
		latitude: mall.data?.mall_latitude,
		longitude: mall.data?.mall_longitude,
		logoUrl: mall.data?.mall_logo_path || mall.data?.mall_logo ? `/api/malls/${application.data.mall_id}/logo` : null,
		adminName: admin.data?.admin_full_name || 'No mall admin',
		adminEmail: admin.data?.admin_email || '',
		version: application.data.application_version,
		floors: floors.data?.length || mall.data?.mall_floor_count || 0,
		agreement: 'Setup',
		applicationStatus: titleCase(application.data.application_status),
		arDevelopment: developments.data?.[0] ? titleCase(developments.data[0].ar_development_status) : '-',
		arDevelopmentId: developments.data?.[0]?.ar_development_id || null,
		submittedDate: dateLabel(application.data.application_created_at),
		lastUpdated: dateLabel(application.data.application_updated_at),
		operatingHours: (hours.data || []).map(hour => ({
			...hour,
			opthrs_day_of_week: normalizeDay(hour.opthrs_day_of_week),
		})),
		floorPlans,
		scaleReference: scalePlan ? {
			referenceLine: scalePlan.referenceLine,
			lengthInMeters: `${scalePlan.lengthInMeters} m`,
			floor: scalePlan.floor,
		} : { referenceLine: '', lengthInMeters: '', floor: '' },
		accessibilityRoutes: floorPlans.filter(plan => plan.accessibilityRoute).map(plan => ({ floor: plan.floor, description: plan.accessibilityRoute })),
		emergencyExits: floorPlans.filter(plan => plan.emergencyRoute).map(plan => ({ floor: plan.floor, description: plan.emergencyRoute })),
		entryPoints: (entries.data || []).map(entry => ({
			name: entry.app_entry_point_label,
			note: entry.app_entry_point_description || '',
			floor: floorById.get(entry.floor_id)?.floor_label || `Floor ${floorById.get(entry.floor_id)?.floor_num ?? entry.floor_id}`,
		})),
		thread: await serializeMessages(supabase, messages),
		_floorRecords: floors.data || [],
	}
}

module.exports = function registerApplicationManagementRoutes(app) {
	app.get('/api/ar-developments', async (request, reply) => {
		try {
			const developments = await app.supabase.from('ar_development').select('*').order('ar_development_created_at', { ascending: true })
			if (developments.error) throw developments.error
			const applicationIds = [...new Set((developments.data || []).map(item => item.application_id))]
			const applications = applicationIds.length
				? await app.supabase.from('application').select('*').in('application_id', applicationIds)
				: { data: [], error: null }
			if (applications.error) throw applications.error
			const mallIds = [...new Set((applications.data || []).map(item => item.mall_id))]
			const malls = mallIds.length
				? await app.supabase.from('mall').select('*').in('mall_id', mallIds)
				: { data: [], error: null }
			if (malls.error) throw malls.error
			const applicationById = new Map((applications.data || []).map(item => [item.application_id, item]))
			const mallById = new Map((malls.data || []).map(item => [item.mall_id, item]))
			return (developments.data || []).map(item => {
				const application = applicationById.get(item.application_id)
				const mall = mallById.get(application?.mall_id)
				return {
					id: item.ar_development_id,
					applicationId: item.application_id,
					mallName: mall?.mall_name || 'Unknown mall',
					city: mall?.mall_city || '',
					version: application?.application_version || item.ar_development_version,
					floors: mall?.mall_floor_count || 0,
					tier: '—',
					agreement: 'Setup',
					applicationStatus: titleCase(application?.application_status),
					arStatus: titleCase(item.ar_development_status),
					dateAdded: dateLabel(item.ar_development_created_at),
					lastUpdated: dateLabel(item.ar_development_updated_at),
					nodes: 0,
					edges: 0,
					thread: [],
					testErrors: [],
					stallAdditions: [],
				}
			})
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'AR development list failed')
			return reply.code(500).send({ message: 'Unable to load AR development projects.' })
		}
	})

	app.get('/api/applications', async (request, reply) => {
		try {
			const [malls, applications, developments] = await Promise.all([
				app.supabase.from('mall').select('*').order('mall_name'),
				app.supabase.from('application').select('*').order('application_updated_at', { ascending: false }),
				app.supabase.from('ar_development').select('*').order('ar_development_updated_at', { ascending: false }),
			])
			if (malls.error || applications.error || developments.error) throw malls.error || applications.error || developments.error
			const mallById = new Map((malls.data || []).map(mall => [String(mall.mall_id), mall]))
			const latestByMall = new Map()
			const developmentByApplication = new Map()
			for (const item of applications.data || []) {
				const current = latestByMall.get(String(item.mall_id))
				if (!current || new Date(item.application_updated_at) > new Date(current.application_updated_at)) {
					latestByMall.set(String(item.mall_id), item)
				}
				for (const development of developments.data || []) {
					if (!developmentByApplication.has(String(development.application_id))) {
						developmentByApplication.set(String(development.application_id), development)
					}
				}
			}
			const rows = []
			for (const mall of malls.data || []) {
				const application = latestByMall.get(String(mall.mall_id))
				if (!application) {
					rows.push({
						id: `draft-${mall.mall_id}`, draft: true, mallId: mall.mall_id,
						mallName: mall.mall_name, city: mall.mall_city || '',
						adminName: 'No mall account', adminEmail: '',
						version: 1, floors: mall.mall_floor_count || 0,
						address: mall.mall_address || '', cityProvince: [mall.mall_city, mall.mall_state].filter(Boolean).join(', '),
						agreement: 'Setup', applicationStatus: 'Draft', arDevelopment: '-',
						submittedDate: '-', lastUpdated: '-', floorPlans: [], thread: [],
					})
					continue
				}
				const relatedMall = mallById.get(String(application.mall_id)) || mall
				rows.push({
					id: application.application_id,
					mallId: application.mall_id,
					mallName: relatedMall.mall_name,
					city: relatedMall.mall_city || '',
					adminName: 'View details',
					adminEmail: '',
					version: application.application_version,
					floors: relatedMall.mall_floor_count || 0,
					agreement: 'Setup',
					applicationStatus: titleCase(application.application_status),
					arDevelopment: titleCase(developmentByApplication.get(String(application.application_id))?.ar_development_status || '-'),
					submittedDate: dateLabel(application.application_created_at),
					lastUpdated: dateLabel(application.application_updated_at),
					floorPlans: [],
					thread: [],
				})
			}
			return rows
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Application list failed')
			return reply.code(500).send({ message: 'Unable to load applications.' })
		}
	})

	app.get('/api/conversations', async (request, reply) => {
		try {
			const threads = await app.supabase.from('thread').select('*').order('thread_created_at', { ascending: false })
			if (threads.error) throw threads.error
			const threadRows = threads.data || []
			const messageRows = threadRows.length
				? await app.supabase.from('thread_message').select('*').in('thread_id', threadRows.map(thread => thread.thread_id)).order('message_sent_at', { ascending: false })
				: { data: [], error: null }
			if (messageRows.error) throw messageRows.error
			const messagesByThread = new Map()
			for (const message of messageRows.data || []) {
				if (!messagesByThread.has(message.thread_id)) messagesByThread.set(message.thread_id, message)
			}
			const applicationIds = threadRows.filter(thread => thread.application_id).map(thread => thread.application_id)
			const stallApplicationIds = threadRows.filter(thread => thread.s_application_id).map(thread => thread.s_application_id)
			const arDevelopmentIds = threadRows.filter(thread => thread.ar_development_id).map(thread => thread.ar_development_id)
			const [applications, stallApplications, developments, malls] = await Promise.all([
				applicationIds.length ? app.supabase.from('application').select('application_id, mall_id').in('application_id', applicationIds) : { data: [], error: null },
				stallApplicationIds.length ? app.supabase.from('stall_application').select('s_application_id, mall_id').in('s_application_id', stallApplicationIds) : { data: [], error: null },
				arDevelopmentIds.length ? app.supabase.from('ar_development').select('ar_development_id, application_id').in('ar_development_id', arDevelopmentIds) : { data: [], error: null },
				app.supabase.from('mall').select('mall_id, mall_name'),
			])
			if (applications.error || stallApplications.error || developments.error || malls.error) {
				throw applications.error || stallApplications.error || developments.error || malls.error
			}
			const applicationById = new Map((applications.data || []).map(item => [item.application_id, item]))
			const stallById = new Map((stallApplications.data || []).map(item => [item.s_application_id, item]))
			const developmentById = new Map((developments.data || []).map(item => [item.ar_development_id, item]))
			const mallById = new Map((malls.data || []).map(item => [item.mall_id, item]))
			return threadRows.map(thread => {
				const latest = messagesByThread.get(thread.thread_id)
				const application = thread.application_id ? applicationById.get(thread.application_id) : null
				const stallApplication = thread.s_application_id ? stallById.get(thread.s_application_id) : null
				const development = thread.ar_development_id ? developmentById.get(thread.ar_development_id) : null
				const mallId = application?.mall_id || stallApplication?.mall_id || (development && applicationById.get(development.application_id)?.mall_id)
				const source = thread.application_id
					? { key: 'application', label: 'APP', path: `/application-management?applicationId=${thread.application_id}&type=new&view=thread` }
					: thread.s_application_id
						? { key: 'stall', label: 'STALL', path: `/application-management?applicationId=${thread.s_application_id}&type=stall&view=thread` }
						: { key: 'ar', label: 'AR DEV', path: `/ar-development?projectId=${thread.ar_development_id}` }
				return {
					id: thread.thread_id,
					moduleKey: source.key,
					moduleLabel: source.label,
					mallName: mallById.get(mallId)?.mall_name || 'Unknown mall',
					preview: latest?.message_content || 'No messages yet.',
					time: latest?.message_sent_at || thread.thread_created_at,
					unread: Boolean(latest && latest.message_sender_type !== 'admin'),
					path: source.path,
				}
			}).filter(thread => thread.mallName !== 'Unknown mall')
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Conversation list failed')
			return reply.code(500).send({ message: 'Unable to load conversations.' })
		}
	})

	app.get('/api/applications/:id', async (request, reply) => {
		const detail = await applicationDetails(app.supabase, Number(request.params.id), request)
		if (!detail) return reply.code(404).send({ message: 'Application not found.' })
		return detail
	})

	app.patch('/api/applications/:id/revision', async (request, reply) => {
		const id = Number(request.params.id)
		const notes = String(request.body?.notes || '').trim()
		if (!notes) return reply.code(400).send({ message: 'Revision notes are required.' })
		const current = await app.supabase.from('application').select('mall_id').eq('application_id', id).single()
		if (current.error) return reply.code(404).send({ message: 'Application not found.' })
		const update = await app.supabase.from('application').update({ application_status: 'for_revision', application_updated_at: now() }).eq('application_id', id)
		if (update.error) throw update.error
		const suspended = await app.supabase.from('ar_development')
			.update({ ar_development_status: 'suspended', ar_development_updated_at: now() })
			.eq('application_id', id)
			.select('*')
		if (suspended.error) throw suspended.error
		let thread = await app.supabase.from('thread').select('thread_id').eq('application_id', id).order('thread_id', { ascending: true }).limit(1).maybeSingle()
		if (thread.error) throw thread.error
		if (!thread.data) {
			thread = await app.supabase.from('thread').insert({ thread_source: 'development_application', thread_created_at: now(), application_id: id }).select('thread_id').single()
			if (thread.error) throw thread.error
		}
		const message = await app.supabase.from('thread_message').insert({ message_sender_type: 'admin', message_sent_at: now(), message_content: notes, thread_id: thread.data.thread_id, message_sender: request.admin.id })
		if (message.error) throw message.error
		await notify(app.supabase, { mallId: current.data.mall_id, sourceType: 'application_revision_requested', sourceId: id, title: 'Application revision requested', message: notes, actionUrl: `/application-management?applicationId=${id}&view=thread`, actorId: request.admin.id, actorRole: request.admin.role })
		return { message: 'Revision requested.', arDevelopment: suspended.data?.[0] || null }
	})

	app.post('/api/applications/:id/approve', async (request, reply) => {
		const id = Number(request.params.id)
		const current = await app.supabase.from('application').select('mall_id, application_version').eq('application_id', id).single()
		if (current.error) return reply.code(404).send({ message: 'Application not found.' })
		const update = await app.supabase.from('application').update({ application_status: 'approved', application_updated_at: now() }).eq('application_id', id)
		if (update.error) throw update.error
		let development = await app.supabase.from('ar_development').select('*').eq('application_id', id).order('ar_development_updated_at', { ascending: false }).limit(1).maybeSingle()
		if (development.error) throw development.error
		if (development.data) {
			development = await app.supabase.from('ar_development').update({
				ar_development_status: 'pending',
				ar_development_version: current.data.application_version,
				ar_development_updated_at: now(),
			}).eq('ar_development_id', development.data.ar_development_id).select('*').single()
		} else {
			development = await app.supabase.from('ar_development').insert({
				ar_development_status: 'pending', ar_development_version: current.data.application_version,
				ar_development_created_at: now(), ar_development_updated_at: now(), application_id: id,
			}).select('*').single()
		}
		if (development.error) throw development.error
		await notify(app.supabase, { mallId: current.data.mall_id, sourceType: 'application_approved', sourceId: id, title: 'Application approved', message: 'Your application was approved and AR development is now pending in the queue.', actionUrl: `/application-management?applicationId=${id}`, actorId: request.admin.id, actorRole: request.admin.role })
		return { message: 'Application approved.', arDevelopment: development.data }
	})

	app.post('/api/ar-developments/:id/start-mapping', async (request, reply) => {
		const id = Number(request.params.id)
		const development = await app.supabase.from('ar_development').select('application_id, ar_development_status').eq('ar_development_id', id).single()
		if (development.error) return reply.code(404).send({ message: 'AR development not found.' })
		if (development.data.ar_development_status !== 'pending') return reply.code(400).send({ message: 'Only pending AR development can start node mapping.' })
		const updated = await app.supabase.from('ar_development').update({ ar_development_status: 'node_mapping', ar_development_updated_at: now() }).eq('ar_development_id', id).select('*').single()
		if (updated.error) throw updated.error
		const application = await app.supabase.from('application').select('mall_id').eq('application_id', development.data.application_id).single()
		if (!application.error) await notify(app.supabase, { mallId: application.data.mall_id, sourceType: 'ar_development_status_changed', sourceId: id, title: 'AR development started', message: 'Node mapping has started for your mall.', actionUrl: `/ar-development?projectId=${id}`, actorId: request.admin.id, actorRole: request.admin.role })
		return updated.data
	})

	app.get('/api/ar-developments/:id/thread', async (request, reply) => {
		const result = await app.supabase.from('thread').select('thread_id').eq('ar_development_id', Number(request.params.id)).maybeSingle()
		if (result.error) throw result.error
		if (!result.data) return { threadId: null, messages: [] }
		const messages = await app.supabase.from('thread_message').select('*').eq('thread_id', result.data.thread_id).order('message_sent_at')
		if (messages.error) throw messages.error
		return { threadId: result.data.thread_id, messages: await serializeMessages(app.supabase, messages.data || []) }
	})

	app.post('/api/ar-developments/:id/thread', async (request, reply) => {
		const id = Number(request.params.id)
		const content = String(request.body?.content || '').trim()
		if (!content) return reply.code(400).send({ message: 'Message content is required.' })
		let thread = await app.supabase.from('thread').select('thread_id').eq('ar_development_id', id).maybeSingle()
		if (thread.error) throw thread.error
		if (!thread.data) {
			thread = await app.supabase.from('thread').insert({
				thread_source: 'ar_development',
				thread_created_at: now(),
				ar_development_id: id,
			}).select('thread_id').single()
			if (thread.error) throw thread.error
		}
		const message = await app.supabase.from('thread_message').insert({
			message_sender_type: 'admin',
			message_sent_at: now(),
			message_content: content,
			thread_id: thread.data.thread_id,
			message_sender: request.admin.id,
		}).select('*').single()
		if (message.error) throw message.error
		return (await serializeMessages(app.supabase, [message.data], parsedAttachments.length > 0))[0]
	})

	app.get('/api/applications/:id/thread', async (request, reply) => {
		const result = await app.supabase.from('thread').select('thread_id, thread_source, thread_created_at').eq('application_id', Number(request.params.id)).maybeSingle()
		if (result.error) throw result.error
		if (!result.data) return { threadId: null, messages: [] }
		const messages = await app.supabase.from('thread_message').select('*').eq('thread_id', result.data.thread_id).order('message_sent_at')
		if (messages.error) throw messages.error
		return { threadId: result.data.thread_id, messages: await serializeMessages(app.supabase, messages.data || []) }
	})

	app.post('/api/applications/:id/thread', async (request, reply) => {
		const id = Number(request.params.id)
		const content = String(request.body?.content || '').trim()
		const attachments = Array.isArray(request.body?.attachments) ? request.body.attachments : []
		if (!content && attachments.length === 0) return reply.code(400).send({ message: 'Message content or an image is required.' })
		if (attachments.length > MAX_THREAD_IMAGES_PER_MESSAGE) return reply.code(400).send({ message: `A message can contain at most ${MAX_THREAD_IMAGES_PER_MESSAGE} images.` })
		const parsedAttachments = attachments.map(attachment => ({
			...attachment,
			parsed: parseImageDataUrl(attachment.dataUrl),
		}))
		if (parsedAttachments.some(attachment => !attachment.parsed || attachment.parsed.size > MAX_THREAD_IMAGE_BYTES)) {
			return reply.code(400).send({ message: 'Thread images must be valid PNG, JPEG, or WebP files no larger than 5 MB.' })
		}
		if (parsedAttachments.reduce((total, attachment) => total + attachment.parsed.size, 0) > MAX_THREAD_TOTAL_BYTES) {
			return reply.code(400).send({ message: 'The total image size per message cannot exceed 20 MB.' })
		}
		let thread = await app.supabase.from('thread').select('thread_id').eq('application_id', id).maybeSingle()
		if (!thread.data) thread = await app.supabase.from('thread').insert({ thread_source: 'development_application', thread_created_at: now(), application_id: id }).select('thread_id').single()
		const message = await app.supabase.from('thread_message').insert({ message_sender_type: 'admin', message_sent_at: now(), message_content: content || '', thread_id: thread.data.thread_id, message_sender: request.admin.id }).select('*').single()
		if (message.error) throw message.error
		for (const attachment of parsedAttachments) {
			const fileName = String(attachment.fileName || `image-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_')
			const path = `threads/${thread.data.thread_id}/messages/${message.data.message_id}/${fileName}`
			await uploadImage(app.supabase, path, attachment.dataUrl)
			const inserted = await app.supabase.from('thread_message_attachment').insert({
				thread_message_id: message.data.message_id,
				thread_message_attachment_type: 'image',
				thread_message_attachment_storage_path: path,
				thread_message_attachment_file_name: fileName,
				thread_message_attachment_mime_type: attachment.parsed.mimeType,
				thread_message_attachment_file_size: attachment.parsed.size,
				thread_message_attachment_created_at: now(),
				thread_message_attachment_uploaded_by: request.admin.id,
			})
			if (inserted.error) throw inserted.error
		}
		return (await serializeMessages(app.supabase, [message.data]))[0]
	})

	app.get('/api/application-floor-plans/:id/url', async (request, reply) => {
		const plan = await app.supabase.from('application_floor_plan').select('app_floor_plan_storage_path, app_floor_plan_image, app_floor_plan_file_name').eq('app_floor_plan_id', Number(request.params.id)).single()
		const storagePath = plan.data?.app_floor_plan_storage_path || plan.data?.app_floor_plan_image
		if (plan.error || !storagePath) return reply.code(404).send({ message: 'Floor plan not found.' })
		const url = await signedImageUrl(app.supabase, storagePath, 300)
		return { url, fileName: plan.data.app_floor_plan_file_name || 'floor-plan' }
	})
}
