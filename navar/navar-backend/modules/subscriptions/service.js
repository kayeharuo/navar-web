'use strict'
const { subscriptionState, reminderKind, dateNumber } = require('./domain')
const { estimateQuote } = require('./quote')
const { currentRateCard } = require('../systemSettings/rateCard')
const titleCase = value => String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const date = value => value ? new Date(value).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' }) : null
function checked(result) { if (result.error) throw result.error; return result.data }
async function listSubscriptions(db) {
  const [malls, contracts, payments, suspensions, tiers, quotes, onboardingRows] = await Promise.all([
    db.from('mall').select('mall_id,mall_name,mall_city,initial_tier_key,is_subscription_test'),
    db.from('contract').select('*').order('contract_version', { ascending: false }),
    db.from('contract_payment_request').select('*').order('created_at', { ascending: false }),
    db.from('suspension').select('*').order('suspension_suspended_at', { ascending: false }),
    db.from('subscription_tier').select('*'),
    db.from('onboarding_quote').select('mall_id,amount_cent,status').in('status',['finalized','paid']).order('created_at',{ascending:false}),
    db.from('mall_onboarding').select('mall_id,onboarding_fee_cent'),
  ]).then(results => results.map(checked))
  return malls.map(m => {
    const history = contracts.filter(c => c.mall_id === m.mall_id)
    const started=[...history].filter(h=>h.contract_start).sort((a,b)=>new Date(a.contract_start)-new Date(b.contract_start)||a.contract_id-b.contract_id)
    const c = history.find(c => c.contract_is_current)
    const suspension = suspensions.find(s => s.contract_id === c?.contract_id && !s.suspension_lifted_at)
    const tier = c?.tier_snapshot || tiers.find(t => t.s_tier_id === c?.s_tier_id) || tiers.find(t => t.s_tier_key === m.initial_tier_key) || tiers.find(t => t.s_tier_key === 'basic')
    return { id: m.mall_id, name: m.mall_name, city: m.mall_city, tier: tier?.s_tier_label || 'Not selected', isTest: m.is_subscription_test,
      ...subscriptionState(c, suspension), subscriptionStart: date(c?.contract_start), subscriptionEnd: date(c?.contract_end),
      onboardingFee: (quotes.find(q=>q.mall_id===m.mall_id)?.amount_cent ?? onboardingRows.find(o=>o.mall_id===m.mall_id)?.onboarding_fee_cent) / 100 || null,
      tierInfo: { annualFee: c?.contract_annual_fee ?? tier?.s_tier_annual_fee ?? 0, gracePeriodDays: c?.contract_grace_period_days ?? tier?.s_tier_grace_period_days ?? 0, reinstatementRate: (c?.contract_reinstatement_rate ?? tier?.s_tier_reinstatement_rate ?? 0) * 100 },
      suspension: suspension ? { reason: suspension.suspension_reason, date: date(suspension.suspension_suspended_at), notes: suspension.suspension_notes, penalty: suspension.suspension_penalty_amount || 0 } : null,
      tierHistory: [...started].reverse().map(h => ({ version: `V${started.findIndex(t=>t.contract_id===h.contract_id)+1}`, tier: h.tier_snapshot?.s_tier_label || tiers.find(t => t.s_tier_id === h.s_tier_id)?.s_tier_label, start: date(h.contract_start), end: date(h.contract_end), fee: h.contract_annual_fee, note: h.change_type==='initial'?(h.scheduled?'Scheduled':null):`${titleCase(h.change_type)}${h.scheduled?' (Scheduled)':''}` })),
      paymentHistory: payments.filter(p => p.mall_id === m.mall_id || history.some(h => h.contract_id === p.contract_id)).map(p => ({ id:p.request_id,date:date(p.paid_at||p.created_at),type:p.fee_type==='onboarding'?'Onboarding Fee':titleCase(p.fee_type),amount:Number(p.amount_cent||0)/100,status:p.status==='paid'?(p.reconciliation_reason||p.fulfillment_error?'Needs Review':'Paid'):titleCase(p.status),reference:p.paymongo_payment_id||p.payment_reference })),
      suspensionHistory: suspensions.filter(s => history.some(h => h.contract_id === s.contract_id)).map(s => ({ reason: s.suspension_reason, dateStart: date(s.suspension_suspended_at), dateEnd: date(s.suspension_lifted_at), notes: s.suspension_notes, resolution: s.suspension_resolution })),
    }
  })
}
async function emit(db, key, mall, kind, title, message, email = true) {
  return checked(await db.rpc('emit_subscription_event', { p_key: key, p_mall: mall, p_kind: kind, p_title: title, p_message: message, p_email: email }))
}
async function runLifecycle(db, now = new Date()) {
  checked(await db.rpc('advance_due_v3_subscriptions'))
  checked(await db.rpc('monitor_subscription_deadlines'))
  const contracts = checked(await db.from('contract').select('*').eq('contract_is_current', true).not('contract_end', 'is', null))
  for (const c of contracts) {
    if (String(c.contract_status).toLowerCase()==='onboarding') continue
    const s = checked(await db.from('suspension').select('*').eq('contract_id', c.contract_id).is('suspension_lifted_at', null).maybeSingle())
    const state = subscriptionState(c, s, now)
    if (state.status === 'Suspended' && !s) {
      checked(await db.rpc('manage_subscription_suspension', { p_mall: c.mall_id, p_actor: null, p_action: 'suspend', p_reason: 'Non-Payment', p_notes: 'Annual subscription unpaid after the grace period.', p_penalty: 0 }))
    } else if (state.status === 'Grace Period') {
      checked(await db.from('contract').update({ contract_status: 'grace', contract_updated_at: now.toISOString() }).eq('contract_id', c.contract_id).eq('contract_is_current', true))
      await emit(db,`contract:${c.contract_id}:grace_started`,c.mall_id,'grace_started','Subscription grace period started',`Your subscription expired on ${date(c.contract_end)}. AR remains live during the ${c.contract_grace_period_days}-day grace period. Renew now to avoid suspension and reinstatement fees.`)
    }
    const kind = reminderKind(c, now)
    if (kind) {
      const scheduled=checked(await db.from('contract').select('contract_id').eq('previous_contract_id',c.contract_id).eq('scheduled',true).in('change_type',['renewal','reinstatement']))
      if(scheduled.length) {
        const paid=checked(await db.from('contract_payment_request').select('request_id').in('contract_id',scheduled.map(s=>s.contract_id)).eq('status','paid').not('fulfilled_at','is',null))
        if(paid.length) continue
      }
      const title = kind.startsWith('expiry_') ? `Subscription renewal: ${kind.split('_')[1]} day(s) before expiry` : kind === 'grace_started' ? 'Subscription grace period started' : 'Subscription grace period is ending'
      await emit(db, `contract:${c.contract_id}:${kind}`, c.mall_id, kind, title,
        `Your subscription expires on ${date(c.contract_end)}. Renew through your mall subscription page. AR remains available during the ${c.contract_grace_period_days}-day grace period. After grace, annual subscription and ${Math.round(c.contract_reinstatement_rate * 100)}% reinstatement fees are due; the next period still starts the day after the previous expiry.`)
    }
  }
  return { checked: contracts.length }
}
async function testContext(db, mallId) {
  const mall = checked(await db.from('mall').select('mall_id,mall_name,is_subscription_test').eq('mall_id', mallId).single())
  const floors = checked(await db.from('floor').select('floor_id,floor_num,floor_label,floor_area_sqm').eq('mall_id', mallId).order('floor_num'))
  const apps = checked(await db.from('application').select('application_id,application_version').eq('mall_id', mallId).order('application_version', { ascending: false }).limit(1))
  const development = apps[0] ? checked(await db.from('ar_development').select('*').eq('application_id', apps[0].application_id).order('ar_development_id', { ascending: false }).limit(1))[0] : null
  const issues = apps[0] ? checked(await db.rpc('application_readiness_issues', { p_application: apps[0].application_id })) : ['No application']
  const tiers = checked(await db.from('subscription_tier').select('s_tier_key,s_tier_label,s_tier_annual_fee').order('s_tier_annual_fee'))
  const payments = checked(await db.from('contract_payment_request').select('request_id,fee_type,status,amount_cent,details,paid_at,fulfilled_at,fulfillment_error,reconciliation_reason,payment_reference').eq('mall_id', mallId).order('request_id', { ascending: false }))
  const onboarding = checked(await db.from('mall_onboarding').select('quote_id,selected_tier_key,onboarding_fee_cent').eq('mall_id', mallId).maybeSingle())
  const quote=onboarding?.quote_id?checked(await db.from('onboarding_quote').select('raw_inputs,breakdown,is_test,status').eq('quote_id',onboarding.quote_id).single()):null
  const contract=checked(await db.from('contract').select('contract_id,contract_status,contract_start,contract_end,tier_snapshot,is_test').eq('mall_id',mallId).eq('contract_is_current',true).maybeSingle())
  const mallAdmins=checked(await db.from('admin').select('admin_id,admin_full_name').eq('mall_id',mallId).eq('admin_role','mall_admin').eq('admin_account_status','official').eq('admin_is_deactivated',false))
  return { mall, floors, development, issues, tiers, payments, onboarding, quote, contract, mallAdmins, rateCard: await currentRateCard(db) }
}
module.exports = { checked, listSubscriptions, emit, runLifecycle, estimateQuote, testContext, date }
