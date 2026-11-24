const { loadBeaconContext, validateNodeConfig } = require('./beaconAssignments')
const { recordAudit } = require('../auditLog/routes')
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const fullDayNames = { mon: 'Monday', tue: 'Tuesday', tues: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const normalizeDayName = value => fullDayNames[String(value || '').trim().toLowerCase()] || dayNames.find(day => day.toLowerCase() === String(value || '').trim().toLowerCase()) || value
const displayStatus = value => String(value || '-').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
const { uploadImage, downloadImage, contentTypeFromBuffer } = require('../storage/imageStorage')

const dbColumn = value => value.toLowerCase()
const lowerKeys = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key.toLowerCase(), value]))
const upperKeys = value => {
	if (Array.isArray(value)) return value.map(upperKeys)
	if (!value || typeof value !== 'object') return value
	return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.toUpperCase(), upperKeys(item)]))
}

function now() {
	return new Date().toISOString()
}

function usableTimestamp(value, fallback) {
	return value && value !== '—' ? value : fallback
}

function toByteaHex(dataUrl) {
	if (!dataUrl || typeof dataUrl !== 'string') return null
	const encoded = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
	return `\\x${Buffer.from(encoded, 'base64').toString('hex')}`
}

function formatDate(value) {
	return value ? new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null
}

function logoBuffer(value) {
	if (!value) return null
	if (Buffer.isBuffer(value)) return value
	if (typeof value === 'string') {
		if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex')
		return Buffer.from(value, 'base64')
	}
	if (Array.isArray(value)) return Buffer.from(value)
	if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)
	return null
}

function imageContentType(buffer) {
	if (!buffer) return 'application/octet-stream'
	if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
	if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
	if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'image/gif'
	if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
	return 'application/octet-stream'
}

function brandLogoUrl(brand) {
	if (!brand?.BRAND_ID || (!brand.BRAND_LOGO_PATH && !brand.BRAND_LOGO)) return null
	const version = encodeURIComponent(brand.BRAND_UPDATED_AT || brand.BRAND_CREATED_AT || '')
	return `/api/brands/${brand.BRAND_ID}/logo?v=${version}`
}

function mallCodePrefix(name) {
	const words = String(name || 'MALL').toUpperCase().match(/[A-Z0-9]+/g) || ['MALL']
	const prefix = words.slice(0, 3).map(word => word[0]).join('')
	return prefix || 'MALL'
}

function nextScopedCode(rows, field, prefix, suffix) {
	const pattern = new RegExp(`^${prefix}-${suffix}-(\\d+)$`, 'i')
	const next = rows.reduce((highest, row) => {
		const match = pattern.exec(row[field] || '')
		return Math.max(highest, match ? Number(match[1]) : 0)
	}, 0) + 1
	return `${prefix}-${suffix}-${String(next).padStart(4, '0')}`
}

function toBrand(row) {
	const brand = upperKeys(row)
	return {
		id: brand.BRAND_ID,
		name: brand.BRAND_NAME,
		category: brand.BRAND_CATEGORY || '',
		description: brand.BRAND_DESCRIPTION || '',
		logo: brandLogoUrl(brand),
		dateAdded: formatDate(brand.BRAND_CREATED_AT),
		lastUpdated: formatDate(brand.BRAND_UPDATED_AT),
	}
}

function toStore(row, brand, units) {
	const store = upperKeys(row)
	const assignedUnits = units.filter(unit => String(unit.STORE_ID ?? unit.storeId) === String(store.STORE_ID))
	return {
		id: store.STORE_ID,
		storeName: store.STORE_NAME,
		storeType: store.STORE_TYPE || 'store',
		unitNos: assignedUnits.map(unit => unit.UNIT_LABEL ?? unit.unitNo),
		floorLabel: assignedUnits[0]?.FLOOR_LABEL ?? assignedUnits[0]?.floorLabel ?? '',
		brandId: store.BRAND_ID,
		brand: brand?.BRAND_NAME || '',
		brandLogo: brandLogoUrl(brand),
		category: brand?.BRAND_CATEGORY || '',
		contactPerson: store.STORE_CONTACT_PERSON || '',
		contactNo: store.STORE_CONTACT_NUM || '',
		email: store.STORE_EMAIL || '',
		status: store.STORE_STATUS === 'inactive' ? 'unmapped' : store.STORE_STATUS || 'unmapped',
		description: store.STORE_DESCRIPTION || '',
		active: store.STORE_STATUS !== 'inactive',
		dateAdded: formatDate(store.STORE_CREATED_AT),
		lastUpdated: formatDate(store.STORE_UPDATED_AT),
	}
}

function mallAgreementStatus(contractStatus) {
	return !contractStatus || String(contractStatus).toLowerCase() === 'pending' ? 'Onboarding' : displayStatus(contractStatus)
}

function createMallService(supabase) {
	async function getMall(mallId) {
		const [mallResult, floorsResult, hoursResult, contractResult, beaconResult, storesResult,capacityResult] = await Promise.all([
			supabase.from('mall').select('*').eq(dbColumn('MALL_ID'), mallId).single(),
			supabase.from('floor').select('*').eq(dbColumn('MALL_ID'), mallId).order(dbColumn('FLOOR_NUM')),
			supabase.from('operating_hours').select('*').eq(dbColumn('MALL_ID'), mallId).or('opthrs_is_store.eq.false,opthrs_is_store.is.null').eq(dbColumn('OPTHRS_IS_INQUIRY'), false).order(dbColumn('OPTHRS_ID')),
			supabase.from('contract').select('*, subscription_tier(s_tier_label, s_tier_key)').eq(dbColumn('MALL_ID'), mallId).eq(dbColumn('CONTRACT_IS_CURRENT'), true).maybeSingle(),
			supabase.from('beacon').select('*').eq(dbColumn('MALL_ID'), mallId).order(dbColumn('BEACON_ID')),
			supabase.from('store').select('*').eq(dbColumn('MALL_ID'), mallId),
			supabase.rpc('mall_capacity_state',{p_mall:Number(mallId)}),
		])

		const initialFailure = [mallResult, floorsResult, hoursResult, contractResult, beaconResult, storesResult,capacityResult].find(result => result.error)
		if (initialFailure) throw initialFailure.error
		const mall = upperKeys(mallResult.data)
		const capacity=capacityResult.data||{}
		const quoteFloors=Array.isArray(capacity.quoteFloors)?capacity.quoteFloors:[]
		const floors = upperKeys(floorsResult.data || [])
		const hours = upperKeys(hoursResult.data || [])
		const contract = upperKeys(contractResult.data)
		const status = mallAgreementStatus(contract?.CONTRACT_STATUS)
		const hasSubscription = Boolean(contract) && !['Pending', 'Onboarding'].includes(status)
		const applicationResult = await supabase.from('application').select('application_id, application_status, application_version, application_attempt').eq(dbColumn('MALL_ID'), mallId).order('application_version', { ascending: false }).order('application_attempt', { ascending: false }).order('application_id', { ascending: false }).limit(1).maybeSingle()
		const application = upperKeys(applicationResult.data)
		const arDevelopmentResult = await supabase.from('ar_development')
			.select('ar_development_id, ar_development_status, ar_development_version, application!inner(mall_id)')
			.eq('application.mall_id', mallId)
			.order('ar_development_version', { ascending: false }).order('ar_development_id', { ascending: false }).limit(1).maybeSingle()
		const arDevelopment = upperKeys(arDevelopmentResult.data)
		const floorIds = floors.map(floor => floor.FLOOR_ID)
		const beaconRows = upperKeys(beaconResult.data || [])
		const beaconContext = await loadBeaconContext(supabase, mallId, beaconRows.map(beacon => beacon.BEACON_ID))
		const batteryResult = beaconRows.length
			? await supabase.from('battery').select('*').in('beacon_id', beaconRows.map(beacon => beacon.BEACON_ID)).order('battery_id')
			: { data: [], error: null }
		const batteries = upperKeys(batteryResult.data || [])
		const unitsResult = floorIds.length
			? await supabase.from('unit').select('*').in('floor_id', floorIds).order('unit_label')
			: { data: [], error: null }
		const units = upperKeys(unitsResult.data || [])
		const failed = [applicationResult, arDevelopmentResult, batteryResult, unitsResult].find(result => result.error)
		if (failed) throw failed.error
		const ticketRowsResult = beaconRows.length
			? await supabase.from('beacon_ticket').select('*').in('beacon_id', beaconRows.map(beacon => beacon.BEACON_ID)).order('ticket_reported_at', { ascending: true })
			: { data: [], error: null }
		const ticketRows = upperKeys(ticketRowsResult.data || [])
		const ticketLogsResult = ticketRows.length
			? await supabase.from('beacon_ticket_log').select('*').in('ticket_id', ticketRows.map(ticket => ticket.TICKET_ID)).order('ticket_log_changed_at', { ascending: true })
			: { data: [], error: null }
		const ticketLogs = upperKeys(ticketLogsResult.data || [])
		const ticketAdminIds = [...new Set([
			...ticketRows.map(ticket => ticket.TICKET_REPORTED_BY),
			...ticketRows.map(ticket => ticket.TICKET_ASSIGNED_TO),
			...ticketLogs.map(log => log.TICKET_LOG_CHANGED_BY),
		].filter(Boolean))]
		const ticketAdminsResult = ticketAdminIds.length
			? await supabase.from('admin').select('admin_id, admin_full_name').in('admin_id', ticketAdminIds)
			: { data: [], error: null }
		const ticketAdmins = upperKeys(ticketAdminsResult.data || [])
		const adminName = id => ticketAdmins.find(admin => String(admin.ADMIN_ID) === String(id))?.ADMIN_FULL_NAME || `Admin #${id}`
		if (ticketRowsResult.error || ticketLogsResult.error || ticketAdminsResult.error) throw ticketRowsResult.error || ticketLogsResult.error || ticketAdminsResult.error
		const tier = hasSubscription ? contract?.SUBSCRIPTION_TIER?.S_TIER_LABEL || 'Pending' : 'Not subscribed'
		const overdueDays = contract?.CONTRACT_END && new Date(contract.CONTRACT_END) < new Date()
			? Math.ceil((Date.now() - new Date(contract.CONTRACT_END).getTime()) / 86400000)
			: 0

		return {
			id: mall.MALL_ID,
			name: mall.MALL_NAME,
			city: mall.MALL_CITY,
			province: mall.MALL_STATE,
			zipCode: mall.MALL_ZIPCODE,
			address: mall.MALL_ADDRESS,
			barangay: mall.MALL_BARANGAY,
			latitude: mall.MALL_LATITUDE,
			longitude: mall.MALL_LONGITUDE,
			description: mall.MALL_DESCRIPTION,
			majorBeacons: mall.MALL_BEACON_MAJOR,
			floors: mall.MALL_FLOOR_COUNT || quoteFloors.length,
			storeCount: capacity.storeCount ?? mall.QUOTED_STORE_COUNT ?? null,
			tenantCount: capacity.tenantCount ?? mall.QUOTED_TENANT_COUNT ?? null,
			storeCapacity: capacity.totalCapacity ?? null,
			onboardingQuoteId: capacity.quoteId ?? null,
			approvedExtraStalls: capacity.approvedExtraStalls || 0,
			initialPreferredTier: mall.INITIAL_TIER_KEY ? mall.INITIAL_TIER_KEY[0].toUpperCase() + mall.INITIAL_TIER_KEY.slice(1) : '',
			floorDetails: floors.length?floors.map(floor => ({ id: floor.FLOOR_ID, floorNo: String(floor.FLOOR_NUM), label: floor.FLOOR_LABEL, floorAreaSqm: String(floor.FLOOR_AREA_SQM ?? quoteFloors.find(f=>Number(f.floorNum)===Number(floor.FLOOR_NUM))?.areaSqm ?? '') })):quoteFloors.map((floor,index)=>({floorNo:String(floor.floorNum??index+1),label:`Floor ${floor.floorNum??index+1}`,floorAreaSqm:String(floor.areaSqm??'')})),
			operatingHours: hours.reduce((groups, hour) => {
				const existing = groups.find(group => group.open === hour.OPTHRS_OPEN_TIME && group.close === hour.OPTHRS_CLOSE_TIME && group.closed === hour.OPTHRS_IS_CLOSED)
				if (existing) existing.days.push(hour.OPTHRS_DAY_OF_WEEK)
				else groups.push({ days: [hour.OPTHRS_DAY_OF_WEEK], open: hour.OPTHRS_OPEN_TIME?.slice(0, 5), close: hour.OPTHRS_CLOSE_TIME?.slice(0, 5), closed: hour.OPTHRS_IS_CLOSED })
				return groups
			}, []),
			agreementStatus: status,
			tier,
			application: displayStatus(application?.APPLICATION_STATUS),
			applicationVersion: application?.APPLICATION_VERSION ?? null,
			arDevelopment: displayStatus(arDevelopment?.AR_DEVELOPMENT_STATUS),
			arDevelopmentVersion: arDevelopment?.AR_DEVELOPMENT_VERSION ?? null,
			dateAdded: formatDate(mall.MALL_CREATED_AT),
			createdAt: mall.MALL_CREATED_AT,
			lastUpdated: formatDate(mall.MALL_UPDATED_AT),
			note: ['Grace Period', 'Suspended'].includes(status) && overdueDays > 0 ? `${overdueDays} days overdue` : null,
			units: units.map(unit => {
				const floor = floors.find(item => item.FLOOR_ID === unit.FLOOR_ID)
				return { id: unit.UNIT_ID, floorId: unit.FLOOR_ID, floorNo: String(floor?.FLOOR_NUM ?? ''), floorLabel: floor?.FLOOR_LABEL || '', unitNo: unit.UNIT_LABEL, status: unit.STORE_ID == null ? 'vacant' : unit.UNIT_STATUS?.toLowerCase() || 'occupied', isActive: true, storeId: unit.STORE_ID }
			}),
			storesCount: upperKeys(storesResult.data || []).filter(store => store.STORE_STATUS !== 'inactive').length,
			unitsCount: units.length,
			beaconCount: beaconRows.length,
			beacons: beaconRows.map(beacon => {
				const floor = floors.find(item => item.FLOOR_ID === beacon.FLOOR_ID)
				const beaconTickets = ticketRows.filter(ticket => ticket.BEACON_ID === beacon.BEACON_ID)
				const history = batteries.filter(battery => battery.BEACON_ID === beacon.BEACON_ID).map(battery => ({
					id: battery.BATTERY_ID,
					batteryId: battery.BATTERY_CODE,
					status: battery.BATTERY_STATUS?.toLowerCase() || 'current',
					installDate: battery.BATTERY_INSTALLED_AT?.slice(0, 10),
					replacedDate: battery.BATTERY_REPLACED_AT?.slice(0, 10) || null,
					brand: battery.BATTERY_BRAND,
				}))
				return {
					id: beacon.BEACON_ID,
					beaconCode: beacon.BEACON_CODE,
					floorNo: String(floor?.FLOOR_NUM ?? ''),
					floorLabel: floor?.FLOOR_LABEL || '',
					floorId: beacon.FLOOR_ID,
					location: beacon.BEACON_LOCATION,
					label: beacon.BEACON_LABEL,
					major: mall.MALL_BEACON_MAJOR,
					minor: beacon.BEACON_MINOR,
					txPower: beacon.BEACON_TX_POWER,
					numNodes: beaconContext.assignments.filter(item => item.beacon_id === beacon.BEACON_ID).length,
					status: beacon.BEACON_STATUS?.toLowerCase() || 'placed',
					dateInstalled: beacon.BEACON_INSTALLED_AT?.slice(0, 10),
					lastMaintenanceDate: beacon.BEACON_MAINTAINED_AT?.slice(0, 10),
					batteryHistory: history,
					ticketHistory: beaconTickets.map(ticket => ({
						id: ticket.TICKET_ID,
						ticketId: `TKT-${String(ticket.TICKET_ID).padStart(4, '0')}`,
						status: ticket.TICKET_CURRENT_STATUS?.toLowerCase() || 'faulty',
						reason: ticket.TICKET_ISSUE || '',
						note: ticketLogs.find(log => log.TICKET_ID === ticket.TICKET_ID)?.TICKET_LOG_NOTES || '',
						assignedTo: ticket.TICKET_ASSIGNED_TO ? adminName(ticket.TICKET_ASSIGNED_TO) : null,
						dateFiled: ticket.TICKET_REPORTED_AT,
						dateResolved: ticketLogs.filter(log => log.TICKET_ID === ticket.TICKET_ID && log.TICKET_LOG_STATUS.toLowerCase().includes('resolved')).at(-1)?.TICKET_LOG_CHANGED_AT || null,
						timeline: ticketLogs.filter(log => log.TICKET_ID === ticket.TICKET_ID).map(log => ({
							id: log.TICKET_LOG_ID,
							date: new Date(log.TICKET_LOG_CHANGED_AT).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
							action: log.TICKET_LOG_STATUS,
							source: 'admin',
							by: adminName(log.TICKET_LOG_CHANGED_BY),
							note: log.TICKET_LOG_NOTES || null,
						})),
					})),
					nodeConfig: beaconContext.assignments.filter(item => item.beacon_id === beacon.BEACON_ID).map(item => ({ versionId: item.ar_development_id, nodeId: item.node_id })),
					nodeConfigDisplay: beaconContext.assignments.filter(item => item.beacon_id === beacon.BEACON_ID).map(item => `${beaconContext.versions.find(version => version.id === item.ar_development_id)?.name || 'Version'}: ${item.node_id}`).join('; ') || '-',
				}
			}),
			arVersions: beaconContext.versions,
			nodes: beaconContext.nodes.map(node => ({ ...node, floorLabel: floors.find(floor => floor.FLOOR_ID === node.floorId)?.FLOOR_LABEL || '' })),
			logoUrl: mall.MALL_LOGO_PATH || mall.MALL_LOGO ? `/api/malls/${mall.MALL_ID}/logo` : null,
		}
	}

	async function saveMall(request, reply, mallId = null) {
		const payload = request.body || {}
		if (!payload.barangay?.trim()) return reply.code(400).send({ message: 'Barangay is required.' })
		const timestamp = now()
		const requestedFloorCount = Number(payload.floors)
		const requestedFloors = Array.isArray(payload.floorDetails) ? payload.floorDetails : []
		if (!Number.isInteger(requestedFloorCount) || requestedFloorCount < 1 || requestedFloors.length !== requestedFloorCount) {
			return reply.code(400).send({ message: 'The floor count must match the configured floor details.' })
		}
		if(requestedFloors.some(f=>!Number.isFinite(Number(f.floorAreaSqm))||Number(f.floorAreaSqm)<=0))return reply.code(400).send({message:'Each floor must have an area greater than zero.'})
		const capacityState=mallId?await supabase.rpc('mall_capacity_state',{p_mall:Number(mallId)}):{data:null}
		if(capacityState.error)throw capacityState.error
		const configuredStores=Number(payload.storeCount??capacityState.data?.storeCount),configuredTenants=Number(payload.tenantCount??capacityState.data?.tenantCount)
		if(!Number.isSafeInteger(configuredStores)||configuredStores<1||!Number.isSafeInteger(configuredTenants)||configuredTenants<0||configuredTenants>configuredStores)return reply.code(400).send({message:'Enter a positive store count and a tenant count from zero to the store count.'})
		if(capacityState.data?.quoteId&&(configuredStores!==capacityState.data.storeCount||configuredTenants!==capacityState.data.tenantCount))return reply.code(409).send({message:'Store and tenant counts are defined by the linked onboarding quote. Request an approved expansion to increase capacity.'})
		if(mallId){const used=await supabase.from('store').select('store_id',{count:'exact',head:true}).eq('mall_id',mallId).or('store_status.neq.inactive,store_status.is.null');if(used.error)throw used.error;if(used.count>configuredStores+Number(capacityState.data?.approvedExtraStalls||0))return reply.code(409).send({message:'The store capacity cannot be lower than the current total of active stores and stalls.'})}
		const mallData = {
			MALL_NAME: payload.name,
			MALL_STATE: payload.province,
			MALL_CITY: payload.city,
			MALL_ZIPCODE: payload.zipCode || null,
			MALL_ADDRESS: payload.address,
			MALL_BARANGAY: payload.barangay?.trim() || null,
			MALL_LATITUDE: payload.latitude == null ? null : Number(payload.latitude),
			MALL_LONGITUDE: payload.longitude == null ? null : Number(payload.longitude),
			MALL_FLOOR_COUNT: requestedFloorCount,
			QUOTED_STORE_COUNT: configuredStores,
			QUOTED_TENANT_COUNT: configuredTenants,
			MALL_DESCRIPTION: payload.description || null,
			MALL_BEACON_MAJOR: Number(payload.majorBeacons),
			MALL_UPDATED_AT: timestamp,
			INITIAL_TIER_KEY: payload.agreementType ? String(payload.agreementType).toLowerCase() : null,
		}
		if (mallData.MALL_BEACON_MAJOR < 1 || !Number.isInteger(mallData.MALL_BEACON_MAJOR)) return reply.code(400).send({ message: 'Beacon major must be a positive integer.' })
		let majorQuery = supabase.from('mall').select('mall_id').eq('mall_beacon_major', mallData.MALL_BEACON_MAJOR)
		if (mallId) majorQuery = majorQuery.neq('mall_id', mallId)
		const majorConflict = await majorQuery.limit(1)
		if (majorConflict.error) throw majorConflict.error
		if (majorConflict.data?.length) return reply.code(400).send({ message: 'This beacon major is already assigned to another mall.' })
		let existingFloors = []
		let removableFloorIds = []
		if (mallId) {
			const existingFloorResult = await supabase.from('floor').select('floor_id, floor_num, floor_label').eq(dbColumn('MALL_ID'), mallId).order(dbColumn('FLOOR_NUM'))
			if (existingFloorResult.error) throw existingFloorResult.error
			existingFloors = existingFloorResult.data || []
			const surplusFloors = existingFloors.slice(requestedFloorCount)
			if (surplusFloors.length) {
				const surplusIds = surplusFloors.map(floor => floor.floor_id)
				const dependencyChecks = [
					['unit', 'floor_id'], ['beacon', 'floor_id'], ['node', 'floor_id'],
					['application_floor_plan', 'floor_id'], ['application_entry_point', 'floor_id'],
					['floor_calibration', 'floor_id'], ['stall', 'floor_id'], ['stall_floor_plan', 'floor_id'],
					['store', 'onboarding_floor_id'],
				].map(([table, column]) => supabase.from(table).select(column).in(column, surplusIds).limit(1))
				const dependencyResults = await Promise.all(dependencyChecks)
				const dependencyError = dependencyResults.find(result => result.error)?.error
				if (dependencyError) throw dependencyError
				if (dependencyResults.some(result => result.data?.length)) {
					const labels = surplusFloors.map(floor => floor.floor_label || `Floor ${floor.floor_num}`).join(', ')
					return reply.code(409).send({ message: `Cannot reduce the floor count because these floors still contain mall data: ${labels}. Remove their units, beacons, maps, and related records first.` })
				}
				removableFloorIds = surplusIds
			}
		}
		if (payload.logoDataUrl) {
			mallData.MALL_LOGO = toByteaHex(payload.logoDataUrl)
		}
		if (!mallId) {
			mallData.MALL_CREATED_AT = timestamp
			if (!mallData.MALL_LOGO) return reply.code(400).send({ message: 'A mall logo is required.' })
		}

		const mallResult = mallId
			? await supabase.from('mall').update(lowerKeys(mallData)).eq(dbColumn('MALL_ID'), mallId).select(dbColumn('MALL_ID')).single()
			: await supabase.from('mall').insert(lowerKeys(mallData)).select(dbColumn('MALL_ID')).single()
		if (mallResult.error) { request.log.error({ code: mallResult.error.code }, 'Mall save failed'); return reply.code(400).send({ message: 'Unable to save mall.' }) }
		const id = mallId || upperKeys(mallResult.data).MALL_ID
		if (payload.logoDataUrl) {
			const logoPath = `malls/${id}/logo`
			try {
				await uploadImage(supabase, logoPath, payload.logoDataUrl)
				const pathResult = await supabase.from('mall').update({ mall_logo_path: logoPath }).eq('mall_id', id)
				if (pathResult.error) throw pathResult.error
			} catch (storageError) {
				request.log.error({ message: storageError.message }, 'Mall logo storage upload failed; keeping database image')
			}
		}

		const floorRows = requestedFloors.map((floor, index) => ({
			FLOOR_NUM: Number(floor.floorNo) || index + 1,
			FLOOR_LABEL: floor.label,
			FLOOR_AREA_SQM: Number(floor.floorAreaSqm),
			FLOOR_CREATED_AT: timestamp,
			FLOOR_UPDATED_AT: timestamp,
			MALL_ID: id,
		}))
		if (floorRows.some(floor => !Number.isFinite(floor.FLOOR_AREA_SQM) || floor.FLOOR_AREA_SQM <= 0)) {
			return reply.code(400).send({ message: 'Each floor must have an area greater than zero.' })
		}
		if (mallId) {
			const hoursDelete = await supabase.from('operating_hours').delete().eq(dbColumn('MALL_ID'), id).or('opthrs_is_store.eq.false,opthrs_is_store.is.null').eq(dbColumn('OPTHRS_IS_INQUIRY'), false)
			if (hoursDelete.error) {
				const failure = hoursDelete.error
				request.log.error({ code: failure.code, message: failure.message, details: failure.details }, 'Mall cleanup failed')
				return reply.code(500).send({ message: 'Unable to save mall.' })
			}
		}
		for (let index = 0; index < floorRows.length; index += 1) {
			const floor = floorRows[index]
			const result = existingFloors[index]
				? await supabase.from('floor').update({
					floor_num: floor.FLOOR_NUM,
					floor_label: floor.FLOOR_LABEL,
					floor_area_sqm: floor.FLOOR_AREA_SQM,
					floor_updated_at: floor.FLOOR_UPDATED_AT,
				}).eq('floor_id', existingFloors[index].floor_id)
				: await supabase.from('floor').insert(lowerKeys(floor))
			if (result.error) {
				request.log.error({ code: result.error.code, message: result.error.message, details: result.error.details }, 'Floor save failed')
				return reply.code(400).send({ message: 'Unable to save mall.' })
			}
		}
		if (removableFloorIds.length) {
			const removed = await supabase.from('floor').delete().in('floor_id', removableFloorIds)
			if (removed.error) {
				request.log.error({ code: removed.error.code, message: removed.error.message }, 'Unused floor removal failed')
				return reply.code(400).send({ message: 'Unable to remove the unused floors.' })
			}
		}
		const hourRows = (payload.operatingHours || []).flatMap(schedule => schedule.days.map(day => ({
			OPTHRS_DAY_OF_WEEK: normalizeDayName(day),
			OPTHRS_OPEN_TIME: schedule.closed ? null : schedule.open,
			OPTHRS_CLOSE_TIME: schedule.closed ? null : schedule.close,
			OPTHRS_IS_CLOSED: Boolean(schedule.closed),
			OPTHRS_IS_MALL: true,
			OPTHRS_IS_STORE: false,
			OPTHRS_IS_INQUIRY: false,
			INQUIRY_ID: null,
			MALL_ID: id,
		})))
		if (hourRows.length) {
			const hours = await supabase.from('operating_hours').insert(hourRows.map(lowerKeys))
			if (hours.error) { request.log.error({ code: hours.error.code }, 'Operating hours save failed'); return reply.code(400).send({ message: 'Unable to save mall.' }) }
		}
		const savedMall = await getMall(id)
		await recordAudit(supabase, request, {
			module: 'mall_management', action: mallId ? 'mall_updated' : 'mall_created', mallId: id,
			targetType: 'mall', targetId: id, targetName: savedMall.name,
			details: `${mallId ? 'Updated' : 'Created'} mall ${savedMall.name}.`, metadata: { floors: savedMall.floors, beaconMajor: savedMall.majorBeacons },
		})
		return reply.code(mallId ? 200 : 201).send(savedMall)
	}

	return { getMall, saveMall }
}

async function registerMallManagementRoutes(app) {
	const service = createMallService(app.supabase)

	async function getStoresForMall(mallId) {
		const mall = await service.getMall(mallId)
		const storesResult = await app.supabase.from('store').select('*').eq('mall_id', mallId).order('store_name')
		if (storesResult.error) throw storesResult.error
		const storeRows = upperKeys(storesResult.data || [])
		const brandIds = [...new Set(storeRows.map(store => store.BRAND_ID).filter(Boolean))]
		const brandsResult = brandIds.length
			? await app.supabase.from('brand').select('*').in('brand_id', brandIds)
			: { data: [], error: null }
		if (brandsResult.error) throw brandsResult.error
		const brands = upperKeys(brandsResult.data || [])
		return storeRows.map(store => toStore(
			store,
			brands.find(brand => String(brand.BRAND_ID) === String(store.BRAND_ID)),
			mall.units || []
		))
	}

	async function saveStoresForMall(request, reply) {
		try {
			const mallId = request.params.id
			const mall = await service.getMall(mallId)
			const payload = Array.isArray(request.body?.stores) ? request.body.stores : []
			const existingResult = await app.supabase.from('store').select('*').eq('mall_id', mallId)
			if (existingResult.error) throw existingResult.error
			const existingRows = upperKeys(existingResult.data || [])
			const existingIds = new Set(existingRows.map(store => String(store.STORE_ID)))
			const submittedIds=new Set(payload.filter(s=>s.id!=null).map(s=>String(s.id)))
			const currentActive=existingRows.filter(s=>String(s.STORE_STATUS).toLowerCase()!=='inactive').length
			const nextActive=payload.filter(s=>s.active!==false).length+existingRows.filter(s=>String(s.STORE_STATUS).toLowerCase()!=='inactive'&&!submittedIds.has(String(s.STORE_ID))).length
			if(nextActive>currentActive&&(mall.storeCapacity==null||nextActive>mall.storeCapacity))return reply.code(409).send({message:mall.storeCapacity==null?'Set the mall onboarding store capacity before adding stores or stalls.':`Store capacity reached (${mall.storeCapacity} total stores and stalls). Deactivate an existing establishment or approve additional capacity first.`})
			const validUnitByLabel = new Map((mall.units || []).map(unit => [String(unit.unitNo), unit]))
			const timestamp = now()
			const savedIds = []

			for (const store of payload) {
				const unitNos = [...new Set(Array.isArray(store.unitNos) ? store.unitNos.map(String) : [])]
				const unitRows = unitNos.map(unitNo => validUnitByLabel.get(unitNo))
				if (unitRows.some(unit => !unit)) throw new Error('Every selected unit must belong to this mall.')
				if (!store.storeName?.trim()) throw new Error('Store name is required.')
				if (!store.brandId) throw new Error('A valid brand is required.')

				const row = {
					store_name: store.storeName.trim(),
					store_unit_count: unitNos.length,
					store_contact_person: store.contactPerson?.trim() || null,
					store_contact_num: store.contactNo?.trim() || null,
					store_email: store.email?.trim() || null,
					store_status: store.active === false ? 'inactive' : store.status === 'mapped' ? 'mapped' : 'unmapped',
					store_updated_at: timestamp,
					brand_id: store.brandId,
					store_type: store.storeType === 'stall' ? 'stall' : 'store',
					store_description: store.description?.trim() || null,
					mall_id: mallId,
				}
				const storeId = store.id && existingIds.has(String(store.id)) ? String(store.id) : null
				const result = storeId
					? await app.supabase.from('store').update(row).eq('store_id', storeId).eq('mall_id', mallId).select('*').single()
					: await app.supabase.from('store').insert({ ...row, store_created_at: timestamp, store_has_cr: false }).select('*').single()
				if (result.error) throw result.error
				const savedStore = upperKeys(result.data)
				savedIds.push(savedStore.STORE_ID)
			}

			if (existingIds.size) {
				const cleared = await app.supabase.from('unit').update({ store_id: null, unit_status: 'vacant', unit_updated_at: timestamp }).in('store_id', [...existingIds])
				if (cleared.error) throw cleared.error
			}

			for (let index = 0; index < payload.length; index += 1) {
				const store = payload[index]
				if (store.active === false) continue
				const savedStoreId = savedIds[index]
				const unitIds = [...new Set((store.unitNos || []).map(String).map(unitNo => validUnitByLabel.get(unitNo)?.id).filter(Boolean))]
				if (!unitIds.length) continue
				const assigned = await app.supabase.from('unit').update({ store_id: savedStoreId, unit_status: 'occupied', unit_updated_at: timestamp }).in('unit_id', unitIds)
				if (assigned.error) throw assigned.error
			}

			const savedStores = await getStoresForMall(mallId)
			const priorById = new Map(existingRows.map(row => [String(row.STORE_ID), row]))
			for (const store of savedStores) {
				const before = priorById.get(String(store.id))
				const changed = !before || before.STORE_NAME !== store.storeName || before.STORE_STATUS !== store.status || String(before.BRAND_ID) !== String(store.brandId) || Number(before.STORE_UNIT_COUNT) !== store.unitNos.length || (before.STORE_CONTACT_PERSON || '') !== (store.contactPerson || '') || (before.STORE_CONTACT_NUM || '') !== (store.contactNo || '') || (before.STORE_EMAIL || '') !== (store.email || '')
				if (!changed) continue
				const action = !before ? 'store_created' : store.status === 'inactive' && before.STORE_STATUS !== 'inactive' ? 'store_deactivated' : 'store_updated'
				await recordAudit(app.supabase, request, { module: 'mall_management', action, mallId, targetType: 'store', targetId: store.id, targetName: store.storeName, details: `${displayStatus(action)}: ${store.storeName}.`, metadata: { before: before || null, after: store } })
			}
			return reply.send(savedStores)
		} catch (error) {
			request.log.error(error, 'Could not save stores')
			request.log.error({ code: error.code }, 'Could not save stores')
			return reply.code(400).send({ message: error.code==='P0001'&&/capacity/i.test(error.message)?error.message:'Unable to save stores.' })
		}
	}

	app.get('/api/malls/:id/stores', async (request, reply) => {
		try {
			return await getStoresForMall(request.params.id)
		} catch (error) {
			request.log.error({ code: error.code }, 'Could not load stores')
			return reply.code(500).send({ message: 'Unable to load stores.' })
		}
	})

	app.put('/api/malls/:id/stores', (request, reply) => saveStoresForMall(request, reply))

	app.get('/api/malls', async (request, reply) => {
		const { data, error } = await app.supabase.from('mall').select(dbColumn('MALL_ID')).order('mall_created_at', {ascending:false}).order('mall_id',{ascending:false})
		if (error) { request.log.error({ code: error.code }, 'Could not list malls'); return reply.code(500).send({ message: 'Unable to load malls.' }) }
		try {
			return await Promise.all(data.map(mall => service.getMall(upperKeys(mall).MALL_ID)))
		} catch (error) {
			request.log.error(error, 'Could not load malls')
			return reply.code(500).send({ message: 'Unable to load malls.' })
		}
	})

	app.get('/api/malls/:id', async (request, reply) => {
		try {
			return await service.getMall(request.params.id)
		} catch (error) {
			request.log.error({ code: error.code, message: error.message, details: error.details, hint: error.hint }, 'Could not load mall')
			return reply.code(error.code === 'PGRST116' ? 404 : 500).send({ message: 'Unable to load mall.' })
		}
	})

	app.get('/api/malls/:id/logo', { config: { rateLimit: false } }, async (request, reply) => {
		let { data, error } = await app.supabase.from('mall').select('mall_logo, mall_logo_path').eq('mall_id', request.params.id).single()
		if (error?.code === '42703') {
			const fallback = await app.supabase.from('mall').select('mall_logo').eq('mall_id', request.params.id).single()
			data = fallback.data
			error = fallback.error
		}
		if (error) { request.log.error({ code: error.code }, 'Could not load mall logo'); return reply.code(error.code === 'PGRST116' ? 404 : 500).send({ message: 'Unable to load logo.' }) }
		if (data.mall_logo_path) {
			try {
				const image = await downloadImage(app.supabase, data.mall_logo_path)
				return reply.header('Cross-Origin-Resource-Policy', 'cross-origin').header('Content-Type', contentTypeFromBuffer(image)).header('Cache-Control', 'private, max-age=300').send(image)
			} catch (storageError) { request.log.error({ message: storageError.message }, 'Could not load mall logo from storage') }
		}
		const image = logoBuffer(data.mall_logo)
		if (!image) return reply.code(404).send({ message: 'Mall logo not found.' })
		return reply.header('Cross-Origin-Resource-Policy', 'cross-origin').header('Content-Type', imageContentType(image)).header('Cache-Control', 'private, max-age=300').send(image)
	})

	app.post('/api/malls', (request, reply) => service.saveMall(request, reply))
	app.put('/api/malls/:id', (request, reply) => service.saveMall(request, reply, request.params.id))

	async function saveBeacon(request, reply, beaconId = null) {
		try {
			const mall = await service.getMall(request.params.id)
			const payload = request.body || {}
			let nodeConfig
			try { nodeConfig = validateNodeConfig(payload.nodeConfig ?? [], { versions: mall.arVersions, nodes: mall.nodes }) }
			catch (error) { return reply.code(400).send({ message: error.message }) }
			const existingAssignments = nodeConfig.length ? await app.supabase.from('beacon_node_assignment').select('node_id, beacon_id').in('node_id', nodeConfig.map(item => item.nodeId)) : { data: [], error: null }
			if (existingAssignments.error) throw existingAssignments.error
			if ((existingAssignments.data || []).some(item => String(item.beacon_id) !== String(beaconId))) return reply.code(400).send({ message: 'A selected node is already assigned to another beacon.' })
			const timestamp = now()
			const existingBeacons = (await app.supabase.from('beacon').select('beacon_code')).data || []
			const prefix = mallCodePrefix(mall.name)
			const beaconCode = beaconId ? payload.beaconCode : nextScopedCode(existingBeacons, 'beacon_code', prefix, 'BCN')
			const beaconData = {
				beacon_code: beaconCode,
				beacon_label: String(payload.label || '').trim(),
				beacon_minor: Number(payload.minor),
				beacon_tx_power: Number(payload.txPower ?? -30),
				beacon_status: mall.beacons.find(beacon => String(beacon.id) === String(beaconId))?.status || 'placed',
				beacon_location: String(payload.location || '').trim(),
				beacon_node_count: nodeConfig.length,
				beacon_installed_at: usableTimestamp(payload.dateInstalled, timestamp),
				beacon_maintained_at: usableTimestamp(payload.lastMaintenanceDate, usableTimestamp(payload.dateInstalled, timestamp)),
				mall_id: request.params.id,
				floor_id: null,
			}
			const batteryRows = !beaconId ? await app.supabase.from('battery').select('battery_code') : { data: [] }
			if (batteryRows.error) throw batteryRows.error
			const currentBattery = payload.batteryHistory?.find(battery => battery.status === 'current')
			const batteryData = {
				battery_code: !beaconId ? nextScopedCode(batteryRows.data || [], 'battery_code', prefix, 'BAT') : null,
				battery_brand: payload.batteryBrand || currentBattery?.brand || 'Unspecified',
				battery_installed_at: usableTimestamp(payload.batteryInstallDate || currentBattery?.installDate, usableTimestamp(payload.dateInstalled, timestamp)),
			}
			const beaconResult = await app.supabase.rpc('save_beacon_with_assignments', {
				p_mall_id: Number(request.params.id), p_beacon_id: beaconId ? Number(beaconId) : null,
				p_beacon: beaconData, p_assignments: nodeConfig, p_battery: batteryData,
			})
			if (beaconResult.error) throw beaconResult.error
			const savedBeaconId = beaconResult.data
			const savedBeacon = (await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(savedBeaconId))
			await recordAudit(app.supabase, request, { module: 'mall_management', action: beaconId ? 'beacon_updated' : 'beacon_created', mallId: request.params.id, targetType: 'beacon', targetId: savedBeaconId, targetName: savedBeacon.beaconCode, details: `${beaconId ? 'Updated' : 'Created'} beacon ${savedBeacon.beaconCode}.`, metadata: { floor: savedBeacon.floorNo, nodeAssignments: savedBeacon.nodeConfig, status: savedBeacon.status } })
			return reply.code(beaconId ? 200 : 201).send(savedBeacon)
		} catch (error) {
			request.log.error({ code: error.code }, 'Beacon save failed')
			return reply.code(400).send({ message: 'Unable to save beacon.' })
		}
	}

	app.post('/api/malls/:id/beacons', (request, reply) => saveBeacon(request, reply))
	app.put('/api/malls/:id/beacons/:beaconId', (request, reply) => saveBeacon(request, reply, request.params.beaconId))

	async function addTicketLog(ticketId, status, notes, adminId) {
		const result = await app.supabase.from('beacon_ticket_log').insert({
			ticket_id: ticketId,
			ticket_log_status: status,
			ticket_log_notes: notes || null,
			ticket_log_changed_at: now(),
			ticket_log_changed_by: adminId,
		})
		if (result.error) throw result.error
	}

	async function notifyMallAdminsOfTicket({ mallId, ticketId, beaconCode, status, assignedTo, actorId, actorRole }) {
		return notifyMallAdmins({
			mallId,
			sourceType: 'beacon_ticket',
			sourceId: Number(ticketId),
			sourceLabel: `Beacon ${beaconCode || `#${ticketId}`} ticket`,
			title: 'Beacon ticket status changed',
			message: `Beacon ${beaconCode || `#${ticketId}`} ticket was marked as ${status === 'maintenance' ? 'under maintenance' : status}.${assignedTo ? ` Assigned to ${assignedTo}.` : ''}`,
			actionUrl: `/mall-management/beacon-tickets?ticketId=${ticketId}`,
			actorId,
			actorRole,
		})
	}

	async function notifyMallAdmins({ mallId, sourceType, sourceId, sourceLabel, title, message, actionUrl, actionLabel = 'View details', actorId, actorRole }) {
		const recipients = await app.supabase
			.from('admin')
			.select('admin_id, admin_role, mall_id')
			.eq('admin_is_deactivated', false)
		if (recipients.error) throw recipients.error
		const recipientAdmins = (recipients.data || []).filter(admin =>
			admin.admin_role === 'mall_admin' && String(admin.mall_id) === String(mallId)
		)
		if (!recipientAdmins.length) return

		const notifications = recipientAdmins.map(recipient => ({
			admin_notif_type: sourceType === 'beacon_ticket' ? 'ticket_status_changed' : 'beacon_status_changed',
			admin_notif_title: title,
			admin_notif_message: message,
			admin_notif_action_url: actionUrl,
			admin_notif_action_label: actionLabel,
			admin_notif_source_type: sourceType,
			admin_notif_source_id: sourceId,
			admin_notif_source_label: sourceLabel,
			admin_notif_actor_id: actorId,
			admin_notif_actor_role: actorRole || 'admin',
			admin_notif_is_read: false,
			admin_notif_is_archived: false,
			admin_notif_created_at: now(),
			admin_id: recipient.admin_id,
			mall_id: mallId,
		}))
		const result = await app.supabase.from('admin_notification').insert(notifications)
		if (result.error) {
			app.log.error({
				code: result.error.code,
				message: result.error.message,
				details: result.error.details,
				hint: result.error.hint,
				mallId,
				sourceType,
				sourceId,
			}, 'Admin notification delivery failed')
		}
	}

	app.get('/api/admin-notifications', async (request, reply) => {
		try {
			const includeArchived = request.query?.includeArchived === 'true'
			const result = await app.supabase
				.from('admin_notification')
				.select('*')
				.eq('admin_id', request.admin.id)
				.eq('admin_notif_is_archived', includeArchived ? true : false)
				.order('admin_notif_created_at', { ascending: false })
			if (result.error) throw result.error
			return (result.data || []).map(notification => ({
				id: notification.admin_notif_id,
				type: notification.admin_notif_type,
				title: notification.admin_notif_title,
				message: notification.admin_notif_message,
				actionUrl: notification.admin_notif_action_url,
				actionLabel: notification.admin_notif_action_label,
				sourceType: notification.admin_notif_source_type,
				sourceId: notification.admin_notif_source_id,
				sourceLabel: notification.admin_notif_source_label,
				mallId: notification.mall_id,
				read: notification.admin_notif_is_read,
				createdAt: notification.admin_notif_created_at,
			}))
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Admin notifications load failed')
			return reply.code(500).send({ message: 'Unable to load notifications.' })
		}
	})

	app.patch('/api/admin-notifications/:id/read', async (request, reply) => {
		try {
			const result = await app.supabase
				.from('admin_notification')
				.update({ admin_notif_is_read: true, admin_notif_read_at: now() })
				.eq('admin_notif_id', request.params.id)
				.eq('admin_id', request.admin.id)
			if (result.error) throw result.error
			return reply.send({ message: 'Notification marked as read.' })
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Admin notification read update failed')
			return reply.code(500).send({ message: 'Unable to update notification.' })
		}
	})

	app.patch('/api/admin-notifications/read-all', async (request, reply) => {
		try {
			const result = await app.supabase
				.from('admin_notification')
				.update({ admin_notif_is_read: true, admin_notif_read_at: now() })
				.eq('admin_id', request.admin.id)
				.eq('admin_notif_is_archived', false)
				.eq('admin_notif_is_read', false)
			if (result.error) throw result.error
			return reply.send({ message: 'Notifications marked as read.' })
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'All admin notifications read update failed')
			return reply.code(500).send({ message: 'Unable to update notifications.' })
		}
	})

	app.patch('/api/admin-notifications/:id/archive', async (request, reply) => {
		try {
			const result = await app.supabase
				.from('admin_notification')
				.update({ admin_notif_is_archived: true })
				.eq('admin_notif_id', request.params.id)
				.eq('admin_id', request.admin.id)
			if (result.error) throw result.error
			return reply.send({ message: 'Notification archived.' })
		} catch (error) {
			request.log.error({ code: error.code, message: error.message }, 'Admin notification archive failed')
			return reply.code(500).send({ message: 'Unable to archive notification.' })
		}
	})

	app.post('/api/malls/:id/beacons/:beaconId/fault-ticket', async (request, reply) => {
		try {
			const beacon = await app.supabase.from('beacon').select('beacon_id, beacon_code, mall_id').eq('beacon_id', request.params.beaconId).eq('mall_id', request.params.id).single()
			if (beacon.error) throw beacon.error
			const { issue, description } = request.body || {}
			if (!issue?.trim() || !description?.trim()) return reply.code(400).send({ message: 'Issue and description are required.' })
			const ticketStatus = 'faulty'
			const created = await app.supabase.from('beacon_ticket').insert({
				ticket_current_status: ticketStatus,
				ticket_reported_at: now(),
				ticket_reported_by: request.admin.id,
				ticket_assigned_to: null,
				beacon_id: request.params.beaconId,
				ticket_issue: issue.trim(),
			}).select('ticket_id').single()
			if (created.error) throw created.error
			await addTicketLog(created.data.ticket_id, 'Marked as Faulty', description.trim(), request.admin.id)
			await notifyMallAdminsOfTicket({
				mallId: beacon.data.mall_id,
				ticketId: created.data.ticket_id,
				beaconCode: beacon.data.beacon_code,
				status: ticketStatus,
				actorId: request.admin.id,
				actorRole: request.admin.role,
			})
			if (ticketStatus === 'faulty') {
				const updated = await app.supabase.from('beacon').update({ beacon_status: 'faulty' }).eq('beacon_id', request.params.beaconId).eq('mall_id', request.params.id)
				if (updated.error) throw updated.error
			}
			await recordAudit(app.supabase, request, { module: 'mall_management', action: ticketStatus === 'faulty' ? 'beacon_marked_faulty' : 'beacon_ticket_created', mallId: beacon.data.mall_id, targetType: 'beacon_ticket', targetId: created.data.ticket_id, targetName: beacon.data.beacon_code, details: `${issue.trim()}: ${description.trim()}`, metadata: { beaconId: Number(request.params.beaconId), status: ticketStatus } })
			return reply.code(201).send((await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(request.params.beaconId)))
		} catch (error) {
			request.log.error({ code: error.code }, 'Beacon ticket creation failed')
			return reply.code(400).send({ message: 'Unable to create beacon ticket.' })
		}
	})

	app.post('/api/malls/:id/beacons/:beaconId/reactivate', async (request, reply) => {
		try {
			const current = await app.supabase.from('beacon').select('beacon_id, beacon_code, mall_id, beacon_status').eq('beacon_id', request.params.beaconId).eq('mall_id', request.params.id).single()
			if (current.error) throw current.error
			const remarks = request.body?.remarks?.trim()
			if (current.data.beacon_status !== 'deactivated' && !remarks) return reply.code(400).send({ message: 'Reactivation remarks are required.' })
			const active = await app.supabase.from('beacon_ticket').select('ticket_id, ticket_issue').eq('beacon_id', request.params.beaconId).neq('ticket_current_status', 'resolved').order('ticket_reported_at', { ascending: false }).limit(1).maybeSingle()
			if (active.error) throw active.error
			const updatedBeacon = await app.supabase.from('beacon').update({ beacon_status: 'placed' }).eq('beacon_id', request.params.beaconId).eq('mall_id', request.params.id)
			if (updatedBeacon.error) throw updatedBeacon.error
			if (active.data) {
				const updatedTicket = await app.supabase.from('beacon_ticket').update({ ticket_current_status: 'resolved', ticket_assigned_to: request.admin.id }).eq('ticket_id', active.data.ticket_id)
				if (updatedTicket.error) throw updatedTicket.error
				await addTicketLog(active.data.ticket_id, 'Marked as resolved', `Beacon reactivated in Beacon Management. ${remarks}`, request.admin.id)
				const beacon = await app.supabase.from('beacon').select('beacon_code, mall_id').eq('beacon_id', request.params.beaconId).single()
				if (beacon.error) throw beacon.error
				await notifyMallAdminsOfTicket({
					mallId: beacon.data.mall_id,
					ticketId: active.data.ticket_id,
					beaconCode: beacon.data.beacon_code,
					status: 'resolved',
					actorId: request.admin.id,
					actorRole: request.admin.role,
				})
			} else {
				await notifyMallAdmins({
					mallId: current.data.mall_id,
					sourceType: 'beacon',
					sourceId: Number(current.data.beacon_id),
					sourceLabel: `Beacon ${current.data.beacon_code || `#${current.data.beacon_id}`}`,
					title: 'Beacon reactivated',
					message: `Beacon ${current.data.beacon_code || `#${current.data.beacon_id}`} was reactivated.${remarks ? ` ${remarks}` : ''}`,
					actionUrl: `/mall-management/beacons/${current.data.mall_id}`,
					actionLabel: 'View beacon',
					actorId: request.admin.id,
					actorRole: request.admin.role,
				})
			}
			await recordAudit(app.supabase, request, { module: 'mall_management', action: 'beacon_reactivated', mallId: current.data.mall_id, targetType: 'beacon', targetId: current.data.beacon_id, targetName: current.data.beacon_code, details: remarks || `Reactivated beacon ${current.data.beacon_code}.`, metadata: { previousStatus: current.data.beacon_status, status: 'placed', resolvedTicketId: active.data?.ticket_id || null } })
			return reply.send((await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(request.params.beaconId)))
		} catch (error) {
			request.log.error({ code: error.code }, 'Beacon reactivation failed')
			return reply.code(400).send({ message: 'Unable to reactivate beacon.' })
		}
	})

	app.post('/api/malls/:id/beacons/:beaconId/deactivate', async (request, reply) => {
		try {
			const beacon = await app.supabase
				.from('beacon')
				.select('beacon_id, beacon_code, mall_id')
				.eq('beacon_id', request.params.beaconId)
				.eq('mall_id', request.params.id)
				.single()
			if (beacon.error) throw beacon.error
			const updated = await app.supabase
				.from('beacon')
				.update({ beacon_status: 'deactivated' })
				.eq('beacon_id', request.params.beaconId)
				.eq('mall_id', request.params.id)
				.select('*')
				.single()
			if (updated.error) throw updated.error
			await notifyMallAdmins({
				mallId: beacon.data.mall_id,
				sourceType: 'beacon',
				sourceId: Number(beacon.data.beacon_id),
				sourceLabel: `Beacon ${beacon.data.beacon_code || `#${beacon.data.beacon_id}`}`,
				title: 'Beacon deactivated',
				message: `Beacon ${beacon.data.beacon_code || `#${beacon.data.beacon_id}`} was deactivated.`,
				actionUrl: `/mall-management/beacons/${beacon.data.mall_id}`,
				actionLabel: 'View beacon',
				actorId: request.admin.id,
				actorRole: request.admin.role,
			})
			const updatedBeacon = (await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(request.params.beaconId))
			if (!updatedBeacon) return reply.code(404).send({ message: 'Beacon was updated but could not be loaded.' })
			await recordAudit(app.supabase, request, { module: 'mall_management', action: 'beacon_deactivated', mallId: beacon.data.mall_id, targetType: 'beacon', targetId: beacon.data.beacon_id, targetName: beacon.data.beacon_code, details: `Deactivated beacon ${beacon.data.beacon_code}.`, metadata: { status: 'deactivated' } })
			return reply.send(updatedBeacon)
		} catch (error) {
			request.log.error({
				code: error.code,
				message: error.message,
				details: error.details,
				hint: error.hint,
				mallId: request.params.id,
				beaconId: request.params.beaconId,
			}, 'Beacon deactivation failed')
			return reply.code(400).send({ message: 'Unable to deactivate beacon.' })
		}
	})

	app.get('/api/beacon-tickets', async (request, reply) => {
		try {
			const ticketsResult = await app.supabase.from('beacon_ticket').select('*').order('ticket_reported_at', { ascending: false })
			if (ticketsResult.error) throw ticketsResult.error
			const tickets = upperKeys(ticketsResult.data || [])
			const beaconIds = [...new Set(tickets.map(ticket => ticket.BEACON_ID).filter(id=>id!=null))]
			const [beaconsResult, adminsResult] = await Promise.all([
				beaconIds.length ? app.supabase.from('beacon').select('beacon_id, beacon_code, beacon_location, mall_id, floor_id').in('beacon_id', beaconIds) : { data: [], error: null },
				app.supabase.from('admin').select('admin_id, admin_full_name'),
			])
			if (beaconsResult.error || adminsResult.error) throw beaconsResult.error || adminsResult.error
			const beacons = upperKeys(beaconsResult.data || [])
			const admins = upperKeys(adminsResult.data || [])
			const mallIds = [...new Set([...beacons.map(beacon => beacon.MALL_ID),...tickets.map(ticket=>ticket.MALL_ID)].filter(id=>id!=null))]
			const floorIds = [...new Set(beacons.map(beacon => beacon.FLOOR_ID).filter(id=>id!=null))]
			const [mallsResult, floorsResult, logsResult] = await Promise.all([
				mallIds.length ? app.supabase.from('mall').select('mall_id, mall_name').in('mall_id', mallIds) : { data: [], error: null },
				floorIds.length ? app.supabase.from('floor').select('floor_id, floor_num, floor_label').in('floor_id', floorIds) : { data: [], error: null },
				tickets.length ? app.supabase.from('beacon_ticket_log').select('*').in('ticket_id', tickets.map(ticket => ticket.TICKET_ID)).order('ticket_log_changed_at', { ascending: true }) : { data: [], error: null },
			])
			if (mallsResult.error || floorsResult.error || logsResult.error) throw mallsResult.error || floorsResult.error || logsResult.error
			const malls = upperKeys(mallsResult.data || [])
			const floors = upperKeys(floorsResult.data || [])
			const logs = upperKeys(logsResult.data || [])
			const adminName = id => admins.find(admin => String(admin.ADMIN_ID) === String(id))?.ADMIN_FULL_NAME || `Admin #${id}`
			return tickets.map(ticket => {
				const beacon = beacons.find(item => item.BEACON_ID === ticket.BEACON_ID) || {}
				const floor = floors.find(item => item.FLOOR_ID === beacon.FLOOR_ID) || {}
				const mall = malls.find(item => item.MALL_ID === (beacon.MALL_ID??ticket.MALL_ID)) || {}
				return {
					id: ticket.TICKET_ID,
					ticketId: `TKT-${String(ticket.TICKET_ID).padStart(4, '0')}`,
					beaconCode: beacon.BEACON_CODE || 'Not assigned',
					mall: mall.MALL_NAME || 'Unknown mall',
					floor: floor.FLOOR_LABEL || (floor.FLOOR_NUM!=null?`Floor ${floor.FLOOR_NUM}`:'Not assigned'),
					location: beacon.BEACON_LOCATION,
					status: ticket.TICKET_CURRENT_STATUS?.toLowerCase() || 'faulty',
					reason: ticket.TICKET_ISSUE || '',
					description: logs.find(log => log.TICKET_ID === ticket.TICKET_ID)?.TICKET_LOG_NOTES || '',
					assignedTo: ticket.TICKET_ASSIGNED_TO ? adminName(ticket.TICKET_ASSIGNED_TO) : null,
					timeAgo: new Date(ticket.TICKET_REPORTED_AT).toLocaleString(),
					timeline: logs.filter(log => log.TICKET_ID === ticket.TICKET_ID).map(log => ({
						id: log.TICKET_LOG_ID,
						date: new Date(log.TICKET_LOG_CHANGED_AT).toLocaleString(),
						action: log.TICKET_LOG_STATUS,
						source: 'admin',
						by: adminName(log.TICKET_LOG_CHANGED_BY),
						note: log.TICKET_LOG_NOTES || null,
					})),
				}
			})
		} catch (error) {
			request.log.error({ code: error.code }, 'Beacon ticket list failed')
			return reply.code(500).send({ message: 'Unable to load beacon tickets.' })
		}
	})

	app.post('/api/beacon-tickets/:ticketId/actions', async (request, reply) => {
		try {
			const { status, note, assignedTo } = request.body || {}
			const allowed = ['faulty', 'investigating', 'maintenance', 'resolved']
			if (!allowed.includes(status)) return reply.code(400).send({ message: 'Invalid ticket status.' })
			const ticket = await app.supabase.from('beacon_ticket').select('ticket_id, beacon_id, mall_id, ticket_current_status, ticket_issue').eq('ticket_id', request.params.ticketId).single()
			if (ticket.error) throw ticket.error
			const beacon = ticket.data.beacon_id!=null?await app.supabase.from('beacon').select('beacon_id, beacon_code, mall_id').eq('beacon_id', ticket.data.beacon_id).single():{data:{mall_id:ticket.data.mall_id,beacon_code:'Service request'},error:null}
			if (beacon.error) throw beacon.error
			if (status === 'investigating' && !assignedTo) return reply.code(400).send({ message: 'Please select who to assign.' })
			let assignedAdminId = null
			if (status === 'investigating') {
				const assigned = await app.supabase.from('admin').select('admin_id').eq('admin_full_name', assignedTo).eq('admin_is_deactivated', false).maybeSingle()
				if (assigned.error || !assigned.data) return reply.code(400).send({ message: 'Please select a valid assignee.' })
				assignedAdminId = assigned.data.admin_id
			}
			const updates = { ticket_current_status: status }
			if (status === 'investigating') updates.ticket_assigned_to = assignedAdminId
			const updated = await app.supabase.from('beacon_ticket').update(updates).eq('ticket_id', request.params.ticketId)
			if (updated.error) throw updated.error
			const labels = { faulty: 'Marked as Faulty', investigating: 'Marked as Investigating', maintenance: 'Marked as Under Maintenance', resolved: 'Marked as Resolved' }
			await addTicketLog(request.params.ticketId, labels[status], note, request.admin.id)
			await notifyMallAdminsOfTicket({
				mallId: beacon.data.mall_id,
				ticketId: Number(request.params.ticketId),
				beaconCode: beacon.data.beacon_code,
				status,
				assignedTo: status === 'investigating' ? assignedTo : null,
				actorId: request.admin.id,
				actorRole: request.admin.role,
			})
			if (ticket.data.beacon_id!=null&&['faulty','maintenance','resolved'].includes(status)) {
				const updatedBeacon = await app.supabase.from('beacon').update({ beacon_status: status === 'resolved' ? 'placed' : status==='maintenance'?'maintenance':'faulty' }).eq('beacon_id', ticket.data.beacon_id)
				if (updatedBeacon.error) throw updatedBeacon.error
			}
			await recordAudit(app.supabase, request, { module: 'mall_management', action: 'beacon_ticket_status_changed', mallId: beacon.data.mall_id, targetType: 'beacon_ticket', targetId: ticket.data.ticket_id, targetName: beacon.data.beacon_code, details: `Beacon ticket changed from ${ticket.data.ticket_current_status} to ${status}.${note ? ` ${note}` : ''}`, metadata: { beaconId: ticket.data.beacon_id, from: ticket.data.ticket_current_status, to: status, assignedTo: assignedAdminId } })
			return reply.send({ message: 'Ticket updated.' })
		} catch (error) {
			request.log.error({ code: error.code }, 'Beacon ticket action failed')
			return reply.code(400).send({ message: 'Unable to update beacon ticket.' })
		}
	})

	async function getBeaconForMall(mallId, beaconId) {
		const result = await app.supabase.from('beacon').select('beacon_id').eq('beacon_id', beaconId).eq('mall_id', mallId).single()
		if (result.error) throw result.error
		return result.data
	}

	app.post('/api/malls/:id/beacons/:beaconId/batteries', async (request, reply) => {
		try {
			await getBeaconForMall(request.params.id, request.params.beaconId)
			const mall = await service.getMall(request.params.id)
			const prefix = mallCodePrefix(mall.name)
			const existing = (await app.supabase.from('battery').select('battery_code')).data || []
			const timestamp = now()
			const replaced = await app.supabase.from('battery').update({ battery_status: 'replaced', battery_replaced_at: request.body?.installDate || timestamp }).eq('beacon_id', request.params.beaconId).eq('battery_status', 'current')
			if (replaced.error) throw replaced.error
			const inserted = await app.supabase.from('battery').insert({
				battery_code: nextScopedCode(existing, 'battery_code', prefix, 'BAT'),
				battery_brand: request.body?.brand || 'Unspecified',
				battery_status: 'current',
				battery_installed_at: request.body?.installDate || timestamp,
				battery_replaced_at: null,
				beacon_id: request.params.beaconId,
			}).select('battery_id').single()
			if (inserted.error) throw inserted.error
			const updated = (await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(request.params.beaconId))
			await recordAudit(app.supabase, request, { module: 'mall_management', action: 'beacon_battery_replaced', mallId: request.params.id, targetType: 'beacon', targetId: request.params.beaconId, targetName: updated?.beaconCode, details: `Replaced the battery for beacon ${updated?.beaconCode || request.params.beaconId}.`, metadata: { batteryId: inserted.data.battery_id, brand: request.body?.brand, installDate: request.body?.installDate } })
			return updated
		} catch (error) {
			request.log.error({ code: error.code }, 'Battery creation failed')
			return reply.code(400).send({ message: 'Unable to save battery.' })
		}
	})

	app.put('/api/malls/:id/beacons/:beaconId/batteries/:batteryId', async (request, reply) => {
		try {
			await getBeaconForMall(request.params.id, request.params.beaconId)
			const result = await app.supabase.from('battery').update({
				battery_brand: request.body?.brand,
				battery_installed_at: request.body?.installDate,
			}).eq('battery_id', request.params.batteryId).eq('beacon_id', request.params.beaconId)
			if (result.error) throw result.error
			const updatedBeacon = (await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(request.params.beaconId))
			await recordAudit(app.supabase, request, { module: 'mall_management', action: 'beacon_battery_updated', mallId: request.params.id, targetType: 'battery', targetId: request.params.batteryId, targetName: updatedBeacon?.beaconCode, details: `Updated battery ${request.params.batteryId} for beacon ${updatedBeacon?.beaconCode || request.params.beaconId}.`, metadata: { brand: request.body?.brand, installDate: request.body?.installDate } })
			return updatedBeacon
		} catch (error) {
			request.log.error({ code: error.code }, 'Battery update failed')
			return reply.code(400).send({ message: 'Unable to save battery.' })
		}
	})

	app.put('/api/malls/:id/units', async (request, reply) => {
		try {
			const mall = await service.getMall(request.params.id)
			const existing = mall.units || []
			const payload = Array.isArray(request.body?.units) ? request.body.units : []
			const existingIds = new Set(existing.map(unit => String(unit.id)))
			const receivedIds = new Set(payload.filter(unit => unit.id && existingIds.has(String(unit.id))).map(unit => String(unit.id)))
			for (const unit of existing) {
				if (!receivedIds.has(String(unit.id))) {
					if (unit.status === 'occupied') return reply.code(400).send({ message: `${unit.unitNo} is occupied and cannot be removed.` })
					const removed = await app.supabase.from('unit').delete().eq('unit_id', unit.id)
					if (removed.error) throw removed.error
				}
			}
			for (const unit of payload) {
				const floor = mall.floorDetails.find(item => String(item.floorNo) === String(unit.floorNo))
				if (!floor) return reply.code(400).send({ message: `The selected floor for ${unit.unitNo || 'this unit'} does not exist.` })
				const row = { unit_label: String(unit.unitNo).trim(), unit_status: (unit.status || 'vacant').toLowerCase(), unit_updated_at: now(), floor_id: unit.floorId || mall.units.find(item => String(item.id) === String(unit.id))?.floorId || null }
				if (!row.floor_id) {
					const floorRow = (await app.supabase.from('floor').select('floor_id').eq('mall_id', request.params.id).eq('floor_num', Number(unit.floorNo)).single())
					if (floorRow.error) throw floorRow.error
					row.floor_id = floorRow.data.floor_id
				}
				const result = unit.id && existingIds.has(String(unit.id))
					? await app.supabase.from('unit').update(row).eq('unit_id', unit.id)
					: await app.supabase.from('unit').insert({ ...row, unit_created_at: now(), store_id: null })
				if (result.error) throw result.error
			}
			const savedUnits = (await service.getMall(request.params.id)).units
			const beforeById = new Map(existing.map(unit => [String(unit.id), unit]))
			const afterById = new Map(savedUnits.map(unit => [String(unit.id), unit]))
			for (const unit of existing.filter(item => !afterById.has(String(item.id)))) await recordAudit(app.supabase, request, { module: 'mall_management', action: 'unit_removed', mallId: request.params.id, targetType: 'unit', targetId: unit.id, targetName: unit.unitNo, details: `Removed unit ${unit.unitNo}.`, metadata: { before: unit } })
			for (const unit of savedUnits) {
				const before = beforeById.get(String(unit.id))
				if (before && before.unitNo === unit.unitNo && before.status === unit.status && String(before.floorId) === String(unit.floorId) && String(before.storeId || '') === String(unit.storeId || '')) continue
				await recordAudit(app.supabase, request, { module: 'mall_management', action: before ? 'unit_updated' : 'unit_created', mallId: request.params.id, targetType: 'unit', targetId: unit.id, targetName: unit.unitNo, details: `${before ? 'Updated' : 'Created'} unit ${unit.unitNo}.`, metadata: { before: before || null, after: unit } })
			}
			return savedUnits
		} catch (error) { request.log.error({ code: error.code }, 'Unit save failed'); return reply.code(500).send({ message: 'Unable to save units.' }) }
	})

	app.get('/api/brands', async (request, reply) => {
		const { data, error } = await app.supabase.from('brand').select('*').order('brand_name')
		if (error) { request.log.error({ code: error.code }, 'Brand list failed'); return reply.code(500).send({ message: 'Unable to load brands.' }) }
		return data.map(toBrand)
	})

	app.get('/api/brands/:id/logo', { config: { rateLimit: false } }, async (request, reply) => {
		const { data, error } = await app.supabase.from('brand').select('brand_logo, brand_logo_path').eq('brand_id', request.params.id).single()
		if (error) { request.log.error({ code: error.code }, 'Could not load brand logo'); return reply.code(error.code === 'PGRST116' ? 404 : 500).send({ message: 'Unable to load logo.' }) }
		if (data.brand_logo_path) {
			try {
				const image = await downloadImage(app.supabase, data.brand_logo_path)
				return reply.header('Content-Type', contentTypeFromBuffer(image)).header('Cache-Control', 'private, max-age=3600, immutable').send(image)
			} catch (storageError) { request.log.error({ message: storageError.message }, 'Could not load brand logo from storage') }
		}
		if (typeof data.brand_logo === 'string' && data.brand_logo.startsWith('data:')) return reply.redirect(data.brand_logo)
		const image = logoBuffer(data.brand_logo)
		if (!image) return reply.code(404).send({ message: 'Brand logo not found.' })
		return reply.header('Content-Type', imageContentType(image)).header('Cache-Control', 'private, max-age=3600, immutable').send(image)
	})

	async function saveBrand(request, reply, brandId = null) {
		const payload = request.body || {}
		if (!payload.name?.trim() || !payload.category) return reply.code(400).send({ message: 'Brand name and category are required.' })
		const row = { brand_name: payload.name.trim(), brand_category: payload.category, brand_description: payload.description?.trim() || null, brand_updated_at: now() }
		if (payload.logo?.startsWith('data:')) row.brand_logo = toByteaHex(payload.logo)
		if (!brandId) { row.brand_created_at = now(); if (!row.brand_logo) row.brand_logo = null }
		const result = brandId
			? await app.supabase.from('brand').update(row).eq('brand_id', brandId).select('*').single()
			: await app.supabase.from('brand').insert(row).select('*').single()
		if (result.error) { request.log.error({ code: result.error.code }, 'Brand save failed'); return reply.code(400).send({ message: 'Unable to save brand.' }) }
		if (payload.logo?.startsWith('data:')) {
			const logoPath = `brands/${brandId || result.data.brand_id}/logo-${Date.now()}`
			try {
				await uploadImage(app.supabase, logoPath, payload.logo)
				const pathResult = await app.supabase.from('brand').update({ brand_logo_path: logoPath }).eq('brand_id', brandId || result.data.brand_id)
				if (pathResult.error) throw pathResult.error
			} catch (storageError) {
				request.log.error({ message: storageError.message }, 'Brand logo storage upload failed')
				return reply.code(400).send({ message: 'Unable to save brand logo.' })
			}
		}
		const savedResult = await app.supabase.from('brand').select('*').eq('brand_id', brandId || result.data.brand_id).single()
		if (savedResult.error) throw savedResult.error
		const savedBrand = toBrand(savedResult.data)
		await recordAudit(app.supabase, request, { module: 'mall_management', action: brandId ? 'brand_updated' : 'brand_created', targetType: 'brand', targetId: savedBrand.id, targetName: savedBrand.name, details: `${brandId ? 'Updated' : 'Created'} brand ${savedBrand.name}.`, metadata: { category: savedBrand.category } })
		return reply.code(brandId ? 200 : 201).send(savedBrand)
	}
	app.post('/api/brands', (request, reply) => saveBrand(request, reply))
	app.put('/api/brands/:id', (request, reply) => saveBrand(request, reply, request.params.id))
}

module.exports = registerMallManagementRoutes
