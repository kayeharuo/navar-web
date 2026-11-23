'use strict'
const DAY = 86400000
const manilaDate = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const dateNumber = value => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const get = key => parts.find(p => p.type === key).value
  return Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))) / DAY
}
function subscriptionState(contract, suspension, now = new Date()) {
  if (!contract?.contract_start || !contract.contract_end || String(contract.contract_status).toLowerCase()==='onboarding') return { status: 'Onboarding', daysLeftLabel: 'Awaiting approval and first annual payment' }
  const remaining = dateNumber(contract.contract_end) - dateNumber(now)
  const overdue = -remaining
  const grace = Number(contract.contract_grace_period_days || 0)
  if (suspension || overdue > grace) return { status: 'Suspended', daysLeftLabel: suspension ? 'AR unpublished during suspension' : `${overdue} days overdue` }
  if (remaining < 0) return { status: 'Grace Period', daysLeftLabel: `${grace - overdue + 1} grace days remaining` }
  return { status: 'Active', daysLeftLabel: remaining === 0 ? 'Expires today' : `${remaining} days left` }
}
function renewalDates(expiration) {
  // Inclusive expiry date in Manila; next period begins at the following midnight.
  const start = new Date((dateNumber(expiration) + 1) * DAY - 8 * 3600000)
  const end = new Date(start)
  const year = end.getUTCFullYear() + 1
  const month = end.getUTCMonth()
  const day = end.getUTCDate()
  end.setUTCFullYear(year, month, 1)
  end.setUTCDate(Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()))
  end.setTime(end.getTime() - 1)
  return { start: start.toISOString(), end: end.toISOString() }
}
function reinstatementAmount(contract, suspension) {
  const annual = Number(contract.contract_annual_fee)
  if (suspension?.suspension_reason === 'Operational') return 0
  return Math.round((annual * (1 + Number(contract.contract_reinstatement_rate)) + Number(suspension?.suspension_penalty_amount || 0)) * 100)
}
function reminderKind(contract, now = new Date()) {
  const days = dateNumber(contract.contract_end) - dateNumber(now)
  if ([30,15,10,5,1].includes(days)) return `expiry_${days}`
  if (days === -1) return 'grace_started'
  const grace = Number(contract.contract_grace_period_days)
  if (-days === grace - 4 && days < 0) return 'grace_ending_5'
  if (-days === grace && days < 0) return 'grace_ending_1'
  return null
}
module.exports = { DAY, manilaDate, dateNumber, subscriptionState, renewalDates, reinstatementAmount, reminderKind }
