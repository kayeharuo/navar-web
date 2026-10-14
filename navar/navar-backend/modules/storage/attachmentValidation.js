'use strict'

const THREAD_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_THREAD_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_THREAD_IMAGES_PER_MESSAGE = 5
const MAX_THREAD_TOTAL_BYTES = 20 * 1024 * 1024
const MAX_FLOOR_PLAN_BYTES = 10 * 1024 * 1024

function parseImageDataUrl(value) {
	const match = typeof value === 'string' && value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/i)
	if (!match) return null
	const buffer = Buffer.from(match[2], 'base64')
	const signatures = {
		'image/png': buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
		'image/jpeg': buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
		'image/webp': buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
	}
	if (!signatures[match[1].toLowerCase()]) return null
	return { mimeType: match[1].toLowerCase(), buffer, size: buffer.length }
}

module.exports = {
	THREAD_IMAGE_MIME_TYPES,
	MAX_THREAD_IMAGE_BYTES,
	MAX_THREAD_IMAGES_PER_MESSAGE,
	MAX_THREAD_TOTAL_BYTES,
	MAX_FLOOR_PLAN_BYTES,
	parseImageDataUrl,
}
