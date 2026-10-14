'use strict'

const { uploadImage } = require('../storage/imageStorage')
const { MAX_FLOOR_PLAN_BYTES, parseImageDataUrl } = require('../storage/attachmentValidation')

function now() { return new Date().toISOString() }
function safeFileName(name) { return String(name || 'floor-plan.png').replace(/[^a-zA-Z0-9._-]/g, '-') }

module.exports = function registerApplicationTestingRoutes(app) {
	app.get('/api/testing/applications/options', async (request, reply) => {
		const [malls, floors] = await Promise.all([
			app.supabase.from('mall').select('mall_id, mall_name').order('mall_name'),
			app.supabase.from('floor').select('floor_id, floor_num, floor_label, mall_id').order('floor_id'),
		])
		if (malls.error || floors.error) return reply.code(500).send({ message: 'Unable to load malls and floors.' })
		return {
			malls: malls.data || [],
			floors: (floors.data || []).map(floor => ({
				floor_id: floor.floor_id,
				floor_num: floor.floor_num,
				floor_name: floor.floor_label,
				mall_id: floor.mall_id,
			})),
		}
	})

	app.post('/api/testing/applications', { bodyLimit: 50 * 1024 * 1024 }, async (request, reply) => {
		const body = request.body || {}
		const mallId = Number(body.mallId)
		const selectedFloors = Array.isArray(body.floors) ? body.floors : []
		if (!Number.isInteger(mallId) || !selectedFloors.length) return reply.code(400).send({ message: 'Select a mall and at least one floor.' })
		const mall = await app.supabase.from('mall').select('mall_id, mall_name').eq('mall_id', mallId).single()
		if (mall.error) return reply.code(400).send({ message: 'Selected mall was not found.' })
		const floorIds = selectedFloors.map(floor => Number(floor.floorId)).filter(Number.isInteger)
		if (floorIds.length !== selectedFloors.length) return reply.code(400).send({ message: 'Every selected floor must be valid.' })
		const floors = await app.supabase.from('floor').select('floor_id').eq('mall_id', mallId).in('floor_id', floorIds)
		if (floors.error) throw floors.error
		if ((floors.data || []).length !== new Set(floorIds).size) return reply.code(400).send({ message: 'One or more selected floors do not belong to the selected mall.' })
		if (selectedFloors.some(floor => !String(floor.referenceLine || '').trim() || Number(floor.meterLength) <= 0)) {
			return reply.code(400).send({ message: 'Each floor requires a scale reference and a positive meter length.' })
		}
		const existing = await app.supabase.from('application').select('application_version').eq('mall_id', mallId).order('application_version', { ascending: false }).limit(1)
		if (existing.error) throw existing.error
		const version = (existing.data?.[0]?.application_version || 0) + 1
		const application = await app.supabase.from('application').insert({
			application_version: version, application_status: 'submitted',
			application_created_at: now(), application_updated_at: now(), mall_id: mallId,
		}).select('application_id, application_version, application_status').single()
		if (application.error) throw application.error
		try {
			for (const floor of selectedFloors) {
				const image = floor.image
				const parsedImage = parseImageDataUrl(image?.dataUrl)
				if (!parsedImage || !['image/png', 'image/jpeg'].includes(parsedImage.mimeType)) throw new Error(`Floor ${floor.floorId} requires a valid PNG or JPEG image.`)
				if (parsedImage.size > MAX_FLOOR_PLAN_BYTES) throw new Error(`Floor ${floor.floorId} exceeds the 10 MB image limit.`)
				const fileName = safeFileName(image.fileName)
				const path = `applications/${application.data.application_id}/versions/${version}/floors/${floor.floorId}/${fileName}`
				await uploadImage(app.supabase, path, image.dataUrl)
				const plan = await app.supabase.from('application_floor_plan').insert({
					app_floor_plan_image: path, app_floor_plan_reference_line: floor.referenceLine || '',
					app_floor_plan_meter_length: Number(floor.meterLength) || 0,
					app_floor_plan_accessibility_route: floor.accessibilityRoute || '',
					app_floor_plan_emergency_route: floor.emergencyRoute || '',
					app_floor_plan_created_at: now(), app_floor_plan_updated_at: now(),
					application_id: application.data.application_id, floor_id: Number(floor.floorId),
					app_floor_plan_storage_path: path, app_floor_plan_file_name: fileName,
					app_floor_plan_mime_type: parsedImage.mimeType, app_floor_plan_file_size: parsedImage.size,
				}).select('app_floor_plan_id').single()
				if (plan.error) throw plan.error
				for (const entry of (floor.entryPoints || [])) {
					if (!entry.label?.trim()) continue
					const result = await app.supabase.from('application_entry_point').insert({
						app_entry_point_label: entry.label.trim(), app_entry_point_description: entry.description || null,
						app_entry_point_created_at: now(), app_entry_point_updated_at: now(),
						application_id: application.data.application_id, floor_id: Number(floor.floorId),
					})
					if (result.error) throw result.error
				}
			}
		} catch (error) {
			await app.supabase.from('application').delete().eq('application_id', application.data.application_id)
			request.log.error({ code: error.code, message: error.message }, 'Test application creation failed')
			return reply.code(400).send({ message: error.message || 'Unable to create test application.' })
		}
		return reply.code(201).send({ ...application.data, mallName: mall.data.mall_name })
	})
}
