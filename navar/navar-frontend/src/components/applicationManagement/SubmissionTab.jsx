function FileIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M25 28H7C6.73478 28 6.48043 27.8946 6.29289 27.7071C6.10536 27.5196 6 27.2652 6 27V5C6 4.73478 6.10536 4.48043 6.29289 4.29289C6.48043 4.10536 6.73478 4 7 4H19L26 11V27C26 27.2652 25.8946 27.5196 25.7071 27.7071C25.5196 27.8946 25.2652 28 25 28Z" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 4V11H26" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function SubmissionTab({ app }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Mall Profile */}
      <div className="review-section-header">
        <div className="review-section-accent accent--green" />
        <span className="review-section-title">Mall Profile</span>
      </div>
      <div className="review-info-table">
        <div className="review-info-row">
          <span className="review-info-label">Address</span>
          <span className="review-info-value">{app.address}</span>
        </div>
        <div className="review-info-row">
          <span className="review-info-label">City, Province</span>
          <span className="review-info-value">{app.cityProvince}</span>
        </div>
        <div className="review-info-row">
          <span className="review-info-label">Floors</span>
          <span className="review-info-value">{app.floors}</span>
        </div>
        <div className="review-info-row">
          <span className="review-info-label">Stores</span>
          <span className="review-info-value">{app.storesCount}</span>
        </div>
        <div className="review-info-row">
          <span className="review-info-label">Operating Hours</span>
          <span className="review-info-value">{app.operatingHours}</span>
        </div>
        <div className="review-info-row">
          <span className="review-info-label">Logo</span>
          <span className="review-info-value">{app.logo}</span>
        </div>
      </div>

      {/* Floor Plans */}
      <div className="review-section-header">
        <div className="review-section-accent accent--grey" />
        <span className="review-section-title">Floor Plans</span>
      </div>
      {app.floorPlans.length === 0 ? (
        <p style={{ color: '#9B9C9C', fontFamily: 'Poppins', fontSize: 13 }}>No floor plans uploaded yet.</p>
      ) : (
        <div className="review-floor-plans">
          {app.floorPlans.map((fp, i) => (
            <div key={i} className="review-floor-card">
              <div className="review-floor-card-icon"><FileIcon /></div>
              <div className="review-floor-card-info">
                <div className="review-floor-card-name">{fp.floor}</div>
                <div className="review-floor-card-file">{fp.filename} · {fp.size}</div>
              </div>
              <button className="review-download-btn">Download</button>
            </div>
          ))}
        </div>
      )}

      {/* Scale Reference */}
      <div className="review-section-header">
        <div className="review-section-accent accent--blue" />
        <span className="review-section-title">Scale Reference</span>
      </div>
      <div className="review-callout review-callout--blue">
        Used to calibrate pixel-to-meter distances in the node editor. Without this, navigation timing will be inaccurate.
      </div>
      {app.scaleReference.referenceLine ? (
        <div className="review-info-table" style={{ marginBottom: 4 }}>
          <div className="review-info-row">
            <span className="review-info-label">Reference Line</span>
            <span className="review-info-value" style={{ maxWidth: 260 }}>{app.scaleReference.referenceLine}</span>
          </div>
          <div className="review-info-row">
            <span className="review-info-label">Length in meters</span>
            <span className="review-info-value">{app.scaleReference.lengthInMeters}</span>
          </div>
          <div className="review-info-row">
            <span className="review-info-label">Floor</span>
            <span className="review-info-value">{app.scaleReference.floor}</span>
          </div>
        </div>
      ) : (
        <p style={{ color: '#9B9C9C', fontFamily: 'Poppins', fontSize: 13 }}>Not provided.</p>
      )}

      {/* Accessibility Routes */}
      <div className="review-section-header">
        <div className="review-section-accent accent--red" />
        <span className="review-section-title">Accessibility Routes & Emergency Paths</span>
      </div>
      <div className="review-callout review-callout--red">
        Used to place accessible path nodes and emergency exit nodes in the AR map. Verify completeness per floor before approving.
      </div>

      <div className="review-sub-section-title sub-title--yellow">Accessible Routes</div>
      <div className="review-access-cards">
        {app.accessibilityRoutes.length === 0
          ? <p style={{ color: '#9B9C9C', fontFamily: 'Poppins', fontSize: 13 }}>No accessible routes provided.</p>
          : app.accessibilityRoutes.map((r, i) => (
            <div key={i} className="review-access-card review-access-card--yellow">
              <span className="review-access-floor-badge floor-badge--yellow">{r.floor}</span>
              <span className="review-access-text">{r.description}</span>
            </div>
          ))
        }
      </div>

      <div className="review-sub-section-title sub-title--red">Emergency Exits & Fire Exits</div>
      <div className="review-access-cards">
        {app.emergencyExits.length === 0
          ? <p style={{ color: '#9B9C9C', fontFamily: 'Poppins', fontSize: 13 }}>No emergency exits provided.</p>
          : app.emergencyExits.map((e, i) => (
            <div key={i} className="review-access-card review-access-card--grey">
              <div style={{ flex: 1 }}>
                <div className="review-access-text" style={{ fontWeight: 500, fontSize: 13, color: '#000' }}>{e.description}</div>
                {e.note && <div className="review-access-text" style={{ color: '#979797', fontSize: 10 }}>{e.note}</div>}
              </div>
              <span className="review-access-floor-badge floor-badge--grey">{e.floor}</span>
            </div>
          ))
        }
      </div>

      {/* Entry Points */}
      <div className="review-section-header">
        <div className="review-section-accent accent--red" />
        <span className="review-section-title">Entry Points</span>
      </div>
      <div className="review-access-cards">
        {app.entryPoints.length === 0
          ? <p style={{ color: '#9B9C9C', fontFamily: 'Poppins', fontSize: 13 }}>No entry points provided.</p>
          : app.entryPoints.map((ep, i) => (
            <div key={i} className="review-entry-card">
              <div className="review-entry-info">
                <div className="review-entry-name">{ep.name}</div>
                {ep.note && <div className="review-entry-note">{ep.note}</div>}
              </div>
              <span className="review-entry-floor-badge">{ep.floor}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}
