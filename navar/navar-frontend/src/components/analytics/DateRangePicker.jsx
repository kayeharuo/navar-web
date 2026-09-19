import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isSameDay(a, b) {
  return !!a && !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

function CalendarMonth({ viewDate, onPrev, onNext, range, onPick, showPrev, showNext }) {
  const cells = buildMonthGrid(viewDate)
  const { from, to } = range

  const inRange = (day) => {
    if (!from || !to || !day) return false
    return day > from && day < to
  }

  return (
    <div className="daterange-month">
      <div className="daterange-month-header">
        <button
          type="button"
          className="daterange-nav-btn"
          onClick={onPrev}
          style={{ visibility: showPrev ? 'visible' : 'hidden' }}
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="daterange-month-label">
          {MONTH_LABELS[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          className="daterange-nav-btn"
          onClick={onNext}
          style={{ visibility: showNext ? 'visible' : 'hidden' }}
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="daterange-weekday-row">
        {WEEKDAY_LABELS.map(w => (
          <span key={w} className="daterange-weekday">{w}</span>
        ))}
      </div>

      <div className="daterange-day-grid">
        {cells.map((day, i) => {
          if (!day) return <span key={i} className="daterange-day daterange-day--empty" />
          const isFrom = isSameDay(day, from)
          const isTo = isSameDay(day, to)
          const classNames = ['daterange-day']
          if (isFrom || isTo) classNames.push('daterange-day--selected')
          if (inRange(day)) classNames.push('daterange-day--in-range')
          return (
            <button
              key={i}
              type="button"
              className={classNames.join(' ')}
              onClick={() => onPick(day)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false)
  const [leftMonth, setLeftMonth] = useState(() => new Date(from.getFullYear(), from.getMonth(), 1))
  const [draftRange, setDraftRange] = useState({ from, to })
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (open) setDraftRange({ from, to })
  }, [open, from, to])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const rightMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1)

  const handlePick = (day) => {
    setDraftRange(prev => {
      if (!prev.from || (prev.from && prev.to)) {
        return { from: day, to: null }
      }
      if (day < prev.from) return { from: day, to: prev.from }
      return { from: prev.from, to: day }
    })
  }

  const handleApply = () => {
    if (draftRange.from && draftRange.to) {
      onChange(draftRange)
      setOpen(false)
    }
  }

  const handleCancel = () => {
    setDraftRange({ from, to })
    setOpen(false)
  }

  return (
    <div className="daterange-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="daterange-trigger"
        onClick={() => setOpen(prev => !prev)}
      >
        <Calendar size={14} className="daterange-trigger-icon" />
        <span>{formatDate(from)} — {formatDate(to)}</span>
      </button>

      {open && (
        <div className="daterange-popover">
          <div className="daterange-months">
            <CalendarMonth
              viewDate={leftMonth}
              onPrev={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))}
              onNext={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))}
              range={draftRange}
              onPick={handlePick}
              showPrev
              showNext={false}
            />
            <CalendarMonth
              viewDate={rightMonth}
              onPrev={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))}
              onNext={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))}
              range={draftRange}
              onPick={handlePick}
              showPrev={false}
              showNext
            />
          </div>

          <div className="daterange-footer">
            <div className="daterange-selection">
              <span className="daterange-selection-label">From</span>
              <span className="daterange-selection-value">{draftRange.from ? formatDate(draftRange.from) : 'Select date'}</span>
              <span className="daterange-selection-label">To</span>
              <span className="daterange-selection-value">{draftRange.to ? formatDate(draftRange.to) : 'Select date'}</span>
            </div>
            <div className="daterange-actions">
              <button type="button" className="daterange-btn daterange-btn--ghost" onClick={handleCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="daterange-btn daterange-btn--primary"
                onClick={handleApply}
                disabled={!draftRange.from || !draftRange.to}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
