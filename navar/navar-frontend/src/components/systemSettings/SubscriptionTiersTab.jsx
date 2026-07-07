import { Fragment, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'

const TIER_COLUMNS = [
  { key: 'basic', label: 'Basic' },
  { key: 'standard', label: 'Standard' },
  { key: 'premium', label: 'Premium' },
]

const TIER_GROUPS = [
  {
    title: 'Coverage & Capacity',
    rows: [
      { key: 'maxCoverage', label: 'Max Coverage Area (GFA)', values: { basic: 'up to 15,000 sqm', standard: 'up to 50,000 sqm', premium: 'up to 150,000 sqm' } },
      { key: 'maxFloors', label: 'Max Floors', values: { basic: '2', standard: '4', premium: '6' } },
      { key: 'tenantNodes', label: 'Included No. of Tennats', sublabel: 'Stores + stalls combined', values: { basic: '75', standard: '260', premium: '650' } },
      { key: 'beaconAllocation', label: 'Beacon Allocation (included)', values: { basic: '200', standard: '570', premium: '1,650' } },
    ],
  },
  {
    title: 'Pricing & Billing',
    rows: [
      { key: 'annualFee', label: 'Annual Subscription Fee (₱)', sublabel: 'Billed once per year', values: { basic: '60000', standard: '150000', premium: '350000' } },
      { key: 'onboardingFee', label: 'Onboarding & AR Dev Fee (₱)', sublabel: 'One-time implementation fee', values: { basic: '187500', standard: '594600', premium: '1585000' } },
      { key: 'gracePeriod', label: 'Grace Period (days)', sublabel: 'After contract expiry before suspension', values: { basic: '15', standard: '30', premium: '45' } },
      { key: 'reinstatementRate', label: 'Reinstatement Fee (%)', sublabel: 'Added on top of annual fee to lift non-payment suspension', values: { basic: '20', standard: '15', premium: '10' } },
      { key: 'stallFee', label: 'Additional Stall Fee (₱/stall)', sublabel: 'Charged beyond the included tenant pool', values: { basic: '3500', standard: '3500', premium: '3500' } },
    ],
  },
  {
    title: 'Platform Access',
    rows: [
      { key: 'mapUpdates', label: 'Map Updates / Year', values: { basic: '2', standard: '4', premium: '8' } },
      { key: 'adminAccounts', label: 'Mall Admin Accounts', values: { basic: '2', standard: '4', premium: '8' } },
      { key: 'analyticsHistory', label: 'Analytics History', values: { basic: '30 days', standard: 'Full', premium: 'Full' } },
      { key: 'arQueue', label: 'AR Development Queue', values: { basic: 'Standard', standard: 'Priority', premium: 'Dedicated slot' } },
    ],
  },
  {
    title: 'Maintenance & Hardware',
    rows: [
      { key: 'remoteResponse', label: 'Maintenance — Remote Response', values: { basic: 'Within 5 business days', standard: 'Within 2 business days', premium: 'Next business day' } },
      { key: 'onsiteDispatch', label: 'Maintenance — On-site Dispatch', values: { basic: 'Within 6 business days', standard: 'Within 4 business days', premium: 'Within 48 hrs' } },
      { key: 'diagnosisReplacement', label: 'Diagnosis, Replacement & Recalibration', values: { basic: 'Yes', standard: 'Yes', premium: 'Yes' } },
      { key: 'replacementCost', label: 'Replacement Unit Cost', values: { basic: 'Mall pays cost price', standard: 'Included, no charge', premium: 'Included, no charge' } },
      { key: 'spareUnits', label: 'Spare Units On-Site', values: { basic: 'No', standard: 'No', premium: 'Yes — pre-stocked' } },
      { key: 'batterySwap', label: 'Battery (Coin Cell) Swap', values: { basic: 'Mall self-swaps', standard: 'Mall self-swaps, or bundled into next visit', premium: 'Bundled into next maintenance visit' } },
    ],
  },
]

function buildInitialValues() {
  const values = {}
  TIER_GROUPS.forEach(group => {
    group.rows.forEach(row => {
      values[row.key] = { ...row.values }
    })
  })
  return values
}

export default function SubscriptionTiersTab() {
  const [values, setValues] = useState(buildInitialValues)
  const [saved, setSaved] = useState(false)

  function handleChange(rowKey, tierKey, value) {
    setSaved(false)
    setValues(prev => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], [tierKey]: value },
    }))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h2 className="settings-panel-title">Subscription Tiers</h2>
        <p className="settings-panel-desc">
          Define pricing, limits, and features per tier. Changes apply to new contracts only — existing malls keep their contracted terms.
        </p>
      </div>

      <div className="settings-warning-banner">
        <AlertTriangle size={16} className="settings-warning-icon" />
        <span>Changing tier details only affects new malls signing up. Existing active contracts are unaffected.</span>
      </div>

      <div className="tier-table-wrap">
        <div className="tier-table-scroll">
          <table className="tier-table">
            <thead>
              <tr>
                <th className="tier-table-feature-col">Feature</th>
                {TIER_COLUMNS.map(col => (
                  <th key={col.key}>
                    <span className={`tier-badge tier-badge--${col.key}`}>{col.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIER_GROUPS.map(group => (
                <Fragment key={group.title}>
                  <tr className="tier-table-group-row">
                    <td colSpan={TIER_COLUMNS.length + 1}>{group.title}</td>
                  </tr>
                  {group.rows.map(row => (
                    <tr key={row.key} className="tier-table-row">
                      <td>
                        <p className="tier-row-label">{row.label}</p>
                        {row.sublabel && <p className="tier-row-sublabel">{row.sublabel}</p>}
                      </td>
                      {TIER_COLUMNS.map(col => (
                        <td key={col.key}>
                          <input
                            type="text"
                            className="tier-input"
                            value={values[row.key][col.key]}
                            onChange={e => handleChange(row.key, col.key, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="settings-panel-footer">
        <button className="settings-save-btn" onClick={handleSave}>
          {saved ? <Check size={15} strokeWidth={2.5} /> : null}
          {saved ? 'Changes Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
