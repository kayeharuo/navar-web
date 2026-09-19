const BRAND_STORE_KEY = 'navar.brands'

export function readStoredBrands() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BRAND_STORE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeStoredBrands(brands) {
  try {
    localStorage.setItem(BRAND_STORE_KEY, JSON.stringify(brands))
  } catch {
    // Local persistence is a fallback only.
  }
}

export function makeLocalBrand(data, existing = null) {
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return {
    id: existing?.id || `local-${Date.now()}`,
    name: data.name,
    category: data.category,
    description: data.description || '',
    logo: data.logo || existing?.logo || null,
    dateAdded: existing?.dateAdded || now,
    lastUpdated: now,
  }
}
