import { useState } from 'react'
import { X, Plus } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
const fullDay = day => DAY_NAMES[day] || day

function formatTime(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

function formatDays(days) {
  if (!days || days.length === 0) return ''
  if (days.length === 7) return 'Daily'

  const sorted = [...days].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
  const groups = []
  let group = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prevIdx = DAYS.indexOf(group[group.length - 1])
    const currIdx = DAYS.indexOf(sorted[i])
    if (currIdx === prevIdx + 1) {
      group.push(sorted[i])
    } else {
      groups.push(group)
      group = [sorted[i]]
    }
  }
  groups.push(group)

  return groups
    .map(g => (g.length === 1 ? g[0] : `${g[0]} – ${g[g.length - 1]}`))
    .join(', ')
}

export default function OperatingHoursBuilder({ value, onChange }) {
  const [current, setCurrent] = useState({ days: [], open: '09:00', close: '18:00', closed: false })
  const [error, setError] = useState('')

  const normalizedValue = value.map(schedule => ({ ...schedule, days: schedule.days.map(fullDay) }))
  const usedDays = normalizedValue.flatMap(s => s.days)

  function toggleDay(day) {
    if (usedDays.includes(day)) return
    setCurrent(c => ({
      ...c,
      days: c.days.includes(day) ? c.days.filter(d => d !== day) : [...c.days, day],
    }))
    setError('')
  }

  function addSchedule() {
    if (current.days.length === 0) {
      setError('Select at least one day.')
      return
    }
    if (!current.closed && (!current.open || !current.close)) {
      setError('Enter open and close times.')
      return
    }
    setError('')
    onChange([...normalizedValue, { ...current, open: current.closed ? null : current.open, close: current.closed ? null : current.close }])
    setCurrent({ days: [], open: '09:00', close: '18:00', closed: false })
  }

  function removeSchedule(index) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="op-hours-builder">
      <div className="op-hours-days">
        {DAYS.map(day => {
          const isActive = current.days.includes(day)
          const isUsed = usedDays.includes(day)
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              disabled={isUsed}
              title={isUsed ? 'Already scheduled' : undefined}
              className={`op-hours-day-btn${isActive ? ' op-hours-day-btn--active' : ''}${isUsed ? ' op-hours-day-btn--used' : ''}`}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="op-hours-time-row">
        <label className="op-hours-closed-toggle">
          <input type="checkbox" checked={current.closed} onChange={e => setCurrent(c => ({ ...c, closed: e.target.checked }))} />
          <span>Closed</span>
        </label>
        <div className="op-hours-time-group">
          <label className="op-hours-time-label">Opens</label>
          <input
            type="time"
            className="op-hours-time-input"
            value={current.open}
            disabled={current.closed}
            onChange={e => setCurrent(c => ({ ...c, open: e.target.value }))}
          />
        </div>
        <span className="op-hours-separator">to</span>
        <div className="op-hours-time-group">
          <label className="op-hours-time-label">Closes</label>
          <input
            type="time"
            className="op-hours-time-input"
            value={current.close}
            disabled={current.closed}
            onChange={e => setCurrent(c => ({ ...c, close: e.target.value }))}
          />
        </div>
        <button type="button" className="op-hours-add-btn" onClick={addSchedule}>
          <Plus size={13} strokeWidth={2.5} />
          Add Schedule
        </button>
      </div>

      {error && <p className="mall-field-error">{error}</p>}

      {value.length > 0 && (
        <ul className="op-hours-list">
          {normalizedValue.map((schedule, index) => (
            <li key={index} className="op-hours-item">
              <span className="op-hours-item-dot" />
              <span className="op-hours-item-text">
                <strong>{formatDays(schedule.days)}</strong>: {schedule.closed ? 'Closed' : `${formatTime(schedule.open)} – ${formatTime(schedule.close)}`}
              </span>
              <button
                type="button"
                className="op-hours-remove-btn"
                onClick={() => removeSchedule(index)}
                aria-label="Remove schedule"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
