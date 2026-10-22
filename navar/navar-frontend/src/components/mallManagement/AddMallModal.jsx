import { useState, useRef, useEffect } from 'react'
import { X, Pencil, Upload, ImageIcon, AlertTriangle } from 'lucide-react'
import FloorInfoModal from './FloorInfoModal'
import OperatingHoursBuilder from './OperatingHoursBuilder'
import BusyButton from '../ui/BusyButton'
import MallLocationPicker from './MallLocationPicker'

const MAX_LOGO_MB = 5
const MALL_COVERAGE_OPTIONS = [
  'Less than or equal to 15,000 sqm',
  'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm',
  'Greater than 50,000 sqm, but less than or equal to 150,000 sqm',
  'Greater than 150,000 sqm',
]

function getLogoUrl(logo) {
  return logo?.startsWith('/')
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${logo}`
    : logo
}

export default function AddMallModal({ onClose, onSave, initialData = null, stackedOnInfoPanel = false, saveError = null }) {
  const isEdit = !!initialData

  const [form, setForm] = useState({
    mallName: initialData?.name || '',
    city: initialData?.city || '',
    province: initialData?.province || '',
    zipCode: initialData?.zipCode || '',
    address: initialData?.address || '',
    mallCoverageArea: initialData?.mallCoverageArea || '',
    description: initialData?.description || '',
    majorBeacons: initialData?.majorBeacons != null ? String(initialData.majorBeacons) : '1',
    floors: initialData?.floors != null ? String(initialData.floors) : '',
    latitude: initialData?.latitude ?? null,
    longitude: initialData?.longitude ?? null,
    agreementType: initialData?.tier || initialData?.agreementType || '',
  })

  const [logo, setLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(getLogoUrl(initialData?.logoUrl) || null)
  const [logoError, setLogoError] = useState('')

  const [floorDetails, setFloorDetails] = useState(initialData?.floorDetails || [])
  const [floorsSaved, setFloorsSaved] = useState(isEdit && (initialData?.floors ?? 0) > 0)
  const [showValidationWarning, setShowValidationWarning] = useState(false)
  const [shakingFields, setShakingFields] = useState([])
  const fieldRefs = useRef({})
  const [showFloorModal, setShowFloorModal] = useState(false)

  const [operatingHours, setOperatingHours] = useState(initialData?.operatingHours || [])

  const [errors, setErrors] = useState({})
  const fileInputRef = useRef(null)
  const prevFloors = useRef(form.floors)

  // Sync floorDetails length when floors changes
  useEffect(() => {
    const count = parseInt(form.floors) || 0
    if (count > 0) {
      setFloorDetails(prev => {
        const next = Array.from({ length: count }, (_, i) =>
          prev[i] ?? { floorNo: '', label: '' }
        )
        return next
      })
    }
  }, [form.floors])

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  function handleFloorsBlur() {
    const count = parseInt(form.floors) || 0
    const prev = parseInt(prevFloors.current) || 0
    if (count > 0 && count !== prev) {
      prevFloors.current = form.floors
      setFloorsSaved(false)
      setShowFloorModal(true)
    } else if (count > 0) {
      prevFloors.current = form.floors
    }
  }

  function handleLogoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      setLogoError(`File must be under ${MAX_LOGO_MB}MB.`)
      return
    }
    setLogoError('')
    setLogo(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleFloorSave(details) {
    setFloorDetails(details)
    setFloorsSaved(true)
    setShowFloorModal(false)
  }

  function handleLocationConfirm(location) {
    setForm(current => ({
      ...current,
      address: location.address,
      city: location.city || current.city,
      province: location.province || current.province,
      zipCode: location.zipCode || current.zipCode,
      latitude: location.latitude,
      longitude: location.longitude,
    }))
    setErrors(current => ({
      ...current,
      location: undefined,
      address: location.address ? undefined : current.address,
      city: location.city ? undefined : current.city,
      province: location.province ? undefined : current.province,
      zipCode: location.zipCode ? undefined : current.zipCode,
    }))
    window.requestAnimationFrame(() => {
      fieldRefs.current.address?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function validate() {
    const errs = {}
    if (!form.mallName.trim()) errs.mallName = 'Mall name is required.'
    if (!form.city.trim()) errs.city = 'City is required.'
    if (!form.province.trim()) errs.province = 'State/Province is required.'
    if (!form.zipCode.trim()) errs.zipCode = 'Zip code is required.'
    if (!form.address.trim()) errs.address = 'Address is required.'
    if (form.latitude == null || form.longitude == null) errs.location = 'Confirm the mall location on the map.'
    if (!form.majorBeacons || Number(form.majorBeacons) < 1) errs.majorBeacons = 'Beacon major must be at least 1.'
    if (!form.floors || parseInt(form.floors) < 1)
      errs.floors = 'At least 1 floor is required.'
    else if (!floorsSaved)
      errs.floors = 'Floor details are required.'
    if (new Set(operatingHours.flatMap(schedule => schedule.days)).size !== 7)
      errs.operatingHours = 'Set operating hours or mark Closed for all seven days.'
    if (!isEdit && !logo && !logoPreview) errs.logo = 'Logo is required.'
    if (!form.agreementType) errs.agreementType = 'Agreement type is required.'
    return errs
  }

  function focusFirstInvalidField(errs) {
    const invalidFields = Object.keys(errs)
    setShakingFields(invalidFields)
    window.setTimeout(() => {
      const firstField = fieldRefs.current[invalidFields[0]]
      firstField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      firstField?.querySelector('input, select, textarea, button')?.focus({ preventScroll: true })
    }, 0)
    window.setTimeout(() => setShakingFields([]), 600)
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setShowValidationWarning(true)
      focusFirstInvalidField(errs)
      return
    }
    const logoDataUrl = logo
      ? await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(logo)
        })
      : null

    return onSave({
      name: form.mallName.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      zipCode: form.zipCode.trim(),
      address: form.address.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      mallCoverageArea: form.mallCoverageArea || null,
      description: form.description.trim(),
      majorBeacons: Number(form.majorBeacons),
      floors: parseInt(form.floors),
      floorDetails,
      operatingHours,
      logo,
      logoUrl: logoPreview,
      logoDataUrl,
      agreementType: form.agreementType,
    })
  }

  const floorCount = parseInt(form.floors) || 0

  return (
    <>
      <div className={`modal-overlay${stackedOnInfoPanel ? ' modal-overlay--stacked' : ''}`} onClick={onClose} />

      <div className={`mall-modal${stackedOnInfoPanel ? ' mall-modal--stacked' : ''}`} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="mall-modal-header">
          <h2 className="mall-modal-title">{isEdit ? 'Edit Mall' : 'Add Mall'}</h2>
          <button className="mall-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="mall-modal-divider" />

        {/* Body */}
        <div className="mall-modal-body">
          <div className="mall-modal-grid">
            {/* Mall Name */}
            <div ref={element => { fieldRefs.current.mallName = element }} className={`mall-field-group${shakingFields.includes('mallName') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">
                MALL NAME <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.mallName ? ' mall-field-input--error' : ''}`}
                value={form.mallName}
                onChange={e => setField('mallName', e.target.value)}
                placeholder="Enter mall name"
              />
              {errors.mallName && <p className="mall-field-error">{errors.mallName}</p>}
            </div>

            <div ref={element => { fieldRefs.current.location = element }} className={`mall-field-group mall-field-group--full${shakingFields.includes('location') ? ' mall-field-group--shake' : ''}`}>
              <MallLocationPicker
                query={form.mallName}
                address={form.address}
                latitude={form.latitude}
                longitude={form.longitude}
                onConfirm={handleLocationConfirm}
              />
              {errors.location && <p className="mall-field-error">{errors.location}</p>}
            </div>

            {/* Address */}
            <div ref={element => { fieldRefs.current.address = element }} className={`mall-field-group mall-field-group--full${shakingFields.includes('address') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">FULL ADDRESS <span className="mall-field-required">*</span></label>
              <input className={`mall-field-input${errors.address ? ' mall-field-input--error' : ''}`} value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Confirm a location on the map" />
              {errors.address && <p className="mall-field-error">{errors.address}</p>}
            </div>

            {/* City */}
            <div ref={element => { fieldRefs.current.city = element }} className={`mall-field-group${shakingFields.includes('city') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">CITY <span className="mall-field-required">*</span></label>
              <input className={`mall-field-input${errors.city ? ' mall-field-input--error' : ''}`} value={form.city} onChange={e => setField('city', e.target.value)} placeholder="e.g. Cebu City" />
              {errors.city && <p className="mall-field-error">{errors.city}</p>}
            </div>

            <div ref={element => { fieldRefs.current.province = element }} className={`mall-field-group${shakingFields.includes('province') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">STATE / PROVINCE <span className="mall-field-required">*</span></label>
              <input className={`mall-field-input${errors.province ? ' mall-field-input--error' : ''}`} value={form.province} onChange={e => setField('province', e.target.value)} placeholder="e.g. Cebu" />
              {errors.province && <p className="mall-field-error">{errors.province}</p>}
            </div>

            <div ref={element => { fieldRefs.current.zipCode = element }} className={`mall-field-group${shakingFields.includes('zipCode') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">ZIP CODE <span className="mall-field-required">*</span></label>
              <input className={`mall-field-input${errors.zipCode ? ' mall-field-input--error' : ''}`} value={form.zipCode} onChange={e => setField('zipCode', e.target.value)} placeholder="e.g. 6000" />
              {errors.zipCode && <p className="mall-field-error">{errors.zipCode}</p>}
            </div>

            <div ref={element => { fieldRefs.current.floors = element }} className={`mall-field-group${shakingFields.includes('floors') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">LATITUDE</label>
              <input className="mall-field-input" value={form.latitude ?? ''} readOnly placeholder="Select a location on the map" />
            </div>
            <div ref={element => { fieldRefs.current.majorBeacons = element }} className={`mall-field-group${shakingFields.includes('majorBeacons') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">LONGITUDE</label>
              <input className="mall-field-input" value={form.longitude ?? ''} readOnly placeholder="Select a location on the map" />
            </div>

            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">MALL COVERAGE AREA (GFA)</label>
              <select className="mall-field-input" value={form.mallCoverageArea} onChange={e => setField('mallCoverageArea', e.target.value)}>
                <option value="">Select coverage area (optional)</option>
                {MALL_COVERAGE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* No. of Floors */}
            <div ref={element => { fieldRefs.current.logo = element }} className={`mall-field-group${shakingFields.includes('logo') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">
                NO. OF FLOORS <span className="mall-field-required">*</span>
              </label>
              <div className="mall-floors-input-wrap">
                <input
                  type="number"
                  min="0"
                  className={`mall-field-input${errors.floors ? ' mall-field-input--error' : ''}`}
                  value={form.floors}
                  onChange={e => setField('floors', e.target.value)}
                  onBlur={handleFloorsBlur}
                  placeholder="0"
                />
                {floorCount > 0 && (
                  <button
                    type="button"
                    className={`mall-floors-edit-btn${!floorsSaved ? ' mall-floors-edit-btn--mandatory' : ''}`}
                    onClick={() => setShowFloorModal(true)}
                    title={floorsSaved ? 'Edit floor details' : 'Floor details required — click to fill in'}
                  >
                    <Pencil size={13} strokeWidth={2} />
                  </button>
                )}
              </div>
              {errors.floors && <p className="mall-field-error">{errors.floors}</p>}
              {floorsSaved && floorCount > 0 && (
                <p className="mall-field-hint">
                  {floorCount} floor{floorCount !== 1 ? 's' : ''} configured — click pencil to edit details.
                </p>
              )}
            </div>

            <div ref={element => { fieldRefs.current.operatingHours = element }} className={`mall-field-group${shakingFields.includes('operatingHours') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">BEACON MAJOR <span className="mall-field-required">*</span></label>
              <input type="number" min="1" className={`mall-field-input${errors.majorBeacons ? ' mall-field-input--error' : ''}`} value={form.majorBeacons} onChange={e => setField('majorBeacons', e.target.value)} />
              {errors.majorBeacons && <p className="mall-field-error">{errors.majorBeacons}</p>}
            </div>

            {/* Agreement Type */}
            <div ref={element => { fieldRefs.current.agreementType = element }} className={`mall-field-group${shakingFields.includes('agreementType') ? ' mall-field-group--shake' : ''}`}>
              <label className="mall-field-label">
                AGREEMENT TYPE <span className="mall-field-required">*</span>
              </label>
              <select className={`mall-field-input${errors.agreementType ? ' mall-field-input--error' : ''}`} value={form.agreementType} onChange={e => setField('agreementType', e.target.value)}>
                <option value="">Select agreement type</option>
                <option value="Basic">Basic</option>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
              </select>
              {errors.agreementType && <p className="mall-field-error">{errors.agreementType}</p>}
            </div>

            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">MALL DESCRIPTION</label>
              <textarea className="mall-field-input mall-field-textarea" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Enter mall description" rows="3" />
            </div>

            {/* Logo */}
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">
                LOGO <span className="mall-field-required">*</span>
              </label>
              <div className="mall-logo-input-wrap">
                <button
                  type="button"
                  className="mall-logo-browse-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} strokeWidth={2} />
                  Browse Image
                </button>
                {logoPreview ? (
                  <img src={logoPreview} className="mall-logo-preview" alt="Logo preview" />
                ) : (
                  <span className="mall-logo-placeholder">
                    <ImageIcon size={14} className="mall-logo-placeholder-icon" />
                    No file chosen
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="mall-logo-hidden-input"
                onChange={handleLogoChange}
              />
              {logoError && <p className="mall-field-error">{logoError}</p>}
              {errors.logo && <p className="mall-field-error">{errors.logo}</p>}
              <p className="mall-field-hint">Image files only (JPG, PNG, SVG, WebP) · Max {MAX_LOGO_MB}MB</p>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="mall-field-group">
            <label className="mall-field-label">
              OPERATING HOURS <span className="mall-field-required">*</span>
            </label>
            <OperatingHoursBuilder value={operatingHours} onChange={setOperatingHours} />
            {errors.operatingHours && (
              <p className="mall-field-error">{errors.operatingHours}</p>
            )}
          </div>
        </div>

        {saveError && <p role="alert" className="mall-field-error">{saveError}</p>}
        {/* Footer */}
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <BusyButton className="mall-modal-save-btn" onClick={handleSave}>Save</BusyButton>
        </div>
      </div>

      {showFloorModal && floorCount > 0 && (
        <FloorInfoModal
          floorCount={floorCount}
          initialDetails={floorDetails}
          onSave={handleFloorSave}
          onClose={() => setShowFloorModal(false)}
        />
      )}

      {showValidationWarning && (
        <div className="confirm-modal-overlay" role="presentation">
          <div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="mall-validation-warning-title">
            <div className="confirm-modal-icon">
              <AlertTriangle size={66} color="#D51D1D" strokeWidth={1.8} />
            </div>
            <h3 id="mall-validation-warning-title" className="confirm-modal-title">Complete the mall details</h3>
            <p className="confirm-modal-text">Please complete the following required fields:</p>
            <ul className="confirm-modal-list">
              {Object.values(errors).map(error => <li key={error}>{error}</li>)}
            </ul>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" onClick={() => setShowValidationWarning(false)}>Okay</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
