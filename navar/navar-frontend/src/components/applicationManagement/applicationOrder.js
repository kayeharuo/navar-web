// Keep version history adjacent while showing the most recently submitted mall first.
export function sortApplicationsByMall(applications) {
  const submitted = row => Date.parse(row.submittedAt || row.submittedDate) || 0
  const groups = new Map()
  for (const row of applications) {
    const key = String(row.mallId ?? row.mallName)
    if (!groups.has(key)) groups.set(key, { key, newest: 0, rows: [] })
    const group = groups.get(key)
    group.newest = Math.max(group.newest, submitted(row))
    group.rows.push(row)
  }
  return [...groups.values()]
    .sort((a, b) => b.newest - a.newest || a.key.localeCompare(b.key))
    .flatMap(group => group.rows.sort((a, b) =>
      Number(b.version || 0) - Number(a.version || 0)
      || Number(b.attempt || 1) - Number(a.attempt || 1)
      || submitted(b) - submitted(a)
      || (Number(b.id) || 0) - (Number(a.id) || 0)))
}
