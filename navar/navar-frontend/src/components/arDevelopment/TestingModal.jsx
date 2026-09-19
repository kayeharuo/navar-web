export default function TestingModal({ mallName, errors, onCancel, onProceed }) {
  const hasErrors = errors && errors.length > 0

  return (
    <div className="ar-modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="ar-modal-box">
        <h3 className="ar-modal-title">Submit {mallName} for Testing?</h3>
        <p className="ar-modal-subtitle">
          This will submit the map for navigation testing (QA phase).{' '}
          {hasErrors
            ? <span style={{ color: '#D51D1D' }}>Fix the issues below before proceeding.</span>
            : 'No issues detected. Ready to proceed.'}
        </p>

        {hasErrors ? (
          <>
            <div className="ar-modal-errors-label">ISSUES FOUND</div>
            <ul className="ar-modal-errors-list">
              {errors.map((err, i) => (
                <li key={i} className="ar-modal-error-item">
                  <span className="ar-modal-error-dot" />
                  {err}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="ar-modal-success">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#16A34A" />
              <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All checks passed. Navigation testing can begin.
          </div>
        )}

        <div className="ar-modal-actions">
          <button className="ar-modal-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="ar-modal-btn-proceed"
            onClick={onProceed}
            disabled={hasErrors}
          >
            Proceed to Navigation Testing
          </button>
        </div>
      </div>
    </div>
  )
}
