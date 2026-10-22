const fail = message => { const error = new Error(message); error.statusCode = 400; throw error }
const uuid = value => { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail('Invalid request reference.'); return value }
const text = (value, max, required = true) => {
 if (value == null && !required) return null
 if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail('Invalid inquiry field.')
 return value.trim() || null
}
function conversion(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid conversion.')
 const data = {}
 for (const [key,max,required] of [['name',100,true],['province',50,true],['city',50,true],['address',2000,true],['zipCode',10,false],['description',3000,false],['mallCoverageArea',150,false]]) data[key] = text(input[key],max,required)
 for (const [key,min,max] of [['floors',1,100],['majorBeacons',0,65535]]) {
  if (!Number.isInteger(input[key]) || input[key]<min || input[key]>max) fail(`Invalid ${key}.`)
  data[key]=input[key]
 }
 for (const [key,max] of [['latitude',90],['longitude',180]]) {
  if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || Math.abs(input[key])>max) fail(`Invalid ${key}.`)
  data[key]=input[key]
 }
 if (!Array.isArray(input.floorDetails) || input.floorDetails.length !== data.floors) fail('Configure each floor.')
 const numbers = new Set()
 data.floorDetails=input.floorDetails.map(f=>{
  if (!f || typeof f !== 'object' || Array.isArray(f) || f.floorNo === '' || f.floorNo == null) fail('Invalid floor details.')
  const n=Number(f.floorNo)
  if (!Number.isInteger(n) || n < -20 || n > 300 || numbers.has(n)) fail('Floor numbers must be unique.')
  numbers.add(n); return {floorNo:n,label:text(f.label,100)}
 })
 if (!Array.isArray(input.operatingHours) || input.operatingHours.length>7) fail('Invalid operating hours.')
 const days=new Set()
 data.operatingHours=input.operatingHours.map(h=>{
  if (!h || typeof h !== 'object' || Array.isArray(h)) fail('Invalid operating hours.')
  if (!Array.isArray(h.days) || !h.days.length || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close)) fail('Invalid operating hours.')
  for (const d of h.days) { if (!['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(d) || days.has(d)) fail('Duplicate or invalid operating day.'); days.add(d) }
  return {days:h.days,open:h.open,close:h.close}
 })
 if (input.logoDataUrl) {
  const match=typeof input.logoDataUrl==='string' && input.logoDataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) fail('Use a PNG or JPEG mall logo.')
  const bytes=Buffer.from(match[2],'base64')
  const valid=match[1]==='png' ? bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) : bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))
  if (!valid || bytes.length>2*1024*1024) fail('Use a PNG or JPEG mall logo up to 2 MB.')
  data.logoBase64=bytes.toString('base64')
 }
 return data
}
module.exports={uuid,text,conversion,fail}
