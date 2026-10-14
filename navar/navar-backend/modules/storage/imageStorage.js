'use strict'

const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || 'navar-images'

function dataUrlToBuffer(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null
  const match = value.match(/^data:([^;]+);base64,(.+)$/s)
  if (!match) return null
  return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] }
}

function bufferFromStored(value) {
  if (!value) return null
  if (Buffer.isBuffer(value)) return { buffer: value, contentType: null }
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return dataUrlToBuffer(value)
    if (value.startsWith('\\x')) return { buffer: Buffer.from(value.slice(2), 'hex'), contentType: null }
    return { buffer: Buffer.from(value, 'base64'), contentType: null }
  }
  if (Array.isArray(value)) return { buffer: Buffer.from(value), contentType: null }
  if (value.type === 'Buffer' && Array.isArray(value.data)) return { buffer: Buffer.from(value.data), contentType: null }
  return null
}

function contentTypeFromBuffer(buffer) {
  if (!buffer) return 'application/octet-stream'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'image/gif'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return 'application/octet-stream'
}

async function uploadImage(supabase, path, image) {
  const parsed = dataUrlToBuffer(image)
  if (!parsed) return null
  const result = await supabase.storage.from(IMAGE_BUCKET).upload(path, parsed.buffer, {
    contentType: parsed.contentType,
    upsert: true,
  })
  if (result.error) throw result.error
  return path
}

async function uploadStoredImage(supabase, path, value) {
  const parsed = bufferFromStored(value)
  if (!parsed?.buffer?.length) return null
  const result = await supabase.storage.from(IMAGE_BUCKET).upload(path, parsed.buffer, {
    contentType: parsed.contentType || contentTypeFromBuffer(parsed.buffer),
    upsert: true,
  })
  if (result.error) throw result.error
  return path
}

async function downloadImage(supabase, path) {
  const result = await supabase.storage.from(IMAGE_BUCKET).download(path)
  if (result.error) throw result.error
  return Buffer.from(await result.data.arrayBuffer())
}

async function signedImageUrl(supabase, path, expiresIn = 3600) {
  const result = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, expiresIn)
  if (result.error) throw result.error
  return result.data.signedUrl
}

module.exports = { IMAGE_BUCKET, dataUrlToBuffer, bufferFromStored, contentTypeFromBuffer, uploadImage, uploadStoredImage, downloadImage, signedImageUrl }
