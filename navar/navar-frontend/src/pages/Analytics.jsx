import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import DateRangePicker from '../components/analytics/DateRangePicker'
import '../styles/analytics/analytics.css'

const SESSIONS_PER_DAY = [
  1450, 1500, 2200, 2800, 2750, 1600, 1500,
  1480, 1500, 1550, 2300, 2800, 2700, 1550,
  1500, 1480, 1500, 2250, 2800, 2700, 1550,
  1500, 1480, 1500, 2200, 2800, 2700, 1550,
  1500, 1480,
]

const CHART_START_DATE = new Date(2025, 1, 12) // Feb 12, 2025

const SESSIONS_OVER_TIME = SESSIONS_PER_DAY.map((sessions, i) => {
  const date = new Date(CHART_START_DATE)
  date.setDate(date.getDate() + i)
  return {
    date,
    label: `${date.getMonth() + 1}/${date.getDate()}`,
    sessions,
  }
})

const RANGE_OPTIONS = [
  { key: 7, label: '7 days' },
  { key: 14, label: '14 days' },
  { key: 30, label: '30 days' },
]

const STAT_CARDS = [
  {
    label: 'SESSIONS (LAST 7D)',
    icon: '\u{1F4CD}',
    value: '12,936',
    color: '#2563EB',
    sub: 'Across all active malls',
    badge: '\u2191 1%',
  },
  {
    label: 'SESSIONS (LAST 30D)',
    icon: '\u{1F5FA}\uFE0F',
    value: '54,589',
    color: '#16A34A',
    sub: 'Avg 10,918 per mall',
  },
  {
    label: 'ACTIVE MALLS',
    icon: '\u{1F3E2}',
    value: '5',
    color: '#16A34A',
    sub: '0 in setup',
  },
  {
    label: 'PEAK HOUR',
    icon: '\u23F0',
    value: '5PM',
    color: '#7C3AED',
    sub: 'Highest navigation traffic',
  },
  {
    label: 'ANNUAL REVENUE',
    icon: '\u{1F4B0}',
    value: '\u20B1635,000',
    color: '#16A34A',
    sub: 'Active contracts only',
  },
  {
    label: 'TOP MALL (30D)',
    icon: '\u{1F3C6}',
    value: 'SM Seaside City',
    color: '#EA8C1D',
    sub: '13,849 sessions',
  },
  {
    label: 'TOP DESTINATION',
    icon: '\u{1F6CD}\uFE0F',
    value: 'Food Court',
    color: '#2563EB',
    sub: '4,820 navigations',
  },
  {
    label: 'AVG SESSION DURATION',
    icon: '\u{1F553}',
    value: '4m 32s',
    color: '#7C3AED',
    sub: 'Per navigation session',
  },
]

const MALL_PERFORMANCE = [
  { name: 'SM Seaside City', sessions: 13849, revenue: 120000, color: '#2563EB' },
  { name: 'Pacific Mall', sessions: 6912, revenue: 80000, color: '#16A34A' },
  { name: 'Gaisano Grand', sessions: 5637, revenue: 75000, color: '#EA8C1D' },
  { name: 'Robinsons Galleria', sessions: 10125, revenue: 150000, color: '#7C3AED' },
  { name: 'Ayala Center', sessions: 10095, revenue: 110000, color: '#0D9488' },
  { name: 'SM City Consolacion', sessions: 7971, revenue: 100000, color: '#DC2626' },
]

const PEAK_HOURS = [
  { hour: '7AM', value: 320 },
  { hour: '8AM', value: 680 },
  { hour: '9AM', value: 780 },
  { hour: '11AM', value: 960 },
  { hour: '1PM', value: 1050 },
  { hour: '3PM', value: 1150 },
  { hour: '5PM', value: 1300, peak: true },
  { hour: '7PM', value: 900 },
  { hour: '9PM', value: 480 },
]

const TOP_DESTINATIONS = [
  { label: 'Food Court', value: 4820 },
  { label: 'Restroom', value: 3910 },
  { label: 'Cinema', value: 3540 },
  { label: 'Information Desk', value: 2760 },
  { label: 'ATM', value: 2480 },
  { label: 'Supermarket', value: 2200 },
  { label: 'Parking Entrance', value: 1980 },
  { label: 'Pharmacy', value: 1640 },
]

const USER_TYPE = {
  newUsers: 10847,
  returningUsers: 5103,
  totalUnique: 15950,
}

const MONTHLY_REVENUE = [
  { month: "Mar'25", value: 300000 },
  { month: "Apr'25", value: 330000 },
  { month: "May'25", value: 350000 },
  { month: "Jun'25", value: 340000 },
  { month: "Jul'25", value: 370000 },
  { month: "Aug'25", value: 360000 },
  { month: "Sep'25", value: 380000 },
  { month: "Oct'25", value: 400000 },
  { month: "Nov'25", value: 420000 },
  { month: "Dec'25", value: 450000 },
  { month: "Jan'26", value: 440000 },
  { month: "Feb'26", value: 460000 },
]

const MALL_BREAKDOWN = [
  { mall: 'SM Seaside City Cebu', city: 'Cebu City', status: 'Active', sessions30: 13849, last7: 3238, trend: 'up', vsPrev7: '3%', fee: '\u20B1120,000', topDestination: 'Food Court' },
  { mall: 'Pacific Mall Cebu', city: 'Mandaue City', status: 'Active', sessions30: 6912, last7: 1662, trend: 'up', vsPrev7: '2%', fee: '\u20B180,000', topDestination: 'Cinema' },
  { mall: 'Gaisano Grand Mall', city: 'Cebu City', status: 'Active', sessions30: 5637, last7: 1301, trend: 'down', vsPrev7: '2%', fee: '\u20B175,000', topDestination: 'ATM' },
  { mall: 'Robinsons Galleria Cebu', city: 'Cebu City', status: 'Grace', sessions30: 10125, last7: 2389, trend: 'down', vsPrev7: '2%', fee: '\u20B1150,000', topDestination: 'Supermarket' },
  { mall: 'Ayala Center Cebu', city: 'Cebu City', status: 'Active', sessions30: 10095, last7: 2448, trend: 'up', vsPrev7: '2%', fee: '\u20B1110,000', topDestination: 'Food Hall' },
  { mall: 'SM City Consolacion Cebu', city: 'Consolacion', status: 'Active', sessions30: 7971, last7: 1981, trend: 'down', vsPrev7: '1%', fee: '\u20B1100,000', topDestination: 'Food Court' },
]

const TOP_STORES = [
  { rank: 1, name: 'SM Supermarket', mall: 'SM Seaside City Cebu', value: 1240 },
  { rank: 2, name: 'Ayala Food Hall', mall: 'Ayala Center Cebu', value: 1050 },
  { rank: 3, name: 'SM Supermarket', mall: 'SM City Consolacion Cebu', value: 890 },
  { rank: 4, name: 'Timezone', mall: 'SM Seaside City Cebu', value: 780 },
  { rank: 5, name: 'Coffee Bean & Tea Leaf', mall: 'Ayala Center Cebu', value: 640 },
]

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    from: new Date(2025, 2, 13),
    to: new Date(2026, 2, 13),
  })
  const [chartRange, setChartRange] = useState(30)
  const [mallMetric, setMallMetric] = useState('sessions')

  const chartData = useMemo(
    () => SESSIONS_OVER_TIME.slice(SESSIONS_OVER_TIME.length - chartRange),
    [chartRange]
  )

  const handleExport = () => {
    const rows = chartData.map(d => ({ date: d.label, sessions: d.sessions }))
    const csv = [
      'date,sessions',
      ...rows.map(r => `${r.date},${r.sessions}`),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `navar_analytics_${Date.now()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">
            Provides insights through data visualization, reports, and performance metrics to support decision-making.
          </p>
        </div>

        <div className="analytics-header-actions">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
          <button type="button" className="analytics-export-btn" onClick={handleExport}>
            Export
          </button>
        </div>
      </div>

      <div className="analytics-stats-grid">
        {STAT_CARDS.map(card => (
          <div key={card.label} className="analytics-stat-card">
            <div className="analytics-stat-top">
              <span className="analytics-stat-label">{card.label}</span>
              <span className="analytics-stat-icon">{card.icon}</span>
            </div>
            <div className="analytics-stat-value-row">
              <span className="analytics-stat-value" style={{ color: card.color }}>
                {card.value}
              </span>
              {card.badge && <span className="analytics-stat-badge">{card.badge}</span>}
            </div>
            <span className="analytics-stat-sub">{card.sub}</span>
          </div>
        ))}
      </div>

      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <div>
            <h2 className="analytics-chart-title">Sessions Over Time</h2>
            <p className="analytics-chart-subtitle">Total navigation sessions per day across all active malls</p>
          </div>

          <div className="analytics-range-tabs">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                className={`analytics-range-tab-btn${chartRange === opt.key ? ' analytics-range-tab-btn--active' : ''}`}
                onClick={() => setChartRange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF2" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={{ stroke: '#E8ECF2' }}
                tickLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
              />
              <YAxis
                domain={[0, 2800]}
                ticks={[0, 700, 1400, 2100, 2800]}
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="analytics-row-2col">
        <div className="analytics-card">
          <div className="analytics-chart-header">
            <div>
              <h2 className="analytics-chart-title">Mall Performance</h2>
              <p className="analytics-chart-subtitle">Sessions last 30 days per mall</p>
            </div>

            <div className="analytics-range-tabs">
              <button
                type="button"
                className={`analytics-range-tab-btn${mallMetric === 'sessions' ? ' analytics-range-tab-btn--active' : ''}`}
                onClick={() => setMallMetric('sessions')}
              >
                Sessions
              </button>
              <button
                type="button"
                className={`analytics-range-tab-btn${mallMetric === 'revenue' ? ' analytics-range-tab-btn--active' : ''}`}
                onClick={() => setMallMetric('revenue')}
              >
                Revenue
              </button>
            </div>
          </div>

          <div className="analytics-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MALL_PERFORMANCE} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF2" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  axisLine={{ stroke: '#E8ECF2' }}
                  tickLine={false}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey={mallMetric} radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {MALL_PERFORMANCE.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-chart-header">
            <div>
              <h2 className="analytics-chart-title">Peak Hours</h2>
              <p className="analytics-chart-subtitle">Average sessions by hour of day</p>
            </div>
          </div>

          <div className="analytics-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PEAK_HOURS} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF2" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  axisLine={{ stroke: '#E8ECF2' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1400]}
                  ticks={[0, 350, 700, 1050, 1400]}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {PEAK_HOURS.map(entry => (
                    <Cell key={entry.hour} fill={entry.peak ? '#EA8C1D' : '#BFDBFE'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-row-3col">
        <div className="analytics-card">
          <h2 className="analytics-chart-title">Top Destinations</h2>
          <p className="analytics-chart-subtitle">Most navigated destination types (all malls)</p>

          <div className="analytics-bar-list">
            {TOP_DESTINATIONS.map(dest => (
              <div key={dest.label} className="analytics-bar-list-row">
                <div className="analytics-bar-list-labels">
                  <span className="analytics-bar-list-label">{dest.label}</span>
                  <span className="analytics-bar-list-value">{dest.value.toLocaleString()}</span>
                </div>
                <div className="analytics-bar-list-track">
                  <div
                    className="analytics-bar-list-fill"
                    style={{ width: `${(dest.value / TOP_DESTINATIONS[0].value) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2 className="analytics-chart-title">User Type</h2>
          <p className="analytics-chart-subtitle">First-time vs returning users (30d)</p>

          <div className="analytics-user-type-list">
            <div className="analytics-user-type-row">
              <div className="analytics-bar-list-labels">
                <span className="analytics-user-type-label">
                  <span className="analytics-legend-dot analytics-legend-dot--blue" />
                  New Users
                </span>
                <span className="analytics-bar-list-value">
                  {USER_TYPE.newUsers.toLocaleString()}{' '}
                  <span className="analytics-user-type-pct">
                    {Math.round((USER_TYPE.newUsers / USER_TYPE.totalUnique) * 100)}%
                  </span>
                </span>
              </div>
              <div className="analytics-bar-list-track">
                <div
                  className="analytics-bar-list-fill analytics-bar-list-fill--blue"
                  style={{ width: `${(USER_TYPE.newUsers / USER_TYPE.totalUnique) * 100}%` }}
                />
              </div>
            </div>

            <div className="analytics-user-type-row">
              <div className="analytics-bar-list-labels">
                <span className="analytics-user-type-label">
                  <span className="analytics-legend-dot analytics-legend-dot--teal" />
                  Returning Users
                </span>
                <span className="analytics-bar-list-value">
                  {USER_TYPE.returningUsers.toLocaleString()}{' '}
                  <span className="analytics-user-type-pct">
                    {Math.round((USER_TYPE.returningUsers / USER_TYPE.totalUnique) * 100)}%
                  </span>
                </span>
              </div>
              <div className="analytics-bar-list-track">
                <div
                  className="analytics-bar-list-fill analytics-bar-list-fill--teal"
                  style={{ width: `${(USER_TYPE.returningUsers / USER_TYPE.totalUnique) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="analytics-total-box">
            <span className="analytics-total-label">Total Unique Users (30d)</span>
            <span className="analytics-total-value">{USER_TYPE.totalUnique.toLocaleString()}</span>
          </div>
        </div>

        <div className="analytics-card">
          <h2 className="analytics-chart-title">Monthly Revenue</h2>
          <p className="analytics-chart-subtitle">Total confirmed payments received per month</p>

          <div className="analytics-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_REVENUE} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF2" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fill: '#94A3B8' }}
                  axisLine={{ stroke: '#E8ECF2' }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v / 1000}k`}
                />
                <Tooltip formatter={v => `\u20B1${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-card">
        <h2 className="analytics-chart-title analytics-chart-title--center">Mall Breakdown</h2>
        <p className="analytics-chart-subtitle analytics-chart-subtitle--center">Detailed performance per mall — last 30 days</p>

        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>MALL</th>
                <th>CITY</th>
                <th>STATUS</th>
                <th>SESSIONS (30D)</th>
                <th>LAST 7D</th>
                <th>VS PREV 7D</th>
                <th>ANNUAL FEE</th>
                <th>TOP DESTINATION</th>
              </tr>
            </thead>
            <tbody>
              {MALL_BREAKDOWN.map(row => (
                <tr key={row.mall}>
                  <td className="analytics-table-mall">{row.mall}</td>
                  <td>{row.city}</td>
                  <td>
                    <span className={`analytics-status-badge analytics-status-badge--${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.sessions30.toLocaleString()}</td>
                  <td>{row.last7.toLocaleString()}</td>
                  <td>
                    <span className={`analytics-trend analytics-trend--${row.trend}`}>
                      {row.trend === 'up' ? '\u2191' : '\u2193'} {row.vsPrev7}
                    </span>
                  </td>
                  <td>{row.fee}</td>
                  <td>{row.topDestination}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="analytics-card">
        <h2 className="analytics-chart-title analytics-chart-title--center">Top Stores by Navigation</h2>
        <p className="analytics-chart-subtitle analytics-chart-subtitle--center">Most navigated individual stores across all malls</p>

        <div className="analytics-store-list">
          {TOP_STORES.map(store => (
            <div key={store.rank} className="analytics-store-row">
              <span className="analytics-store-rank">{store.rank}</span>

              <div className="analytics-store-info">
                <span className="analytics-store-name">{store.name}</span>
                <span className="analytics-store-mall">{store.mall}</span>
              </div>

              <div className="analytics-store-metric">
                <div className="analytics-store-value-row">
                  <span className="analytics-store-value">{store.value.toLocaleString()}</span>
                  <span className="analytics-store-value-sub">navigations</span>
                </div>
                <div className="analytics-bar-list-track">
                  <div
                    className="analytics-bar-list-fill analytics-bar-list-fill--blue"
                    style={{ width: `${(store.value / TOP_STORES[0].value) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
