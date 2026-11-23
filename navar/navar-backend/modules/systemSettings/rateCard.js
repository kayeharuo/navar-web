'use strict'
const defaults = require('./rate-card-v4-1.json')
const numericKeys = ['beaconCost','installCost','mapping','testing','pairing','training','travel','contingency','margin','spareRate','rentCap','extraVisit','defaultConnectors','defaultHallwayRate','hallwaySqmPerBeacon','roundingIncrement','quoteExpiryDays']
function validateRates(input) {
  const rates = {}
  for (const key of numericKeys) {
    if (typeof input?.[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < 0) throw new Error(`Enter a valid non-negative ${key} rate.`)
    rates[key] = input[key]
  }
  for (const key of ['contingency','spareRate','rentCap','defaultHallwayRate']) if (rates[key] > 1) throw new Error(`${key} must be between 0% and 100%.`)
  if (rates.margin >= 1) throw new Error('Onboarding margin must be below 100%.')
  for (const key of ['hallwaySqmPerBeacon','roundingIncrement','quoteExpiryDays']) if (rates[key] <= 0) throw new Error(`${key} must be greater than zero.`)
  for (const key of ['defaultConnectors','quoteExpiryDays']) if (!Number.isSafeInteger(rates[key])) throw new Error(`${key} must be a whole number.`)
  if (!Array.isArray(input.suggestedTierStoreLimits) || input.suggestedTierStoreLimits.length !== 2 || !input.suggestedTierStoreLimits.every(n => Number.isSafeInteger(n) && n > 0) || input.suggestedTierStoreLimits[0] >= input.suggestedTierStoreLimits[1]) throw new Error('Basic store limit must be smaller than Standard store limit.')
  rates.suggestedTierStoreLimits = [...input.suggestedTierStoreLimits]
  rates.confirmedRates = defaults.rates.confirmedRates
  return rates
}
async function currentRateCard(db) {
  const result = await db.from('navar_rate_card').select('*').eq('is_current', true).single()
  if (result.error) throw result.error
  if (!result.data) throw new Error('Current onboarding rates are not configured.')
  return result.data
}
module.exports = { validateRates, currentRateCard }
