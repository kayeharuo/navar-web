const test = require('node:test')
const assert = require('node:assert/strict')
const { prepareQuoteForApproval, withTier } = require('../modules/inquiries/quotes')

const now = new Date('2026-11-24T00:00:00Z')
const future = '2026-12-20T00:00:00Z', past = '2026-11-01T00:00:00Z'
const tiers = { basic: { s_tier_key: 'basic', s_tier_annual_fee: 25000 }, standard: { s_tier_key: 'standard', s_tier_annual_fee: 33000 } }
const draft = (extra = {}) => ({
 quote_id: 9, revision: 1, status: 'draft', expires_at: future, preferred_tier: 'standard', requires_review: false, mall_id: null,
 amount_cent: 7018000, raw_inputs: { stores: '20', tierKey: 'standard' },
 breakdown: { version: 'v4.1-draft-2026-11-21', setup: 70180, annual: 33000, inputs: { stores: 20, tierKey: 'standard' }, capacity: { floors: 2 } },
 ...extra,
})

function fakeDb(quote) {
 const calls = []
 return {
  calls,
  from(table) {
   const filters = {}
   const q = {
    select() { return q }, order() { return q }, limit() { return q },
    eq(column, value) { filters[column] = value; return q },
    async maybeSingle() {
     if (table === 'onboarding_quote') return { data: quote, error: null }
     if (table === 'subscription_tier') return { data: tiers[filters.s_tier_key] || null, error: null }
     return { data: null, error: null }
    },
   }
   return q
  },
  async rpc(name, args) {
   calls.push({ name, ...args })
   if (args.p_action === 'reissue') return { data: { revision: args.p_revision + 1, status: 'draft' }, error: null }
   return { data: { revision: args.p_revision, status: 'finalized' }, error: null }
  },
 }
}
const inquiry = { inquiry_id: 5, inquiry_interested_tier: 'standard' }

test('a draft quote with a tier is finalized at approval', async () => {
 const db = fakeDb(draft())
 const result = await prepareQuoteForApproval(db, { inquiry, actorId: 7, now })
 assert.equal(result.changed, true)
 assert.deepEqual(db.calls.map(c => c.p_action), ['finalize'])
 assert.equal(db.calls[0].p_revision, 1)
 assert.equal(db.calls[0].p_actor, 7)
})

test('inquiries without a quote (legacy) are left to the existing provisioning path', async () => {
 const db = fakeDb(null)
 const result = await prepareQuoteForApproval(db, { inquiry, actorId: 7, now })
 assert.equal(result.changed, false)
 assert.equal(db.calls.length, 0)
})

test('an already finalized, current quote is not touched', async () => {
 const db = fakeDb(draft({ status: 'finalized' }))
 assert.equal((await prepareQuoteForApproval(db, { inquiry, actorId: 7, now })).changed, false)
 assert.equal(db.calls.length, 0)
})

test('a quote without any tier cannot be approved until Super Admin picks one', async () => {
 const db = fakeDb(draft({ preferred_tier: null }))
 await assert.rejects(prepareQuoteForApproval(db, { inquiry: { inquiry_id: 5 }, actorId: 7, now }), err => err.code === 'TIER_REQUIRED' && err.statusCode === 400)
 assert.equal(db.calls.length, 0)
})

test('choosing a different tier reissues the same figures with the new tier, then finalizes', async () => {
 const db = fakeDb(draft())
 await prepareQuoteForApproval(db, { inquiry, actorId: 7, tierKey: 'basic', now })
 assert.deepEqual(db.calls.map(c => c.p_action), ['reissue', 'finalize'])
 const reissue = db.calls[0]
 assert.equal(reissue.p_raw.tierKey, 'basic')
 assert.equal(reissue.p_estimate.inputs.tierKey, 'basic')
 assert.equal(reissue.p_estimate.annual, 25000)
 assert.equal(reissue.p_estimate.firstYear, 70180 + 25000)
 assert.equal(reissue.p_estimate.setup, 70180, 'onboarding fee is unchanged')
 assert.deepEqual(reissue.p_estimate.capacity, { floors: 2 })
 assert.match(reissue.p_reason, /basic/)
 assert.equal(db.calls[1].p_revision, 2, 'finalizes the reissued revision')
})

test('an expired quote is reissued unchanged before finalizing', async () => {
 const db = fakeDb(draft({ expires_at: past }))
 await prepareQuoteForApproval(db, { inquiry, actorId: 7, now })
 assert.deepEqual(db.calls.map(c => c.p_action), ['reissue', 'finalize'])
 assert.equal(db.calls[0].p_estimate.inputs.tierKey, 'standard')
 assert.match(db.calls[0].p_reason, /expired/)
})

test('a quote flagged for review needs an explicit acknowledgement', async () => {
 const db = fakeDb(draft({ requires_review: true }))
 await assert.rejects(prepareQuoteForApproval(db, { inquiry, actorId: 7, now }), err => err.code === 'QUOTE_REVIEW_REQUIRED' && err.statusCode === 409)
 assert.equal(db.calls.length, 0)
 await prepareQuoteForApproval(db, { inquiry, actorId: 7, acknowledgeReview: true, now })
 assert.equal(db.calls.at(-1).p_acknowledge, true)
})

test('an unknown tier is refused', async () => {
 const db = fakeDb(draft())
 await assert.rejects(prepareQuoteForApproval(db, { inquiry, actorId: 7, tierKey: 'platinum', now }), err => err.code === 'TIER_INVALID')
})

test('paid quotes are left alone', async () => {
 const db = fakeDb(draft({ status: 'paid' }))
 assert.equal((await prepareQuoteForApproval(db, { inquiry, actorId: 7, now })).changed, false)
 assert.equal(db.calls.length, 0)
})

test('withTier falls back to the stored amount when the breakdown has no setup figure', () => {
 const { estimate } = withTier(draft({ breakdown: { inputs: {} } }), tiers.basic)
 assert.equal(estimate.firstYear, 70180 + 25000)
})
