const { test } = require('node:test')
const assert = require('node:assert/strict')
const Fastify = require('fastify')

test('beacon tickets tolerate unassigned floors and tickets without a beacon', async () => {
  const rows = {
    beacon_ticket: [
      { ticket_id: 1, beacon_id: 2, mall_id: 12, ticket_current_status: 'faulty', ticket_reported_at: '2026-11-24T00:00:00Z' },
      { ticket_id: 3, beacon_id: null, mall_id: 12, ticket_current_status: 'pending', ticket_reported_at: '2026-11-24T00:00:00Z' },
    ],
    beacon: [{ beacon_id: 2, beacon_code: 'BCN-002', mall_id: 12, floor_id: null }],
    mall: [{ mall_id: 12, mall_name: 'Mall' }], admin: [], beacon_ticket_log: [],
  }
  const app = Fastify()
  app.decorate('supabase', { from(table) {
    assert.notEqual(table, 'floor', 'null floors must not produce a bigint lookup')
    const query = {
      select() { return query }, order() { return query },
      in(column, values) { assert.ok(values.every(value => value != null), `${column} contains null`); return query },
      then(resolve, reject) { return Promise.resolve({ data: rows[table] || [], error: null }).then(resolve, reject) },
    }
    return query
  } })
  require('../modules/mallManagement/routes')(app)
  try {
    const response = await app.inject('/api/beacon-tickets')
    assert.equal(response.statusCode, 200)
    const tickets = response.json()
    assert.equal(tickets.length, 2)
    assert.equal(tickets[0].floor, 'Not assigned')
    assert.equal(tickets[1].beaconCode, 'Not assigned')
    assert.equal(tickets[1].mall, 'Mall')
  } finally { await app.close() }
})
