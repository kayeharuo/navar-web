// Onboarding quotes at approval time.
//
// An inquiry sent with a pricing estimate stores a *draft* quote. Provisioning the mall requires
// a *finalized*, unexpired quote with a subscription tier. Super Admin approval is that review,
// so approving now finalizes the quote first:
// - the tier comes from the approval (Super Admin's choice), else the quote, else the inquiry;
// - a quote that has expired, or whose tier changes, is reissued with the same figures;
// - a quote flagged for review (rent ceiling below setup cost) needs an explicit acknowledgement.
// The onboarding fee and capacity do not depend on the tier, so reissuing never changes them.

const QUOTE_COLUMNS = 'quote_id,revision,status,expires_at,preferred_tier,requires_review,raw_inputs,breakdown,amount_cent,mall_id'

function quoteError(message, statusCode, code) {
 const error = new Error(message)
 error.statusCode = statusCode
 error.code = code
 return error
}

function check(result) { if (result.error) throw result.error; return result.data }

async function latestQuote(db, inquiryId) {
 return check(await db.from('onboarding_quote').select(QUOTE_COLUMNS)
  .eq('inquiry_id', inquiryId).order('revision', { ascending: false }).limit(1).maybeSingle())
}

// The same quote, with the tier and the tier-dependent annual figures replaced.
function withTier(quote, tier) {
 const annual = Number(tier.s_tier_annual_fee)
 const breakdown = quote.breakdown || {}
 const setup = breakdown.setup != null ? Number(breakdown.setup) : Number(quote.amount_cent) / 100
 return {
  raw: { ...(quote.raw_inputs || {}), tierKey: tier.s_tier_key },
  estimate: {
   ...breakdown,
   inputs: { ...(breakdown.inputs || {}), tierKey: tier.s_tier_key },
   annual,
   monthly: Math.round(annual / 12),
   firstYear: setup + annual,
  },
 }
}

async function prepareQuoteForApproval(db, { inquiry, actorId, tierKey, acknowledgeReview = false, now = new Date() }) {
 const quote = await latestQuote(db, inquiry.inquiry_id)
 // No quote: legacy inquiry, provisioned from the tier table. Paid: nothing left to finalize.
 if (!quote || quote.status === 'paid') return { quote, changed: false }

 const chosen = (typeof tierKey === 'string' && tierKey.trim()) || quote.preferred_tier || inquiry.inquiry_interested_tier || null
 if (!chosen) throw quoteError('Choose a subscription tier for this mall before approving.', 400, 'TIER_REQUIRED')
 const tier = check(await db.from('subscription_tier').select('s_tier_key,s_tier_annual_fee').eq('s_tier_key', chosen).maybeSingle())
 if (!tier) throw quoteError('Choose a valid subscription tier before approving.', 400, 'TIER_INVALID')

 const expired = !quote.expires_at || new Date(quote.expires_at) <= now
 const tierChanged = quote.preferred_tier !== tier.s_tier_key
 if (quote.status === 'finalized' && !expired && !tierChanged) return { quote, changed: false }

 if (quote.requires_review && acknowledgeReview !== true) {
  throw quoteError('This mall\'s rent-based ceiling is below the setup cost, so the onboarding fee is set at cost. Confirm you have reviewed the fee before approving.', 409, 'QUOTE_REVIEW_REQUIRED')
 }

 let current = quote
 if (expired || tierChanged || quote.status !== 'draft') {
  const { raw, estimate } = withTier(quote, tier)
  const reason = tierChanged
   ? `Subscription tier set to ${tier.s_tier_key} during approval.`
   : 'Reissued unchanged during approval because the previous quote expired.'
  current = check(await db.rpc('manage_v3_quote', {
   p_inquiry: inquiry.inquiry_id, p_actor: actorId, p_action: 'reissue', p_revision: quote.revision,
   p_raw: raw, p_estimate: estimate, p_reason: reason,
  }))
 }
 const finalized = check(await db.rpc('manage_v3_quote', {
  p_inquiry: inquiry.inquiry_id, p_actor: actorId, p_action: 'finalize', p_revision: current.revision,
  p_acknowledge: acknowledgeReview === true,
 }))
 return { quote: finalized, changed: true }
}

module.exports = { prepareQuoteForApproval, withTier, QUOTE_COLUMNS }
