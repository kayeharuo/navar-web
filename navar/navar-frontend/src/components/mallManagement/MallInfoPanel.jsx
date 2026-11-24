import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ImageIcon } from 'lucide-react'
import AuthImage from '../ui/AuthImage'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }

function formatTime(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

function formatOperatingHours(hours) {
  if (!hours || hours.length === 0) return '—'
  return DAYS.map(day=>{
    const h=hours.find(schedule=>(schedule.days||[]).some(value=>(DAY_NAMES[value]||value).toLowerCase()===day.toLowerCase()))
    return `${day}: ${!h?'Not provided':h.closed?'Closed':`${formatTime(h.open)} – ${formatTime(h.close)}`}`
  }).join('\n')
}

function SectionHeader({ title }) {
  return <p className="mall-info-section-header">{title}</p>
}

function InfoRow({ label, value }) {
  return (
    <div className="mall-info-row">
      <span className="mall-info-label">{label}</span>
      <span className="mall-info-value">{value ?? '—'}</span>
    </div>
  )
}

export default function MallInfoPanel({ mall, onClose, onUnits, onBeacons, onEdit }) {
  const navigate = useNavigate()
  const [showLogoLightbox, setShowLogoLightbox] = useState(false)

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function handleStoresClick() {
    navigate(`/mall-management/stores/${mall.id}`)
  }
  const opHours = formatOperatingHours(mall.operatingHours)
  const cityProvince = [mall.city, mall.province].filter(Boolean).join(', ')
  const logoUrl = mall.logoUrl

  return (
    <>
      <div className="units-overlay" onClick={onClose} />

      <aside className="units-panel" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="units-panel-header">
          <div className="units-panel-header-info">
            <h2 className="mall-info-panel-title">{mall.name}</h2>
            <p className="units-panel-subtitle">{mall.city}</p>
          </div>
          <button className="units-panel-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="units-panel-divider" />

        {/* Scrollable info body */}
        <div className="mall-info-body">

          <SectionHeader title="MALL INFORMATION" />
          <InfoRow label="Address" value={mall.address} />
          <InfoRow label="Barangay" value={mall.barangay || '—'} />
          <InfoRow label="City, Province" value={cityProvince || '—'} />
          <InfoRow label="Zip Code" value={mall.zipCode} />
          <InfoRow label="Latitude" value={mall.latitude ?? '—'} />
          <InfoRow label="Longitude" value={mall.longitude ?? '—'} />
          <InfoRow label="Floors" value={mall.floors} />
          <InfoRow label="Total Floor Area" value={mall.floorDetails?.length ? `${mall.floorDetails.reduce((total, floor) => total + Number(floor.floorAreaSqm || 0), 0).toLocaleString()} sqm` : '—'} />
          <InfoRow label="Stores" value={mall.storesCount} />
          <InfoRow label="Store Capacity (Stores + Stalls)" value={mall.storeCapacity} />
          <InfoRow label="Onboarding Tenant Count" value={mall.tenantCount} />
          <InfoRow label="Units" value={mall.unitsCount ?? mall.units?.length ?? 0} />
          <InfoRow label="Operating Hours" value={opHours} />

          {/* Logo row */}
          <div className="mall-info-row">
            <span className="mall-info-label">Logo</span>
            <div className="mall-info-logo-wrap">
              {logoUrl ? (
                <button
                  className="mall-info-logo-filename-btn"
                  onClick={() => setShowLogoLightbox(true)}
                  title="Click to preview logo"
                >
                  <AuthImage src={logoUrl} className="mall-info-logo mall-info-logo--clickable" alt={`${mall.name} logo`} />
                </button>
              ) : (
                <div className="mall-info-logo-placeholder">
                  <ImageIcon size={20} className="mall-info-logo-icon" />
                  <span className="mall-info-logo-no-text">No logo</span>
                </div>
              )}
            </div>
          </div>

          <SectionHeader title="SUBSCRIPTION" />
          <InfoRow label="Initially preferred tier" value={mall.initialPreferredTier || 'Not selected'} />
          <InfoRow label="Status" value={mall.agreementStatus} />
          <InfoRow label="Tier" value={mall.tier} />
          <InfoRow label="Start Date" value={mall.agreementStartDate} />
          <InfoRow label="End Date" value={mall.agreementEndDate} />
          <InfoRow label="Annual Fee" value={mall.annualFee} />
          <InfoRow label="Grace Period" value={mall.gracePeriod} />

          <SectionHeader title="STATUSES" />
          <InfoRow label="Application" value={mall.application} />
          <InfoRow label="AR Development" value={mall.arDevelopment} />

          <SectionHeader title="BEACON" />
          <InfoRow label="Major" value={mall.majorBeacons} />
          <InfoRow label="No. of Beacons" value={mall.beaconCount} />

          <SectionHeader title="RECORD" />
          <InfoRow label="Date Added" value={mall.dateAdded} />
          <InfoRow label="Last Updated" value={mall.lastUpdated} />

          <SectionHeader title="Description / Notes" />
          <div className="mall-info-notes">
            {mall.description || 'No notes.'}
          </div>
        </div>

        <div className="units-panel-divider" />

        {/* Footer action buttons */}
        <div className="mall-info-footer">
          <button className="mall-action-btn mall-action-btn--units" onClick={onUnits}>Units</button>
          <button className="mall-action-btn mall-action-btn--stores" onClick={handleStoresClick}>Stores</button>
          <button className="mall-action-btn mall-action-btn--beacons" onClick={onBeacons}>Beacons</button>
          <button className="mall-action-btn mall-action-btn--edit" onClick={onEdit}>Edit</button>
        </div>
      </aside>

      {showLogoLightbox && logoUrl && (
        <div className="logo-lightbox-overlay" onClick={() => setShowLogoLightbox(false)}>
          <AuthImage src={logoUrl} alt={`${mall.name} logo`} className="logo-lightbox-img" />
          <button className="logo-lightbox-close" aria-label="Close preview">
            <X size={20} />
          </button>
        </div>
      )}
    </>
  )
}
