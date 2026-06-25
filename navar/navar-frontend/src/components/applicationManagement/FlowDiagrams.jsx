const APP_FLOW_STEPS = [
  { label: 'Draft', sub: 'Not Submitted', variant: 'grey' },
  { arrow: 'right' },
  { label: 'Submitted', sub: 'Needs Review', variant: 'blue' },
  { arrow: 'swap' },
  { label: 'For Revision', sub: 'Sent back', variant: 'red' },
  { arrow: 'right' },
  { label: 'Approved', sub: 'Unlocks AR dev', variant: 'green' },
]

const AR_FLOW_STEPS = [
  { label: 'AR: Pending', sub: 'In work queue', variant: 'orange' },
  { arrow: 'right' },
  { label: 'Node Mapping', sub: 'Team Mapping', variant: 'blue' },
  { arrow: 'right' },
  { label: 'Testing', sub: 'QA Phase', variant: 'purple' },
  { arrow: 'right' },
  { label: 'Ready', sub: 'Pre-activation', variant: 'yellow' },
  { arrow: 'right' },
  { label: 'Live', sub: 'Public', variant: 'green' },
  { arrow: 'swap' },
  { label: 'Unpublished', sub: 'Hidden', variant: 'red' },
]

function RightArrow() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
      <path d="M0 9H22" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 0L22 9L13 18" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SwapArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M8 16L4 20L0 16" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 0V20" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 4L16 0L20 4" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 20V0" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FlowDiagram({ label, steps }) {
  return (
    <div className="app-mgmt-flow-card">
      <div className="app-mgmt-flow-label">{label}</div>
      <div className="app-mgmt-flow-steps">
        {steps.map((item, i) => {
          if (item.arrow === 'right') {
            return (
              <div key={i} className="app-mgmt-flow-arrow">
                <RightArrow />
              </div>
            )
          }
          if (item.arrow === 'swap') {
            return (
              <div key={i} className="app-mgmt-flow-swap">
                <SwapArrow />
              </div>
            )
          }
          return (
            <div key={i} className={`app-mgmt-flow-step flow-step--${item.variant}`}>
              <span className="app-mgmt-flow-step-badge" style={{ color: 'currentColor', borderColor: 'currentColor' }}>
                {item.label}
              </span>
              <span className="app-mgmt-flow-step-sub">{item.sub}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FlowDiagrams() {
  return (
    <div className="app-mgmt-flows">
      <FlowDiagram label="APPLICATION FLOW" steps={APP_FLOW_STEPS} />
      <FlowDiagram label="AR DEVELOPMENT FLOW" steps={AR_FLOW_STEPS} />
    </div>
  )
}
