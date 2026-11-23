export function emailTypeLabel(type) {
  const words = String(type || '').replace(/[_-]+/g, ' ').trim()
  const acronyms = new Set(['ar', 'csv', 'sla'])
  return words.split(/\s+/).map(word => acronyms.has(word.toLowerCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}
