import { useState, useRef, useEffect } from 'react'
import { X, Pencil, Upload, ImageIcon } from 'lucide-react'
import FloorInfoModal from './FloorInfoModal'
import OperatingHoursBuilder from './OperatingHoursBuilder'

const MAX_LOGO_MB = 5

export default function AddMallModal({ onClose, onSave, initialData = null, stackedOnInfoPanel = false }) {
  const isEdit = !!initialData

  const [form, setForm] = useState({
    mallName: initialData?.name || '',
    city: initialData?.city || '',
    address: initialData?.address || '',
    floors: initialData?.floors != null ? String(initialData.floors) : '',
    agreementType: initialData?.tier || 'Standard',
  })

  const [logo, setLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(initialData?.logoUrl || null)
  const [logoError, setLogoError] = useState('')

  const [floorDetails, setFloorDetails] = useState(initialData?.floorDetails || [])
  const [floorsSaved, setFloorsSaved] = useState(isEdit && (initialData?.floors ?? 0) > 0)
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

  function validate() {
    const errs = {}
    if (!form.mallName.trim()) errs.mallName = 'Mall name is required.'
    if (!form.city.trim()) errs.city = 'City is required.'
    if (!form.address.trim()) errs.address = 'Address is required.'
    if (!form.floors || parseInt(form.floors) < 1)
      errs.floors = 'At least 1 floor is required.'
    if (operatingHours.length === 0)
      errs.operatingHours = 'At least one operating schedule is required.'
    if (!logo && !logoPreview) errs.logo = 'Logo is required.'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({
      name: form.mallName.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      floors: parseInt(form.floors),
      tier: form.agreementType,
      floorDetails,
      operatingHours,
      logo,
      logoUrl: logoPreview,
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
            <div className="mall-field-group">
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

            {/* City */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                CITY <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.city ? ' mall-field-input--error' : ''}`}
                value={form.city}
                onChange={e => setField('city', e.target.value)}
                placeholder="Enter city"
              />
              {errors.city && <p className="mall-field-error">{errors.city}</p>}
            </div>

            {/* Address */}
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">
                ADDRESS <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.address ? ' mall-field-input--error' : ''}`}
                value={form.address}
                onChange={e => setField('address', e.target.value)}
                placeholder="Enter full address"
              />
              {errors.address && <p className="mall-field-error">{errors.address}</p>}
            </div>

            {/* No. of Floors */}
            <div className="mall-field-group">
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

            {/* Agreement Type */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                AGREEMENT TYPE
              </label>
              <select
                className="mall-field-input"
                value={form.agreementType}
                onChange={e => setField('agreementType', e.target.value)}
              >
                <option value="Premium">Premium</option>
                <option value="Standard">Standard</option>
                <option value="Basic">Basic</option>
              </select>
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

        {/* Footer */}
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="mall-modal-save-btn" onClick={handleSave}>Save</button>
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
    </>
  )
}
