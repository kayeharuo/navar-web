import { Fragment, useEffect, useState } from 'react'
import { Check, Info } from 'lucide-react'
import { apiRequest } from '../../config/api'

const TIER_COLUMNS = [
  { key: 'basic', label: 'Basic' },
  { key: 'standard', label: 'Standard' },
  { key: 'premium', label: 'Premium' },
]

const TIER_GROUPS = [
  { title: 'Pricing & Billing', rows: [
    { key: 'annualFee', label: 'Annual subscription fee', emphasis: true, values: { basic: '₱25,000', standard: '₱33,000', premium: '₱47,000' } },
    { key: 'gracePeriod', label: 'Grace period after expiry', values: { basic: '15 days', standard: '30 days', premium: '45 days' } },
    { key: 'reinstatementFee', label: 'Reinstatement fee', values: { basic: '20%', standard: '15%', premium: '10%' } },
  ] },
  { title: 'Platform Access', rows: [
    { key: 'adminAccounts', label: 'Mall admin accounts', values: { basic: '2', standard: '4', premium: '8' } },
    { key: 'analyticsHistory', label: 'Analytics history', values: { basic: '30 days', standard: '12 months', premium: 'Full' } },
    { key: 'analyticsTools', label: 'Analytics tools', values: { basic: 'Summary dashboard', standard: '+ CSV export, date filters', premium: '+ all chart tabs' } },
    { key: 'mapQueue', label: 'Map update queue (after launch)', values: { basic: 'Standard', standard: 'Priority', premium: 'Dedicated slot' } },
  ] },
  { title: 'Support & On-site Service', rows: [
    { key: 'remoteResponse', label: 'Remote response', values: { basic: 'Within 5 business days', standard: 'Within 2 business days', premium: 'Next business day' } },
    { key: 'onsiteDispatch', label: 'On-site dispatch', values: { basic: 'Within 6 business days', standard: 'Within 4 business days', premium: 'Within 48 hrs' } },
    { key: 'includedVisits', label: 'Included on-site visits per year', values: { basic: '1', standard: '2', premium: '4' } },
    { key: 'extraVisit', label: 'Extra on-site visit', values: { basic: '₱2,250', standard: '₱2,250', premium: '₱2,250' } },
  ] },
  { title: 'Usage Charges', rows: [
    { key: 'beaconReplacement', label: 'Beacon replacement (beacon + installation)', values: { basic: '₱815 each', standard: '₱815 each', premium: '₱815 each' } },
    { key: 'freeStalls', label: 'Free extra stalls per year', values: { basic: '0', standard: '0', premium: '10' } },
    { key: 'extraStall', label: 'Fee per extra stall after free allowance', values: { basic: '₱1,100', standard: '₱1,000', premium: '₱1,000' } },
    { key: 'freeMapUpdates', label: 'Free map updates per year (up to one floor each)', values: { basic: '0', standard: '0', premium: '1' } },
    { key: 'paidMapUpdate', label: 'Paid map update — percentage per floor', sublabel: 'Original onboarding fee ÷ original floor count × tier percentage.', values: { basic: '50%', standard: '40%', premium: '30%' } },
  ] },
]

export default function SubscriptionTiersTab() {
  const initialValues = Object.fromEntries(TIER_GROUPS.flatMap(group => group.rows).map(row => [row.key, { ...row.values }]))
  const [values, setValues] = useState(initialValues)
  const [rateCard, setRateCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/api/system-settings/subscription-tiers')
      .then(data => { setValues(current => ({ ...current, ...data.values })); setRateCard(data.rateCard) })
      .catch(loadError => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(rowKey, tierKey, value) {
    setSaved(false)
    setError('')
    setValues(current => ({ ...current, [rowKey]: { ...current[rowKey], [tierKey]: value } }))
  }

  async function handleSave() {
    setSaving(true); setSaved(false); setError('')
    try {
      const data = await apiRequest('/api/system-settings/subscription-tiers', { method: 'PUT', body: JSON.stringify({ values, onboardingRates: rateCard.rates, rateVersion: rateCard.version }) })
      setValues(current => ({ ...current, ...data.values }))
      setRateCard(data.rateCard)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h2 className="settings-panel-title">Subscription Tiers</h2>
        <p className="settings-panel-desc">Annual subscriptions cover the platform, support, and analytics. Mall capacity is defined by its onboarding quote and contract.</p>
      </div>
      <div className="settings-warning-banner">
        <Info size={16} className="settings-warning-icon" />
        <span>Draft pricing: only the ₱740 beacon cost is confirmed. All other rates and coverage assumptions are placeholders. Onboarding is calculated per mall, separately from the subscription.</span>
      </div>
      <div className="tier-table-wrap"><div className="tier-table-scroll"><table className="tier-table">
        <thead><tr><th className="tier-table-feature-col">Feature</th>{TIER_COLUMNS.map(column => <th key={column.key}><span className={`tier-badge tier-badge--${column.key}`}>{column.label}</span></th>)}</tr></thead>
        <tbody>{TIER_GROUPS.map(group => <Fragment key={group.title}>
          <tr className="tier-table-group-row"><td colSpan={4}>{group.title}</td></tr>
          {group.rows.map(row => <tr key={row.label} className="tier-table-row">
            <td><p className={`tier-row-label${row.emphasis ? ' tier-row-label--emphasis' : ''}`}>{row.label}</p>{row.sublabel && <p className="tier-row-sublabel">{row.sublabel}</p>}</td>
            {TIER_COLUMNS.map(column => <td key={column.key}><input className={`tier-input${row.emphasis ? ' tier-input--emphasis' : ''}`} disabled={loading || saving || !rateCard} value={values[row.key][column.key]} onChange={event => handleChange(row.key, column.key, event.target.value)} /></td>)}
          </tr>)}
        </Fragment>)}</tbody>
      </table></div></div>
      {rateCard && <OnboardingRates card={rateCard} disabled={loading || saving} onChange={rates => { setRateCard(current => ({ ...current, rates })); setSaved(false) }} />}
      {loading && <p role="status">Loading current pricing…</p>}
      {error && <p className="mall-field-error" role="alert">{error}</p>}
      <div className="settings-panel-footer"><button className="settings-save-btn" disabled={saving || loading || !rateCard} onClick={handleSave}>{saved && <Check size={15} strokeWidth={2.5} />}{saving ? 'Saving…' : saved ? 'Changes Saved' : 'Save Changes'}</button></div>
    </div>
  )
}

function OnboardingRates({ card, disabled, onChange }) {
  const fields = [
    ['beaconCost','Beacon hardware (PHP)'],['installCost','Installation per beacon (PHP)'],
    ['mapping','Mapping and calibration per sqm (PHP)'],['testing','Testing per sqm (PHP)'],
    ['pairing','Store mapping and beacon pairing per store (PHP)'],['training','Training (PHP)'],['travel','Travel (PHP)'],
    ['spareRate','Spare beacons (%)',true],['contingency','Contingency (%)',true],['margin','Onboarding margin (%)',true],
    ['rentCap','Affordability ceiling: annual tenant rent (%)',true],['defaultHallwayRate','Default hallway area (%)',true],
    ['hallwaySqmPerBeacon','Hallway coverage per beacon (sqm)'],['defaultConnectors','Default connectors per floor'],
    ['roundingIncrement','Quote rounding increment (PHP)'],['quoteExpiryDays','Quote validity (days)'],
    ['extraVisit','Extra on-site visit reference cost (PHP)'],
  ]
  const r = card.rates
  return <section className="onboarding-rate-card" aria-label="Onboarding rate card">
    <h3>Onboarding Rate Card</h3>
    <div className="tier-table-wrap"><table className="tier-table"><thead><tr><th>Cost or assumption</th><th>Rate</th></tr></thead><tbody>
      {fields.map(([key,label,percent]) => <tr key={key}><td><label htmlFor={'rate-'+key}>{label}</label></td><td><input id={'rate-'+key} className="tier-input" type="number" min="0" step={['defaultConnectors','quoteExpiryDays'].includes(key) ? '1' : '0.01'} max={percent ? (key === 'margin' ? '99.99' : '100') : undefined} disabled={disabled} value={r[key] === '' ? '' : percent ? Number((r[key]*100).toFixed(6)) : r[key]} onChange={event => onChange({...r,[key]:event.target.value === '' ? '' : Number(event.target.value)/(percent ? 100 : 1)})} /></td></tr>)}
      {['Basic','Standard'].map((tier,index) => <tr key={tier}><td><label htmlFor={'rate-limit-'+index}>{tier} suggested store limit</label></td><td><input id={'rate-limit-'+index} className="tier-input" type="number" min="1" step="1" disabled={disabled} value={r.suggestedTierStoreLimits[index]} onChange={event => onChange({...r,suggestedTierStoreLimits:r.suggestedTierStoreLimits.map((limit,i)=>i === index ? event.target.value === '' ? '' : Number(event.target.value) : limit)})} /></td></tr>)}
    </tbody></table></div>
    <p>Installed beacon cost: {new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(r.beaconCost)+Number(r.installCost))}. Store, hallway and connector beacons are estimated separately; spare counts round up.</p>
  </section>
}
