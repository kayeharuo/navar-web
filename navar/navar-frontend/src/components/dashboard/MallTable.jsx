import { Link } from 'react-router-dom'
import useDashboardData from './useDashboardData'
import Badge from '../ui/Badge'
import '../../styles/dashboard/dashboard.css'

const variants = {
  Active: 'active', Setup: 'setup', 'Grace Period': 'grace', Suspended: 'suspended',
  Approved: 'approved', 'For Revision': 'revision', Submitted: 'pending', Draft: 'default',
  Live: 'live', Unpublished: 'unpublished', 'Node Mapping': 'pending', Testing: 'pending', Ready: 'pending',
}

export default function MallTable() {
  const { data: malls, loading, error } = useDashboardData('/api/malls')
  return (
    <div className="dash-card dash-card--table">
      {/* Header */}
      <div className="dash-table-header">
        <div className="dash-card-title">
          <span className="dash-card-accent" style={{ backgroundColor: '#22C55E' }} />
          <span className="dash-card-label">Mall Information Summary</span>
        </div>
        <div className="dash-table-meta">
          <span className="dash-table-count">{loading || error ? '-' : malls.length} malls</span>
          <Link className="dash-table-show-all" to="/mall-management">Show All</Link>
        </div>
      </div>

      {/* Scrollable area — fills remaining card height */}
      <div className="dash-table-scroll">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Mall</th>
              <th>Tier</th>
              <th>Agreement</th>
              <th>Application</th>
              <th>AR Development</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} role="status">Loading malls...</td></tr> : error ? <tr><td colSpan={5} role="alert">{error}</td></tr> : malls.length === 0 ? <tr><td colSpan={5}>No malls found.</td></tr> : malls.map(mall => (
              <tr key={mall.id}>
                <td>
                  <span className={`dash-table-mall-name${
                    mall.agreementStatus === 'Grace Period'
                      ? ' dash-table-mall-name--grace'
                      : mall.agreementStatus === 'Suspended'
                      ? ' dash-table-mall-name--suspended'
                      : ''
                  }`}>
                    {mall.name}
                  </span>
                  {mall.note && <p className="dash-table-mall-note">{mall.note}</p>}
                </td>
                <td>{mall.tier}</td>
                <td><Badge label={mall.agreementStatus || '-'} variant={variants[mall.agreementStatus] || 'default'}   /></td>
                <td><Badge label={mall.application || '-'} variant={variants[mall.application] || 'default'} /></td>
                <td><Badge label={mall.arDevelopment || '-'} variant={variants[mall.arDevelopment] || 'default'}       /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}