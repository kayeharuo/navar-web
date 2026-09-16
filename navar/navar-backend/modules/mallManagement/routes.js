const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

function isClosedNow(open, close) {
	if (!open || !close) return true
	const current = new Date()
	const currentMinutes = current.getHours() * 60 + current.getMinutes()
	const [openHour, openMinute] = open.split(':').map(Number)
	const [closeHour, closeMinute] = close.split(':').map(Number)
	const openMinutes = openHour * 60 + openMinute
	const closeMinutes = closeHour * 60 + closeMinute
	return currentMinutes < openMinutes || currentMinutes >= closeMinutes
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
		logo: brand.BRAND_LOGO ? `/api/brands/${brand.BRAND_ID}/logo` : null,
		dateAdded: formatDate(brand.BRAND_CREATED_AT),
		lastUpdated: formatDate(brand.BRAND_UPDATED_AT),
	}
}

function mallAgreementStatus(contractStatus) {
	return !contractStatus ? 'Pending' : contractStatus
}

function createMallService(supabase) {
	async function getMall(mallId) {
		const [mallResult, floorsResult, hoursResult, contractResult, beaconResult] = await Promise.all([
			supabase.from('mall').select('*').eq(dbColumn('MALL_ID'), mallId).single(),
			supabase.from('floor').select('*').eq(dbColumn('MALL_ID'), mallId).order(dbColumn('FLOOR_NUM')),
			supabase.from('operating_hours').select('*').eq(dbColumn('MALL_ID'), mallId).eq(dbColumn('OPTHRS_IS_MALL'), true).order(dbColumn('OPTHRS_ID')),
			supabase.from('contract').select('*, subscription_tier(s_tier_label, s_tier_key)').eq(dbColumn('MALL_ID'), mallId).eq(dbColumn('CONTRACT_IS_CURRENT'), true).maybeSingle(),
			supabase.from('beacon').select('*').eq(dbColumn('MALL_ID'), mallId).order(dbColumn('BEACON_ID')),
		])

		const mall = upperKeys(mallResult.data)
		const floors = upperKeys(floorsResult.data)
		const hours = upperKeys(hoursResult.data)
		const contract = upperKeys(contractResult.data)
		const status = mallAgreementStatus(contract?.CONTRACT_STATUS)
		const hasSubscription = Boolean(contract) && status !== 'Pending'
		const applicationResult = hasSubscription
			? await supabase.from('application').select('application_id, application_status').eq(dbColumn('MALL_ID'), mallId).order(dbColumn('APPLICATION_VERSION'), { ascending: false }).limit(1).maybeSingle()
			: { data: null, error: null }
		const application = upperKeys(applicationResult.data)
		const arDevelopmentResult = hasSubscription && application?.APPLICATION_ID
			? await supabase.from('ar_development').select('ar_development_status, ar_development_version').eq('application_id', application.APPLICATION_ID).order('ar_development_version', { ascending: false }).limit(1).maybeSingle()
			: { data: null, error: null }
		const arDevelopment = upperKeys(arDevelopmentResult.data)
		const floorIds = floors.map(floor => floor.FLOOR_ID)
		const beaconRows = upperKeys(beaconResult.data)
		const batteryResult = beaconRows.length
			? await supabase.from('battery').select('*').in('beacon_id', beaconRows.map(beacon => beacon.BEACON_ID)).order('battery_id')
			: { data: [], error: null }
		const batteries = upperKeys(batteryResult.data)
		const unitsResult = floorIds.length
			? await supabase.from('unit').select('*').in('floor_id', floorIds).order('unit_label')
			: { data: [], error: null }
		const units = upperKeys(unitsResult.data)
		const failed = [mallResult, floorsResult, hoursResult, contractResult, applicationResult, arDevelopmentResult, beaconResult, batteryResult, unitsResult].find(result => result.error)
		if (failed) throw failed.error
		const tier = contract?.SUBSCRIPTION_TIER?.S_TIER_LABEL || 'Pending'
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
			description: mall.MALL_DESCRIPTION,
			majorBeacons: mall.MALL_BEACON_MAJOR,
			floors: mall.MALL_FLOOR_COUNT,
			floorDetails: floors.map(floor => ({ floorNo: String(floor.FLOOR_NUM), label: floor.FLOOR_LABEL })),
			operatingHours: hours.reduce((groups, hour) => {
				const existing = groups.find(group => group.open === hour.OPTHRS_OPEN_TIME && group.close === hour.OPTHRS_CLOSE_TIME)
				if (existing) existing.days.push(hour.OPTHRS_DAY_OF_WEEK)
				else groups.push({ days: [hour.OPTHRS_DAY_OF_WEEK], open: hour.OPTHRS_OPEN_TIME?.slice(0, 5), close: hour.OPTHRS_CLOSE_TIME?.slice(0, 5) })
				return groups
			}, []),
			agreementStatus: status,
			tier,
			application: hasSubscription ? application?.APPLICATION_STATUS || '-' : '-',
			arDevelopment: hasSubscription ? arDevelopment?.AR_DEVELOPMENT_STATUS || '-' : '-',
			dateAdded: formatDate(mall.MALL_CREATED_AT),
			lastUpdated: formatDate(mall.MALL_UPDATED_AT),
			note: ['Grace Period', 'Suspended'].includes(status) && overdueDays > 0 ? `${overdueDays} days overdue` : null,
			units: units.map(unit => {
				const floor = floors.find(item => item.FLOOR_ID === unit.FLOOR_ID)
				return { id: unit.UNIT_ID, floorId: unit.FLOOR_ID, floorNo: String(floor?.FLOOR_NUM ?? ''), unitNo: unit.UNIT_LABEL, status: unit.UNIT_STATUS?.toLowerCase() || 'vacant', isActive: true, storeId: unit.STORE_ID }
			}),
			storesCount: new Set(units.map(unit => unit.STORE_ID).filter(Boolean)).size,
			beaconCount: beaconRows.length,
			beacons: beaconRows.map(beacon => {
				const floor = floors.find(item => item.FLOOR_ID === beacon.FLOOR_ID)
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
					numNodes: beacon.BEACON_NODE_COUNT,
					status: beacon.BEACON_STATUS?.toLowerCase() || 'placed',
					dateInstalled: beacon.BEACON_INSTALLED_AT?.slice(0, 10),
					lastMaintenanceDate: beacon.BEACON_MAINTAINED_AT?.slice(0, 10),
					batteryHistory: history,
					nodeConfig: [],
					nodeConfigDisplay: '—',
				}
			}),
			arMaxVersion: Number(arDevelopment?.AR_DEVELOPMENT_VERSION || 1),
			logoUrl: mall.MALL_LOGO ? `/api/malls/${mall.MALL_ID}/logo` : null,
		}
	}

	async function saveMall(request, reply, mallId = null) {
		const payload = request.body || {}
		const timestamp = now()
		const mallData = {
			MALL_NAME: payload.name,
			MALL_STATE: payload.province,
			MALL_CITY: payload.city,
			MALL_ZIPCODE: payload.zipCode || null,
			MALL_ADDRESS: payload.address,
			MALL_FLOOR_COUNT: Number(payload.floors),
			MALL_DESCRIPTION: payload.description || null,
			MALL_BEACON_MAJOR: Number(payload.majorBeacons),
			MALL_UPDATED_AT: timestamp,
		}
		if (payload.logoDataUrl) mallData.MALL_LOGO = toByteaHex(payload.logoDataUrl)
		if (!mallId) {
			mallData.MALL_CREATED_AT = timestamp
			if (!mallData.MALL_LOGO) return reply.code(400).send({ message: 'A mall logo is required.' })
		}

		const mallResult = mallId
			? await supabase.from('mall').update(lowerKeys(mallData)).eq(dbColumn('MALL_ID'), mallId).select(dbColumn('MALL_ID')).single()
			: await supabase.from('mall').insert(lowerKeys(mallData)).select(dbColumn('MALL_ID')).single()
		if (mallResult.error) return reply.code(400).send({ message: mallResult.error.message })
		const id = mallId || upperKeys(mallResult.data).MALL_ID

		const floorRows = (payload.floorDetails || []).map((floor, index) => ({
			FLOOR_NUM: Number(floor.floorNo) || index + 1,
			FLOOR_LABEL: floor.label,
			FLOOR_CREATED_AT: timestamp,
			FLOOR_UPDATED_AT: timestamp,
			MALL_ID: id,
		}))
		if (mallId) {
			const floorDelete = await supabase.from('floor').delete().eq(dbColumn('MALL_ID'), id)
			const hoursDelete = await supabase.from('operating_hours').delete().eq(dbColumn('MALL_ID'), id).eq(dbColumn('OPTHRS_IS_MALL'), true)
			if (floorDelete.error || hoursDelete.error) return reply.code(500).send({ message: (floorDelete.error || hoursDelete.error).message })
		}
		if (floorRows.length) {
			const floors = await supabase.from('floor').insert(floorRows.map(lowerKeys))
			if (floors.error) return reply.code(400).send({ message: floors.error.message })
		}
		const hourRows = (payload.operatingHours || []).flatMap(schedule => schedule.days.map(day => ({
			OPTHRS_DAY_OF_WEEK: day,
			OPTHRS_OPEN_TIME: schedule.open,
			OPTHRS_CLOSE_TIME: schedule.close,
			OPTHRS_IS_CLOSED: isClosedNow(schedule.open, schedule.close),
			OPTHRS_IS_MALL: true,
			OPTHRS_IS_STORE: false,
			MALL_ID: id,
		})))
		if (hourRows.length) {
			const hours = await supabase.from('operating_hours').insert(hourRows.map(lowerKeys))
			if (hours.error) return reply.code(400).send({ message: hours.error.message })
		}
		return reply.code(mallId ? 200 : 201).send(await getMall(id))
	}

	return { getMall, saveMall }
}

async function registerMallManagementRoutes(app) {
	const service = createMallService(app.supabase)

	app.get('/api/malls', async (request, reply) => {
		const { data, error } = await app.supabase.from('mall').select(dbColumn('MALL_ID')).order(dbColumn('MALL_NAME'))
		if (error) return reply.code(500).send({ message: error.message })
		try {
			return await Promise.all(data.map(mall => service.getMall(upperKeys(mall).MALL_ID)))
		} catch (error) {
			request.log.error(error, 'Could not load malls')
			return reply.code(500).send({ message: error.message })
		}
	})

	app.get('/api/malls/:id', async (request, reply) => {
		try {
			return await service.getMall(request.params.id)
		} catch (error) {
			return reply.code(error.code === 'PGRST116' ? 404 : 500).send({ message: error.message })
		}
	})

	app.get('/api/malls/:id/logo', async (request, reply) => {
		const { data, error } = await app.supabase.from('mall').select('mall_logo').eq('mall_id', request.params.id).single()
		if (error) return reply.code(error.code === 'PGRST116' ? 404 : 500).send({ message: error.message })
		const image = logoBuffer(data.mall_logo)
		if (!image) return reply.code(404).send({ message: 'Mall logo not found.' })
		return reply.header('Content-Type', imageContentType(image)).header('Cache-Control', 'private, max-age=300').send(image)
	})

	app.post('/api/malls', (request, reply) => service.saveMall(request, reply))
	app.put('/api/malls/:id', (request, reply) => service.saveMall(request, reply, request.params.id))

	async function saveBeacon(request, reply, beaconId = null) {
		try {
			const mall = await service.getMall(request.params.id)
			const payload = request.body || {}
			const floor = mall.floorDetails.find(item => String(item.floorNo) === String(payload.floorNo))
			if (!floor) return reply.code(400).send({ message: 'The selected floor does not belong to this mall.' })
			const floorRow = await app.supabase.from('floor').select('floor_id').eq('mall_id', request.params.id).eq('floor_num', Number(payload.floorNo)).single()
			if (floorRow.error) throw floorRow.error
			const timestamp = now()
			const existingBeacons = (await app.supabase.from('beacon').select('beacon_code')).data || []
			const prefix = mallCodePrefix(mall.name)
			const beaconCode = beaconId ? payload.beaconCode : nextScopedCode(existingBeacons, 'beacon_code', prefix, 'BCN')
			const beaconData = {
				beacon_code: beaconCode,
				beacon_label: String(payload.label || '').trim(),
				beacon_minor: Number(payload.minor),
				beacon_tx_power: Number(payload.txPower ?? -30),
				beacon_status: String(payload.status || 'placed').toLowerCase(),
				beacon_location: String(payload.location || '').trim(),
				beacon_node_count: Number(payload.numNodes || 0),
				beacon_installed_at: usableTimestamp(payload.dateInstalled, timestamp),
				beacon_maintained_at: usableTimestamp(payload.lastMaintenanceDate, usableTimestamp(payload.dateInstalled, timestamp)),
				mall_id: request.params.id,
				floor_id: floorRow.data.floor_id,
			}
			const beaconResult = beaconId
				? await app.supabase.from('beacon').update(beaconData).eq('beacon_id', beaconId).eq('mall_id', request.params.id).select('beacon_id').single()
				: await app.supabase.from('beacon').insert(beaconData).select('beacon_id').single()
			if (beaconResult.error) throw beaconResult.error
			const savedBeaconId = beaconId || beaconResult.data.beacon_id
			if (!beaconId) {
				const batteryRows = (await app.supabase.from('battery').select('battery_code')).data || []
				const batteryCode = nextScopedCode(batteryRows, 'battery_code', prefix, 'BAT')
				const batteryResult = await app.supabase.from('battery').insert({
					battery_code: batteryCode,
					battery_brand: payload.batteryBrand || 'Unspecified',
					battery_status: 'current',
					battery_installed_at: usableTimestamp(payload.batteryInstallDate, usableTimestamp(payload.dateInstalled, timestamp)),
					battery_replaced_at: null,
					beacon_id: savedBeaconId,
				})
				if (batteryResult.error) throw batteryResult.error
			}
			return reply.code(beaconId ? 200 : 201).send((await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(savedBeaconId)))
		} catch (error) {
			return reply.code(400).send({ message: error.message })
		}
	}

	app.post('/api/malls/:id/beacons', (request, reply) => saveBeacon(request, reply))
	app.put('/api/malls/:id/beacons/:beaconId', (request, reply) => saveBeacon(request, reply, request.params.beaconId))

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
			return updated
		} catch (error) {
			return reply.code(400).send({ message: error.message })
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
			return (await service.getMall(request.params.id)).beacons.find(beacon => String(beacon.id) === String(request.params.beaconId))
		} catch (error) {
			return reply.code(400).send({ message: error.message })
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
			return (await service.getMall(request.params.id)).units
		} catch (error) { return reply.code(500).send({ message: error.message }) }
	})

	app.get('/api/brands', async (request, reply) => {
		const { data, error } = await app.supabase.from('brand').select('*').order('brand_name')
		if (error) return reply.code(500).send({ message: error.message })
		return data.map(toBrand)
	})

	app.get('/api/brands/:id/logo', async (request, reply) => {
		const { data, error } = await app.supabase.from('brand').select('brand_logo').eq('brand_id', request.params.id).single()
		if (error) return reply.code(error.code === 'PGRST116' ? 404 : 500).send({ message: error.message })
		if (typeof data.brand_logo === 'string' && data.brand_logo.startsWith('data:')) return reply.redirect(data.brand_logo)
		const image = logoBuffer(data.brand_logo)
		if (!image) return reply.code(404).send({ message: 'Brand logo not found.' })
		return reply.header('Content-Type', imageContentType(image)).header('Cache-Control', 'private, max-age=300').send(image)
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
		if (result.error) return reply.code(400).send({ message: result.error.message })
		return reply.code(brandId ? 200 : 201).send(toBrand(result.data))
	}
	app.post('/api/brands', (request, reply) => saveBrand(request, reply))
	app.put('/api/brands/:id', (request, reply) => saveBrand(request, reply, request.params.id))
}

module.exports = registerMallManagementRoutes
