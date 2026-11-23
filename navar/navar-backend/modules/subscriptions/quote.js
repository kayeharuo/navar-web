'use strict'
const defaultCard = require('../systemSettings/rate-card-v4-1.json')
function estimateQuote(input, card = defaultCard) {
  const stores = Number(input.stores), tenants = Number(input.tenants), rent = Number(input.averageRent)
  if (!Number.isSafeInteger(stores) || stores < 1 || !Number.isSafeInteger(tenants) || tenants < 0 || tenants > stores || !Number.isFinite(rent) || rent < 0 || !Array.isArray(input.floors) || !input.floors.length) throw new Error('Provide stores, tenants, average rent and floor areas.')
  let area = 0, hallway = 0, connectors = 0
  const seen = new Set()
  for (const f of input.floors) {
    const sqm = Number(f.areaSqm), hall = f.hallwaySqm == null ? sqm * card.rates.defaultHallwayRate : Number(f.hallwaySqm)
    const points = f.connectors == null ? card.rates.defaultConnectors : Number(f.connectors)
    if (!Number.isSafeInteger(f.floorNum) || seen.has(f.floorNum) || !Number.isFinite(sqm) || sqm <= 0 || !Number.isFinite(hall) || hall < 0 || hall > sqm || !Number.isSafeInteger(points) || points < 0) throw new Error('Check floor areas, hallway areas and connector points.')
    seen.add(f.floorNum); area += sqm; hallway += Math.ceil(hall / card.rates.hallwaySqmPerBeacon); connectors += points
  }
  const installed = stores + hallway + connectors, spares = Math.ceil(installed * card.rates.spareRate)
  const subtotal = installed * (card.rates.beaconCost + card.rates.installCost) + spares * card.rates.beaconCost + area * (card.rates.mapping + card.rates.testing) + stores * card.rates.pairing + card.rates.training + card.rates.travel
  const costCent = Math.round(subtotal * (1 + card.rates.contingency) * 100)
  const increment = card.rates.roundingIncrement * 100
  const marginCent = Math.ceil(costCent / (1 - card.rates.margin) / increment) * increment
  const ceilingCent = Math.floor(12 * tenants * rent * card.rates.rentCap * 100 / increment) * increment
  return { rateVersion: card.version, rateSnapshot: card.rates, amountCent: Math.max(costCent, Math.min(marginCent, ceilingCent)), costCent, marginCent, ceilingCent, requiresReview: ceilingCent < costCent, installed, spares,
    capacity: { floors: input.floors.length, stores, tenants, mallOwned: stores - tenants, beacons: installed + spares }, inputs: input }
}
module.exports = { estimateQuote }
