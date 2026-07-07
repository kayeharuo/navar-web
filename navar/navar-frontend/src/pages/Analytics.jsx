import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, Clock, TrendingUp, Ticket, Users, MapPin } from 'lucide-react'

const REVENUE_MONTHLY = [
  { month: 'Feb', basic: 180, standard: 300, premium: 350 },
  { month: 'Mar', basic: 190, standard: 320, premium: 380 },
  { month: 'Apr', basic: 205, standard: 330, premium: 410 },
  { month: 'May', basic: 210, standard: 360, premium: 430 },
  { month: 'Jun', basic: 225, standard: 400, premium: 460 },
  { month: 'Jul', basic: 240, standard: 420, premium: 500 },
]

const OPS_STATS = [
  { label: 'Open tickets', value: '23' },
  { label: 'Avg. resolution time', value: '1.8 days' },
  { label: 'SLA compliance', value: '96%' },
  { label: 'Low-battery flags', value: '41' },
]

const FUNNEL_STATS = [
  { label: 'Chatbot sessions', value: '312' },
  { label: 'Quotes given', value: '58' },
  { label: 'Signed contracts', value: '9' },
  { label: 'Avg. quote-to-go-live', value: '34 days' },
]

const TOP_MALLS = [
  { name: 'SM City Cebu', sessions: 6120 },
  { name: 'Ayala Center Cebu', sessions: 4850 },
  { name: 'Robinsons Galleria Cebu', sessions: 2940 },
  { name: 'Gaisano Grand Mall Mandaue', sessions: 1610 },
]

const TOP_DESTINATIONS = [
  { name: 'Uniqlo', requests: 940 },
  { name: 'Food Court', requests: 810 },
  { name: 'H&M', requests: 640 },
  { name: 'National Bookstore', requests: 520 },
  { name: 'Restroom Level 2', requests: 410 },
]

const PEAK_HOURS = [
  { hour: '8am', sessions: 40 },
  { hour: '10am', sessions: 120 },
  { hour: '12pm', sessions: 310 },
  { hour: '2pm', sessions: 260 },
  { hour: '4pm', sessions: 280 },
  { hour: '6pm', sessions: 340 },
  { hour: '8pm', sessions: 190 },
  { hour: '10pm', sessions: 60 },
]

const LOW_ARRIVAL = [
  { route: 'Level 3 → Cinema entrance', arrival: 38 },
  { route: 'Level 1 → Parking entrance C', arrival: 54 },
  { route: 'Level 2 → PWD restroom', arrival: 61 },
]

const MALLS = ['All malls', 'SM City Cebu', 'Ayala Center Cebu', 'Robinsons Galleria Cebu']
const RANGES = ['Last 30 days', 'Last 90 days', 'Last 12 months', 'All time']

const MONTHS_BY_RANGE = {
  'Last 30 days': 1,
  'Last 90 days': 3,
  'Last 12 months': 6,
  'All time': 6,
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: TrendingUp },
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'ops', label: 'Operations', icon: Ticket },
  { key: 'funnel', label: 'Sales Funnel', icon: Users },
  { key: 'usage', label: 'Usage & Rankings', icon: MapPin },
]

function StatCard({ label, value }) {
  return (
    <div style={{
      flex: '1',
      minWidth: '140px',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      backgroundColor: '#fff',
      padding: '12px 16px',
    }}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '600', color: '#0f172a' }}>{value}</div>
    </div>
  )
}

export default function Analytics() {
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState('Last 12 months')
  const [mall, setMall] = useState('All malls')

  const monthsToShow = MONTHS_BY_RANGE[range]
  const revenueSlice = REVENUE_MONTHLY.slice(REVENUE_MONTHLY.length - monthsToShow)
  const mallFactor = mall === 'All malls' ? 1 : 0.35

  const toCSV = (rows) => {
    return [
      Object.keys(rows[0]).join(','),
      ...rows.map(row => Object.values(row).map(v => `"${v}"`).join(',')),
    ].join('\n')
  }

  const downloadCSV = (filename, data) => {
    const blob = new Blob([data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    const stamp = `${range.replace(/\s+/g, '_')}_${mall.replace(/\s+/g, '_')}`
    let filename = ''
    let data = ''

    if (tab === 'overview' || tab === 'revenue') {
      const scaledRevenue = revenueSlice.map(row => ({
        month: row.month,
        basic: Math.round(row.basic * mallFactor * 1000),
        standard: Math.round(row.standard * mallFactor * 1000),
        premium: Math.round(row.premium * mallFactor * 1000),
      }))
      filename = `navar_revenue_${stamp}.csv`
      data = toCSV(scaledRevenue)
    } else if (tab === 'ops') {
      filename = `navar_operations_${stamp}.csv`
      data = toCSV(OPS_STATS)
    } else if (tab === 'funnel') {
      filename = `navar_sales_funnel_${stamp}.csv`
      data = toCSV(FUNNEL_STATS)
    } else if (tab === 'usage') {
      const scaledMalls = TOP_MALLS.map(m => ({
        name: m.name,
        sessions: Math.round(m.sessions * mallFactor),
      }))
      filename = `navar_usage_rankings_${stamp}.csv`
      data = toCSV(scaledMalls)
    }

    downloadCSV(filename, data)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0' }}>
        {/* Header */}
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>
          Analytics
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', marginBottom: '20px' }}>
          <Clock size={13} />
          <span>Last updated today, 2:00 AM · refreshes daily</span>
        </div>

        {/* Filters + Export */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#fff',
          padding: '12px 16px',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>History range</span>
          <select
            value={range}
            onChange={e => setRange(e.target.value)}
            style={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '6px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {RANGES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={mall}
            onChange={e => setMall(e.target.value)}
            style={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '6px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {MALLS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div style={{ flex: '1' }} />

          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              padding: '6px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#1d4ed8'}
            onMouseOut={e => e.target.style.backgroundColor = '#2563eb'}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
          overflowX: 'auto',
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                color: tab === t.key ? '#2563eb' : '#64748b',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => {
                if (tab !== t.key) e.target.style.color = '#334155'
              }}
              onMouseLeave={e => {
                if (tab !== t.key) e.target.style.color = '#64748b'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <StatCard label="MRR" value="₱1.24M" />
              <StatCard label="Active malls" value="14" />
              <StatCard label="Open tickets" value="23" />
              <StatCard label="SLA compliance" value="96%" />
              <StatCard label="Signed this month" value="9" />
              <StatCard label="Total app sessions" value="18.4K" />
            </div>
            <p style={{ fontSize: '14px', color: '#cbd5e1' }}>
              Switch tabs for the full breakdown behind each figure above.
            </p>
          </>
        )}

        {/* Revenue Tab */}
        {tab === 'revenue' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <StatCard label="MRR" value="₱1.24M" />
              <StatCard label="Onboarding revenue (MTD)" value="₱2.11M" />
              <StatCard label="Add-on fee revenue" value="₱84K" />
              <StatCard label="Churn (90d)" value="2.1%" />
            </div>
            <div style={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#fff',
              padding: '16px',
              height: '260px',
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSlice}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="basic" stackId="a" fill="#2a78d6" name="Basic" />
                  <Bar dataKey="standard" stackId="a" fill="#1baf7a" name="Standard" />
                  <Bar dataKey="premium" stackId="a" fill="#eda100" name="Premium" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Operations Tab */}
        {tab === 'ops' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              {OPS_STATS.map(s => (
                <StatCard key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
            <p style={{ fontSize: '14px', color: '#cbd5e1' }}>
              Ticket breakdown by type (Fault, Low Battery, Structural Change, Stall Node, General) and assignee available in the exported CSV.
            </p>
          </>
        )}

        {/* Sales Funnel Tab */}
        {tab === 'funnel' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {FUNNEL_STATS.map(s => (
              <StatCard key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        )}

        {/* Usage & Rankings Tab */}
        {tab === 'usage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Top Malls */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '12px' }}>
                Top malls
              </h3>
              <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#fff',
                borderCollapse: 'collapse',
              }}>
                {TOP_MALLS.map((m, i) => (
                  <div
                    key={m.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      borderBottom: i < TOP_MALLS.length - 1 ? '1px solid #f1f5f9' : 'none',
                      backgroundColor: '#fff',
                    }}
                  >
                    <span style={{ width: '20px', fontSize: '12px', color: '#cbd5e1' }}>{i + 1}</span>
                    <span style={{ flex: '1', fontSize: '14px', color: '#334155' }}>{m.name}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {Math.round(m.sessions * mallFactor).toLocaleString()} sessions
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Destinations */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '12px' }}>
                Top destinations
              </h3>
              <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#fff',
                padding: '16px',
                height: '200px',
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TOP_DESTINATIONS} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="requests" fill="#1baf7a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak Hours */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '12px' }}>
                Peak hours (avg. sessions, last 7 days)
              </h3>
              <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#fff',
                padding: '16px',
                height: '180px',
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={PEAK_HOURS}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="sessions" stroke="#2a78d6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Low Arrival Routes */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '12px' }}>
                Low-arrival routes
              </h3>
              <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#fff',
              }}>
                {LOW_ARRIVAL.map((r, i) => (
                  <div
                    key={r.route}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: i < LOW_ARRIVAL.length - 1 ? '1px solid #f1f5f9' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: '#334155' }}>{r.route}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        backgroundColor: r.arrival < 45 ? '#fee2e2' : '#fed7aa',
                        color: r.arrival < 45 ? '#dc2626' : '#ea580c',
                      }}
                    >
                      {r.arrival}% arrival
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
