function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 4L6 11.5L2.5 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const STEPS = ['Draft', 'Submitted', 'For Revision', 'Approved']

function getStepState(stepIndex, currentStatus) {
  const stepOrder = { 'Draft': 0, 'Submitted': 1, 'For Revision': 2, 'Approved': 3 }
  const current = stepOrder[currentStatus] ?? 0

  if (stepIndex < current) return 'done'
  if (stepIndex === current) {
    if (currentStatus === 'For Revision') return 'warning'
    return 'active'
  }
  return 'inactive'
}

export default function Stepper({ status }) {
  const stepOrder = { 'Draft': 0, 'Submitted': 1, 'For Revision': 2, 'Approved': 3 }
  const currentIdx = stepOrder[status] ?? 0

  return (
    <div className="review-stepper">
      {STEPS.map((step, i) => {
        const state = getStepState(i, status)
        const circleClass = `review-stepper-circle stepper-circle--${state}`
        const labelClass = `review-stepper-label ${state !== 'inactive' ? `stepper-label--${state}` : ''}`
        const lineIsDone = i < currentIdx
        const lineClass = `review-stepper-line ${lineIsDone ? 'review-stepper-line--done' : ''}`

        return (
          <div key={step} style={{ display: 'flex', alignItems: 'flex-start', flex: i < STEPS.length - 1 ? 1 : undefined, gap: 0 }}>
            <div className="review-stepper-step">
              <div className={circleClass}>
                {state === 'done' ? <CheckIcon /> : i + 1}
              </div>
              <span className={labelClass}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={lineClass} />
            )}
          </div>
        )
      })}
    </div>
  )
}
