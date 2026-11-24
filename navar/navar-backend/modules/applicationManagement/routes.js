const {threadIsSuperseded,threadWriteState,applicationThreads}=require('./threadPolicy')
const {mapUpdateState}=require('../mapApplications/paymentState')
const {reviewHistory,historyRecord,historyDetails,historyPlan}=require('./reviewHistory')
const { summarizeMessages } = require('./conversationSummary')
const { withQueueNumbers } = require('./queue')
const { agreementLabel } = require('./agreementLabel')
'use strict'

const { signedImageUrl, uploadImage, floorPlanImageUrl } = require('../storage/imageStorage')
const {
	parseImageDataUrl,
	MAX_THREAD_IMAGES_PER_MESSAGE,
	MAX_THREAD_TOTAL_BYTES,
	MAX_THREAD_IMAGE_BYTES,
} = require('../storage/attachmentValidation')

const arService = require('./arService')
const { action } = arService
const { recordAudit } = require('../auditLog/routes')

async function allConversationRows(query) {
 const data=[]
 for(let offset=0;;offset+=500){
  const page=await query.range(offset,offset+499)
  if(page.error) return {data:null,error:page.error}
  data.push(...(page.data||[]))
  if((page.data||[]).length<500) return {data,error:null}
 }
}
const now = () => new Date().toISOString()
const titleCase = value => String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
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
	mon: 'Monday', monday: 'Monday',
	tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
	wed: 'Wednesday', wednesday: 'Wednesday',
	thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
	fri: 'Friday', friday: 'Friday',
	sat: 'Saturday', saturday: 'Saturday',
	sun: 'Sunday', sunday: 'Sunday',
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
		let url = null
		try {
			url = await signedImageUrl(supabase, attachment.thread_message_attachment_storage_path, 300)
		} catch (error) {
			console.error('Attachment signed URL failed:', attachment.thread_message_attachment_storage_path, error.message)
		}
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
        threadId: message.thread_id,
		name: ['admin','super_admin'].includes(message.message_sender_type) ? 'Super Admin' : 'Mall Admin',
		isAdmin: ['admin','super_admin'].includes(message.message_sender_type),
		date: new Date(message.message_sent_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
		message: message.message_content,
		attachments: attachmentsByMessage.get(message.message_id) || [],
	}))
}

async function applicationDetails(supabase, applicationId, request) {
	const application = await supabase.from('application').select('*').eq('application_id', applicationId).single()
	if (application.error) return null
	const mall = await supabase.from('mall').select('*').eq('mall_id', application.data.mall_id).single()
	const contract = await supabase.from('contract').select('contract_status,contract_start').eq('mall_id',application.data.mall_id).eq('contract_is_current',true).maybeSingle()
	if(contract.error)throw contract.error
	const floors = await supabase.from('floor').select('*').eq('mall_id', application.data.mall_id).order('floor_num')
	const plans = await supabase.from('application_floor_plan').select('*').eq('application_id', applicationId).order('floor_id')
	const entries = await supabase.from('application_entry_point').select('*').eq('application_id', applicationId).order('floor_id')
	const developments = await supabase.from('ar_development').select('*').eq('application_id', applicationId).order('ar_development_id', { ascending: false }).limit(1)
	const thread = await applicationThreads(supabase,application.data)
	let messages = []
	if (thread.error) throw thread.error
	if (thread.data?.length) {
		const messageResult = await supabase.from('thread_message').select('*').in('thread_id', thread.data.map(t => t.thread_id)).order('message_sent_at')
		messages = messageResult.data || []
	}
	const admin = await supabase.from('admin').select('admin_full_name, admin_email').eq('mall_id', application.data.mall_id).eq('admin_role', 'mall_admin').eq('admin_is_deactivated', false).limit(1).maybeSingle()
	const hours = await supabase.from('operating_hours').select('*').eq('mall_id', application.data.mall_id).eq('opthrs_is_mall', true).order('opthrs_id')
 const [provenanceResult,mapService]=await Promise.all([
  supabase.from('map_application_floor_source').select('*').eq('application_id',applicationId),
  mapUpdateState(supabase,applicationId),
 ])
 if(provenanceResult.error)throw provenanceResult.error
	const floorById = new Map((floors.data || []).map(floor => [floor.floor_id, floor]))
	const floorPlans = (plans.data || []).map(plan => {
		const floor = floorById.get(plan.floor_id)
		return {
			...plan,
			floor: floor?.floor_label || `Floor ${floor?.floor_num ?? plan.floor_id}`,
			filename: plan.app_floor_plan_file_name || 'Floor plan',
      reuseLabel: provenanceResult.data?.find(p=>p.floor_id===plan.floor_id)?.reused_image?'Reused plan':provenanceResult.data?.some(p=>p.floor_id===plan.floor_id)?'Updated plan':null,
			size: plan.app_floor_plan_file_size ? `${(plan.app_floor_plan_file_size / 1024 / 1024).toFixed(1)} MB` : '-',
			referenceLine: plan.app_floor_plan_reference_line,
			lengthInMeters: plan.app_floor_plan_meter_length,
			accessibilityRoute: plan.app_floor_plan_accessibility_route,
			emergencyRoute: plan.app_floor_plan_emergency_route,
		}
	})
	const scalePlan = floorPlans.find(plan => plan.referenceLine)
	const versions = await supabase.from('application').select('application_id,application_version,application_attempt,application_status,application_accepted_at').eq('mall_id', application.data.mall_id).order('application_version', { ascending: false }).order('application_attempt', { ascending: false })
	if (versions.error) throw versions.error
	const d = developments.data?.[0]
	const readOnly = versions.data?.[0]?.application_id !== applicationId || ['live','unpublished'].includes(d?.ar_development_status)
	return {
		id: application.data.application_id,
		threadReadOnly:threadIsSuperseded(versions.data||[],application.data), versions: versions.data, reviewHistory:await reviewHistory(supabase,(versions.data||[]).map(v=>v.application_id)), readOnly, attempt: application.data.application_attempt,
		reasonCategory: application.data.application_reason_category, reasonNotes: application.data.application_reason_notes,
		disputeCount: application.data.application_dispute_count,
    updatedAt:application.data.application_updated_at,
    mapUpdate:mapService?{...mapService,changedFloors:mapService.inputs?.floorIds?.length||0}:null,
		canRevise: !readOnly && !d?.ar_development_ready_at && (
			application.data.application_status === 'submitted'
			|| (application.data.application_status === 'approved' && d && ['pending','node_mapping','testing'].includes(d.ar_development_status))
		),
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
		agreement: agreementLabel(contract.data),
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
 app.addHook('preValidation', async (request, reply) => {
  if (request.params?.id !== undefined && (!Number.isSafeInteger(Number(request.params.id)) || Number(request.params.id) < 1)) return reply.code(400).send({ message: 'Invalid resource ID.' })
  if (request.body?.attachments !== undefined && !Array.isArray(request.body.attachments)) return reply.code(400).send({ message: 'Attachments must be an array.' })
  if (request.body?.content !== undefined && (typeof request.body.content !== 'string' || request.body.content.length > 10000)) return reply.code(400).send({ message: 'Messages must contain at most 10000 characters.' })
 })

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
			const contracts = await app.supabase.from('contract').select('*').eq('contract_is_current', true)
      const tiers = await app.supabase.from('subscription_tier').select('s_tier_id,s_tier_key,s_tier_label')
      const allApps = await app.supabase.from('application').select('application_id,mall_id,application_version,application_attempt,application_status,application_accepted_at').in('mall_id', mallIds.length ? mallIds : [0])
			const admins = await app.supabase.from('admin').select('mall_id,admin_full_name,admin_email').eq('admin_role', 'mall_admin').eq('admin_is_deactivated', false)
			const threads = await app.supabase.from('thread').select('ar_development_id').not('ar_development_id', 'is', null)
			const nodes = await app.supabase.from('node').select('ar_development_id')
			const edges = await app.supabase.from('edge').select('ar_development_id')
			for (const r of [allApps, admins, threads, nodes, edges, contracts, tiers]) if (r.error) throw r.error
			const applicationById = new Map((applications.data || []).map(item => [item.application_id, item]))
			const mallById = new Map((malls.data || []).map(item => [item.mall_id, item]))
			return withQueueNumbers((developments.data || []).map(item => {
				const application = applicationById.get(item.application_id)
				const mall = mallById.get(application?.mall_id)
        const contract = contracts.data.find(c => c.mall_id === application?.mall_id)
        const tier = { ...tiers.data.find(t => t.s_tier_id === contract?.s_tier_id), ...contract?.tier_snapshot }
				return {
					id: item.ar_development_id,
					mallId: application?.mall_id,
					readOnly: ['live','unpublished'].includes(item.ar_development_status) || (allApps.data || []).some(a => a.mall_id === application?.mall_id && (a.application_version > application.application_version || (a.application_version === application.application_version && a.application_attempt > application.application_attempt))),
          threadReadOnly:threadIsSuperseded((allApps.data||[]).filter(a=>a.mall_id===application?.mall_id),application),
					hasThread: (threads.data || []).some(t => t.ar_development_id === item.ar_development_id),
					readyAt: item.ar_development_ready_at, mallApprovedAt: item.ar_development_mall_approved_at, resumeStatus: item.ar_development_resume_status,
					waitingDays: item.ar_development_status === 'ready' && item.ar_development_ready_at ? Math.max(0, Math.floor((Date.now() - new Date(item.ar_development_ready_at)) / 86400000)) : 0,
					applicationId: item.application_id,
          attempt: application?.application_attempt || 1,
					mallName: mall?.mall_name || 'Unknown mall',
					adminName: admins.data.find(a => a.mall_id === application?.mall_id)?.admin_full_name || 'No mall admin',
					adminEmail: admins.data.find(a => a.mall_id === application?.mall_id)?.admin_email || '',
					city: mall?.mall_city || '',
					version: application?.application_version || item.ar_development_version,
					floors: mall?.mall_floor_count || 0,
					tier: tier?.s_tier_label || 'Not selected',
          tierKey: tier?.s_tier_key || null,
          applicationApprovedAt: application?.application_approved_at || null,
          createdAt: item.ar_development_created_at,
					agreement: agreementLabel(contract),
					applicationStatus: titleCase(application?.application_status),
					arStatus: titleCase(item.ar_development_status),
					dateAdded: dateLabel(item.ar_development_created_at),
					lastUpdated: dateLabel(item.ar_development_updated_at),
					nodes: (nodes.data || []).filter(n => n.ar_development_id === item.ar_development_id).length,
					edges: (edges.data || []).filter(e => e.ar_development_id === item.ar_development_id).length,
					thread: [],
					testErrors: [],
					stallAdditions: [],
				}
			}))
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'AR development list failed')
			return reply.code(500).send({ message: 'Unable to load AR development projects.' })
		}
	})

	app.get('/api/applications', async (request, reply) => {
		try {
			const [malls, applications, developments, contracts] = await Promise.all([
				app.supabase.from('mall').select('*').order('mall_name'),
				app.supabase.from('application').select('*').order('application_updated_at', { ascending: false }),
				app.supabase.from('ar_development').select('*').order('ar_development_updated_at', { ascending: false }),
				app.supabase.from('contract').select('mall_id,contract_status,contract_start').eq('contract_is_current',true),
			])
			if (malls.error || applications.error || developments.error || contracts.error) throw malls.error || applications.error || developments.error || contracts.error
			const contractByMall=new Map((contracts.data||[]).map(contract=>[String(contract.mall_id),contract]))
			const mallById = new Map((malls.data || []).map(mall => [String(mall.mall_id), mall]))
			const developmentByApplication = new Map()
			for (const development of developments.data || []) {
				// developments are newest-first, so the first one seen per application is the latest
				if (!developmentByApplication.has(String(development.application_id))) {
					developmentByApplication.set(String(development.application_id), development)
				}
			}
			const latestVersionByMall = new Map()
			const mallsWithApplications = new Set()
			for (const item of applications.data || []) {
				const key = String(item.mall_id)
				mallsWithApplications.add(key)
				latestVersionByMall.set(key, Math.max(latestVersionByMall.get(key) || 0, item.application_version))
			}
			const rows = []
			// Malls without any application show one temporary draft row.
			for (const mall of malls.data || []) {
				if (mallsWithApplications.has(String(mall.mall_id))) continue
				rows.push({
					id: `draft-${mall.mall_id}`, draft: true, mallId: mall.mall_id,
					mallName: mall.mall_name, city: mall.mall_city || '',
					adminName: 'No mall account', adminEmail: '',
					version: 1, floors: mall.mall_floor_count || 0,
					address: mall.mall_address || '', cityProvince: [mall.mall_city, mall.mall_state].filter(Boolean).join(', '),
					agreement: agreementLabel(contractByMall.get(String(mall.mall_id))), applicationStatus: 'Draft', arDevelopment: '-',
					submittedDate: '-', lastUpdated: '-', floorPlans: [], thread: [],
				})
			}
			// Every application version is its own row.
			for (const application of applications.data || []) {
				const relatedMall = mallById.get(String(application.mall_id))
				if (!relatedMall) continue
				rows.push({
					id: application.application_id,
					mallId: application.mall_id,
					mallName: relatedMall.mall_name,
					city: relatedMall.mall_city || '',
					adminName: 'View details',
					adminEmail: '',
					version: application.application_version,
					isLatestVersion: !(applications.data || []).some(a => a.mall_id === application.mall_id && (a.application_version > application.application_version || (a.application_version === application.application_version && a.application_attempt > application.application_attempt))),
					attempt: application.application_attempt,
					floors: relatedMall.mall_floor_count || 0,
					agreement: agreementLabel(contractByMall.get(String(application.mall_id))),
					applicationStatus: titleCase(application.application_status),
					arDevelopment: titleCase(developmentByApplication.get(String(application.application_id))?.ar_development_status || '-'),
					submittedDate: dateLabel(application.application_created_at),
          submittedAt:application.application_created_at,
					lastUpdated: dateLabel(application.application_updated_at),
					floorPlans: [],
					thread: [],
				})
			}
			rows.sort((a,b)=>(Date.parse(b.submittedAt)||0)-(Date.parse(a.submittedAt)||0)||(Number(b.id)||0)-(Number(a.id)||0))
			return rows
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Application list failed')
			return reply.code(500).send({ message: 'Unable to load applications.' })
		}
	})

	app.get('/api/conversations', async (request, reply) => {
		try {
			const threads = await allConversationRows(app.supabase.from('thread').select('*').order('thread_created_at', { ascending: false }).order('thread_id'))
			if (threads.error) throw threads.error
			const threadRows = threads.data || []
			const messageRows = threadRows.length
				? await allConversationRows(app.supabase.from('thread_message').select('*').in('thread_id', threadRows.map(thread => thread.thread_id)).order('message_id', { ascending: false }))
				: { data: [], error: null }
			if (messageRows.error) throw messageRows.error
			const receipts=await allConversationRows(app.supabase.from('thread_admin_read').select('thread_id,last_message_id').eq('admin_id',request.admin.id).order('thread_id'))
            if(receipts.error) throw receipts.error
            const readByThread=new Map((receipts.data||[]).map(r=>[String(r.thread_id),r.last_message_id]))
            const messagesByThread = new Map()
			for (const message of messageRows.data || []) {
				const group=messagesByThread.get(String(message.thread_id))||[];group.push(message);messagesByThread.set(String(message.thread_id),group)
			}
			const arApps = await app.supabase.from('ar_development').select('application_id').in('ar_development_id', threadRows.filter(t => t.ar_development_id).map(t => t.ar_development_id).concat([0]))
			if (arApps.error) throw arApps.error
			const applicationIds = [...new Set([...threadRows.filter(thread => thread.application_id).map(thread => thread.application_id), ...(arApps.data || []).map(d => d.application_id)])]
			const stallApplicationIds = threadRows.filter(thread => thread.s_application_id).map(thread => thread.s_application_id)
			const arDevelopmentIds = threadRows.filter(thread => thread.ar_development_id).map(thread => thread.ar_development_id)
			const [applications, stallApplications, developments, malls] = await Promise.all([
				applicationIds.length ? app.supabase.from('application').select('application_id, mall_id, application_version, application_attempt').in('application_id', applicationIds) : { data: [], error: null },
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
			const conversationGroups=new Map()
            for(const thread of threadRows){
              const application=applicationById.get(thread.application_id)
              const key=application?.application_version!=null?`application:${application.mall_id}:${application.application_version}`:`thread:${thread.thread_id}`
              if(!conversationGroups.has(key))conversationGroups.set(key,[])
              conversationGroups.get(key).push(thread)
            }
            return [...conversationGroups.values()].map(group => {
                const thread=group.reduce((latest,t)=>Number(applicationById.get(t.application_id)?.application_attempt||1)>Number(applicationById.get(latest.application_id)?.application_attempt||1)?t:latest,group[0])
                const allMessages=group.flatMap(t=>messagesByThread.get(String(t.thread_id))||[])
				const summary=summarizeMessages(allMessages,request.admin.id,0)
                const unread=group.map(t=>summarizeMessages(messagesByThread.get(String(t.thread_id))||[],request.admin.id,readByThread.get(String(t.thread_id))||0))
                summary.unreadCount=unread.reduce((n,s)=>n+s.unreadCount,0);summary.unread=summary.unreadCount>0
                const preview=unread.filter(s=>s.unread).sort((a,b)=>new Date(b.time)-new Date(a.time))[0]||summarizeMessages(allMessages,request.admin.id,Number.MAX_SAFE_INTEGER)
                summary.preview=preview.preview
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
					...summary,
                    time:summary.time||thread.thread_created_at,
					path: source.path,
				}
			}).filter(thread => thread.mallName !== 'Unknown mall').sort((a,b)=>Number(b.unread)-Number(a.unread)||new Date(b.time)-new Date(a.time)||Number(b.latestMessageId)-Number(a.latestMessageId))
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Conversation list failed')
			return reply.code(500).send({ message: 'Unable to load conversations.' })
		}
	})

    app.post('/api/conversations/:id/read',{schema:{params:{type:'object',required:['id'],properties:{id:{type:'integer',minimum:1}}},body:{type:'object',additionalProperties:false,required:['messageId'],properties:{messageId:{type:'integer',minimum:1,maximum:9007199254740991}}}}},async(request,reply)=>{
        const result=await app.supabase.rpc('mark_admin_thread_read',{p_admin:request.admin.id,p_thread:Number(request.params.id),p_message:request.body.messageId})
        if(result.error) return reply.code(result.error.code==='22023'?400:500).send({message:'Unable to mark conversation read.'})
        return {read:true}
    })

	app.get('/api/applications/:id', async (request, reply) => {
		const detail = await applicationDetails(app.supabase, Number(request.params.id), request)
		if (!detail) return reply.code(404).send({ message: 'Application not found.' })
    if(request.query.historyId!==undefined){
      const id=Number(request.query.historyId)
      if(!Number.isSafeInteger(id)||id<1)return reply.code(400).send({message:'Invalid review history ID.'})
      const record=await historyRecord(app.supabase,Number(request.params.id),id)
      if(!record)return reply.code(404).send({message:'Review history not found.'})
      return historyDetails(app.supabase,detail,record,normalizeDay)
    }
		return detail
	})


 const idSchema = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } }
 const actionBody = { type: 'object', additionalProperties: false, properties: { notes: { type: 'string', maxLength: 10000 }, target: { type: 'string', enum: ['node_mapping','testing','ready'] } } }
 for (const name of ['accept','reject','approve','revision']) {
  app.route({ method: name === 'revision' ? 'PATCH' : 'POST', url: `/api/applications/:id/${name}`, schema: { params: idSchema, ...(name === 'approve' ? {} : { body: actionBody }) }, handler: async (request, reply) => {
   const notes = request.body?.notes?.trim() || ''
   if (name === 'reject' && !notes) return reply.code(400).send({ message: 'A rejection explanation is required.' })
   if (name === 'accept') {
    const a = await app.supabase.from('application').select('mall_id').eq('application_id', request.params.id).single()
    if (a.error) return reply.code(404).send({ message: 'Application not found.' })
    const [floors, plans] = await Promise.all([
     app.supabase.from('floor').select('floor_id').eq('mall_id', a.data.mall_id),
     app.supabase.from('application_floor_plan').select('floor_id').eq('application_id', request.params.id),
    ])
    if (floors.error || plans.error) throw floors.error || plans.error
    const actual = plans.data.map(p => String(p.floor_id))
    if (actual.length !== floors.data.length || new Set(actual).size !== actual.length || floors.data.some(f => !actual.includes(String(f.floor_id)))) return reply.code(409).send({ message: 'A request needs exactly one plan for every existing floor.' })
   }
   return action(app.supabase, request.params.id, request.admin.id, name, notes)
  } })
 }
 async function changeAR(request, reply, target) {
  const d = await app.supabase.from('ar_development').select('application_id,ar_development_status').eq('ar_development_id', request.params.id).maybeSingle()
  if (d.error) throw d.error
  if (!d.data) return reply.code(404).send({ message: 'AR development not found.' })
  if (request.routeOptions.url.endsWith('/change-status') && !({ testing: ['node_mapping'], ready: ['testing','node_mapping'] }[d.data.ar_development_status] || []).includes(target)) return reply.code(409).send({ message: 'Change Status only permits backward moves.' })
  await action(app.supabase, d.data.application_id, request.admin.id, 'ar_status', '', target)
  return { message: 'AR status updated.' }
 }
 app.post('/api/ar-developments/:id/start-mapping', { schema: { params: idSchema } }, (request, reply) => changeAR(request, reply, 'node_mapping'))
 app.post('/api/ar-developments/:id/change-status', { schema: { params: idSchema, body: { ...actionBody, required: ['target'] } } }, (request, reply) => changeAR(request, reply, request.body.target))
 app.post('/api/ar-developments/:id/submit-testing', { schema: { params: idSchema } }, (request, reply) => changeAR(request, reply, 'testing'))
 app.post('/api/ar-developments/:id/mark-ready', { schema: { params: idSchema } }, (request, reply) => changeAR(request, reply, 'ready'))
 app.post('/api/ar-developments/:id/publish', { schema: { params: idSchema } }, request => arService(app.supabase).tryPublish(request.params.id, request.admin.id))

	app.get('/api/ar-developments/:id/thread', async (request, reply) => {
    const permission=await threadWriteState(app.supabase,request.admin.id,'ar',Number(request.params.id))
		const result = await app.supabase.from('thread').select('thread_id').eq('ar_development_id', Number(request.params.id)).order('thread_id').limit(1).maybeSingle()
		if (result.error) throw result.error
		if (!result.data) return { threadId: null, messages: [] }
		const messages = await app.supabase.from('thread_message').select('*').eq('thread_id', result.data.thread_id).order('message_sent_at')
		if (messages.error) throw messages.error
		return { threadReadOnly:permission.readOnly,threadId: result.data.thread_id, messages: await serializeMessages(app.supabase, messages.data || []) }
	})

	app.post('/api/ar-developments/:id/thread', { bodyLimit: 30 * 1024 * 1024 }, async (request, reply) => {
		const id = Number(request.params.id)
		const dev = await app.supabase.from('ar_development').select('application_id').eq('ar_development_id', id).single()
		if (dev.error) return reply.code(404).send({ message: 'AR development not found.' })
		await assertThreadWritable(app.supabase, dev.data.application_id, id, request.admin.id)
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
		let thread = await app.supabase.from('thread').select('thread_id').eq('ar_development_id', id).order('thread_id').limit(1).maybeSingle()
		if (thread.error) throw thread.error
		if (!thread.data) return reply.code(409).send({ message: 'The AR thread is available after Ready.' })
		const message = await app.supabase.from('thread_message').insert({ message_sender_type: 'admin', message_sent_at: now(), message_content: content || '', thread_id: thread.data.thread_id, message_sender: request.admin.id }).select('*').single()
		if (message.error) throw message.error
		for (const attachment of parsedAttachments) {
			const fileName = String(attachment.fileName || `image-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_')
			const path = `threads/${thread.data.thread_id}/messages/${message.data.message_id}/${require('crypto').randomUUID()}-${fileName}`
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
		const application = await app.supabase.from('application').select('mall_id').eq('application_id', dev.data.application_id).single()
		if (application.error) throw application.error
		await recordAudit(app.supabase, request, { module: 'ar_development', action: 'ar_thread_message_sent', mallId: application.data.mall_id, targetType: 'ar_development', targetId: id, targetName: `AR Development #${id}`, details: 'Sent an AR development thread message.', metadata: { messageId: message.data.message_id, attachmentCount: parsedAttachments.length } })
		return (await serializeMessages(app.supabase, [message.data], parsedAttachments.length > 0))[0]
	})

 app.get('/api/applications/:id/review-history/:historyId/plans/:floorId',{schema:{params:{type:'object',required:['id','historyId','floorId'],properties:{id:{type:'integer',minimum:1},historyId:{type:'integer',minimum:1},floorId:{type:'integer',minimum:1}}}}},async(request,reply)=>{
  const result=await historyPlan(app.supabase,Number(request.params.id),Number(request.params.historyId),Number(request.params.floorId))
  return result||reply.code(404).send({message:'Historical floor plan not found.'})
 })
 app.get('/api/applications/:id/state',async(request,reply)=>{
  const a=await app.supabase.from('application').select('*').eq('application_id',Number(request.params.id)).maybeSingle()
  if(a.error)throw a.error
  if(!a.data)return reply.code(404).send({message:'Application not found.'})
  const [dev,latest,service]=await Promise.all([
   app.supabase.from('ar_development').select('ar_development_status,ar_development_ready_at,ar_development_id').eq('application_id',a.data.application_id).order('ar_development_id',{ascending:false}).limit(1),
   app.supabase.from('application').select('application_id,application_version,application_attempt,application_status,application_accepted_at').eq('mall_id',a.data.mall_id).order('application_version',{ascending:false}).order('application_attempt',{ascending:false}),
   mapUpdateState(app.supabase,a.data.application_id),
  ])
  for(const result of [dev,latest])if(result.error)throw result.error
  const d=dev.data?.[0],s=service,readOnly=latest.data?.[0]?.application_id!==a.data.application_id||['live','unpublished'].includes(d?.ar_development_status)
  return {threadReadOnly:threadIsSuperseded(latest.data||[],a.data),versions:latest.data,reviewHistory:await reviewHistory(app.supabase,(latest.data||[]).map(v=>v.application_id)),applicationStatus:titleCase(a.data.application_status),updatedAt:a.data.application_updated_at,disputeCount:a.data.application_dispute_count,readOnly,canRevise:!readOnly&&!d?.ar_development_ready_at&&(a.data.application_status==='submitted'||(a.data.application_status==='approved'&&['pending','node_mapping','testing'].includes(d?.ar_development_status))),arDevelopmentId:d?.ar_development_id||null,mapUpdate:s?{...s,changedFloors:s.inputs?.floorIds?.length||0}:null}
 })
	app.get('/api/applications/:id/thread', async (request, reply) => {
    const permission=await threadWriteState(app.supabase,request.admin.id,'application',Number(request.params.id))
		const result = await applicationThreads(app.supabase,permission)
		if (result.error) throw result.error
		if (!result.data?.length) return { threadReadOnly:permission.readOnly,threadId: null, messages: [] }
		const messages = await app.supabase.from('thread_message').select('*').in('thread_id', result.data.map(t => t.thread_id)).order('message_sent_at')
		if (messages.error) throw messages.error
		return { threadReadOnly:permission.readOnly,threadId: result.data[0].thread_id, messages: await serializeMessages(app.supabase, messages.data || []) }
	})

	app.post('/api/applications/:id/thread', { bodyLimit: 30 * 1024 * 1024 }, async (request, reply) => {
		const id = Number(request.params.id)
		await assertThreadWritable(app.supabase, id, null, request.admin.id)
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
		const ensured = await app.supabase.rpc('ensure_application_thread', { p_application: id })
		if (ensured.error) throw ensured.error
		const thread = { data: { thread_id: ensured.data } }
		const message = await app.supabase.from('thread_message').insert({ message_sender_type: 'admin', message_sent_at: now(), message_content: content || '', thread_id: thread.data.thread_id, message_sender: request.admin.id }).select('*').single()
		if (message.error) throw message.error
		for (const attachment of parsedAttachments) {
			const fileName = String(attachment.fileName || `image-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_')
			const path = `threads/${thread.data.thread_id}/messages/${message.data.message_id}/${require('crypto').randomUUID()}-${fileName}`
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
		const application = await app.supabase.from('application').select('mall_id,application_version').eq('application_id', id).single()
		if (application.error) throw application.error
		await recordAudit(app.supabase, request, { module: 'application_management', action: 'application_thread_message_sent', mallId: application.data.mall_id, targetType: 'application', targetId: id, targetName: `Application v${application.data.application_version}`, details: 'Sent an application thread message.', metadata: { messageId: message.data.message_id, attachmentCount: parsedAttachments.length } })
		return (await serializeMessages(app.supabase, [message.data], parsedAttachments.length > 0))[0]
	})

	app.get('/api/application-floor-plans/:id/url', async (request, reply) => {
  const plan=await app.supabase.from('application_floor_plan').select('app_floor_plan_storage_path,app_floor_plan_image,app_floor_plan_file_name').eq('app_floor_plan_id',Number(request.params.id)).single()
  if(plan.error||!plan.data)return reply.code(404).send({message:'Floor plan not found.'})
  return {url:await floorPlanImageUrl(app.supabase,plan.data,300),fileName:plan.data.app_floor_plan_file_name||'floor-plan'}
	})
}
async function assertThreadWritable(supabase, applicationId, arId, actorId) {
 const state=await threadWriteState(supabase,actorId,arId?'ar':'application',arId||applicationId)
 if(state.readOnly){const error=new Error('A newer version or attempt exists. This thread is read-only.');error.statusCode=409;throw error}
 if(arId){
  const t=await supabase.from('thread').select('thread_id').eq('ar_development_id',arId).maybeSingle()
  if(t.error)throw t.error
  if(!t.data){const error=new Error('The AR thread has not been created yet.');error.statusCode=409;throw error}
 }
}

module.exports.serializeMessages = serializeMessages
