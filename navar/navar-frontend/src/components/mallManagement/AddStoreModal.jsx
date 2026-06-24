import { useState, useRef } from 'react'
import { X, Pencil, ImageIcon } from 'lucide-react'

const CATEGORIES = [
  'Fashion & Apparel',
  'Books & Hobby',
  'Health & Beauty',
  'Food & Beverages',
  'Electronics',
  'Sports & Fitness',
  'Services',
  'Retail & General',
  'Entertainment',
  'Others',
]

const MAX_LOGO_MB = 2

function UnitAssignModal({ count, units, selected, onSave, onClose }) {
  const [localSelected, setLocalSelected] = useState(selected || [])

  function toggleUnit(unitNo) {
    setLocalSelected(prev => {
      if (prev.includes(unitNo)) return prev.filter(u => u !== unitNo)
      if (prev.length >= count) return prev
      return [...prev, unitNo]
    })
  }

  return (
    <>
      <div className="unit-assign-overlay" />
      <div className="unit-assign-modal" role="dialog" aria-modal="true">
        <div className="mall-modal-header">
          <h2 className="mall-modal-title">
            Select Units ({localSelected.length}/{count})
          </h2>
          <button className="mall-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="mall-modal-divider" />

        <div className="unit-assign-list">
          {units.length === 0 ? (
            <p className="unit-assign-empty">No units available in this mall. Add units first via the Units button.</p>
          ) : units.map(u => (
            <div
              key={u.id}
              className={`unit-assign-item${localSelected.includes(u.unitNo) ? ' unit-assign-item--selected' : ''}`}
              onClick={() => toggleUnit(u.unitNo)}
            >
              <span className="unit-assign-no">{u.unitNo}</span>
              <span className="unit-assign-floor">{u.floorNo}</span>
              <span className={`unit-assign-badge unit-assign-badge--${u.status}`}>
                {u.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        <div className="mall-modal-divider" />
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="mall-modal-save-btn" onClick={() => onSave(localSelected)}>
            Save
          </button>
        </div>
      </div>
    </>
  )
}

export default function AddStoreModal({
  brand,
  mall,
  initialData = null,
  onClose,
  onSave,
  onChangeBrand,
  isEdit = false,
}) {
  const isOthers = brand?.isOthers

  const [form, setForm] = useState({
    storeName:     initialData?.storeName     || '',
    numUnits:      initialData?.unitNos?.length ? String(initialData.unitNos.length) : '',
    contactPerson: initialData?.contactPerson || '',
    contactNo:     initialData?.contactNo     || '',
    email:         initialData?.email         || '',
    status:        initialData?.status        || 'unmapped',
    brandName:     isOthers ? (initialData?.brand || '') : '',
    category:      isOthers ? (initialData?.category || '') : (brand?.category || ''),
    description:   initialData?.description   || '',
  })

  const [unitNos, setUnitNos]       = useState(initialData?.unitNos || [])
  const [unitsSaved, setUnitsSaved] = useState((initialData?.unitNos?.length || 0) > 0)
  const [showUnitAssign, setShowUnitAssign] = useState(false)

  const [logo, setLogo]             = useState(null)
  const [logoPreview, setLogoPreview] = useState(initialData?.brandLogo || null)
  const fileInputRef = useRef(null)

  const [errors, setErrors] = useState({})

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  function handleLogoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      setErrors(e => ({ ...e, logo: `Logo must be under ${MAX_LOGO_MB}MB.` }))
      return
    }
    setLogo(file)
    setLogoPreview(URL.createObjectURL(file))
    setErrors(e => ({ ...e, logo: undefined }))
  }

  function handleNumUnitsChange(val) {
    setField('numUnits', val)
    const next = parseInt(val) || 0
    if (next !== unitNos.length) {
      setUnitNos([])
      setUnitsSaved(false)
    }
  }

  function handleNumUnitsBlur() {
    const count = parseInt(form.numUnits) || 0
    if (count > 0 && !unitsSaved) {
      setShowUnitAssign(true)
    }
  }

  function handleUnitsSave(selected) {
    setUnitNos(selected)
    setUnitsSaved(selected.length > 0)
    setShowUnitAssign(false)
  }

  function validate() {
    const errs = {}
    if (!form.storeName.trim()) errs.storeName = 'Store name is required.'
    if (form.numUnits === '' || parseInt(form.numUnits) < 0) errs.numUnits = 'Enter a valid number of units (0 or more).'
    if (!form.status) errs.status = 'Status is required.'
    if (isOthers && !form.category) errs.category = 'Category is required.'
    if (isOthers && !logo && !logoPreview) errs.logo = 'Logo is required for unlisted brands.'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave({
      storeName:     form.storeName.trim(),
      unitNos,
      contactPerson: form.contactPerson.trim(),
      contactNo:     form.contactNo.trim(),
      email:         form.email.trim(),
      status:        form.status,
      brand:         isOthers ? form.brandName.trim() : brand?.name,
      brandLogo:     isOthers ? logoPreview : (brand?.logo || null),
      category:      isOthers ? form.category : brand?.category,
      description:   form.description.trim(),
    })
  }

  const numUnits = parseInt(form.numUnits) || 0
  const mallUnits = (mall?.units || []).filter(u => u.status === 'vacant')

  return (
    <>
      <div className="add-store-overlay" onClick={onClose} />
      <div className="add-store-modal" role="dialog" aria-modal="true">
        <div className="mall-modal-header">
          <h2 className="mall-modal-title">{isEdit ? 'Edit Store' : 'Add Store'}</h2>
          <button className="mall-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="mall-modal-divider" />

        <div className="mall-modal-body">
          {/* Brand selected row (for known brands) */}
          {!isOthers && brand && (
            <div className="brand-selected-row">
              <div className="brand-selected-logo-box">
                <span className="brand-card-initial">{brand.name?.charAt(0)}</span>
              </div>
              <div className="brand-selected-info">
                <p className="brand-selected-name">{brand.name}</p>
                <p className="brand-selected-sub">Brand Selected</p>
              </div>
              {!isEdit && (
                <button className="brand-change-btn" type="button" onClick={onChangeBrand}>
                  Change
                </button>
              )}
            </div>
          )}

          <div className="mall-modal-grid">
            {/* Store Name */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                STORE NAME <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.storeName ? ' mall-field-input--error' : ''}`}
                value={form.storeName}
                onChange={e => setField('storeName', e.target.value)}
                placeholder="Enter store name"
              />
              {errors.storeName && <p className="mall-field-error">{errors.storeName}</p>}
            </div>

            {/* No. of Units */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                NO. OF UNIT/S <span className="mall-field-required">*</span>
              </label>
              <div className="mall-floors-input-wrap">
                <input
                  type="number"
                  min="0"
                  className={`mall-field-input${errors.numUnits ? ' mall-field-input--error' : ''}`}
                  value={form.numUnits}
                  onChange={e => handleNumUnitsChange(e.target.value)}
                  onBlur={handleNumUnitsBlur}
                  placeholder="0"
                />
                {numUnits > 0 && (
                  <button
                    type="button"
                    className={`mall-floors-edit-btn${!unitsSaved ? ' mall-floors-edit-btn--mandatory' : ''}`}
                    onClick={() => setShowUnitAssign(true)}
                    title={unitsSaved ? 'Change unit assignment' : 'Unit assignment required — click to assign'}
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </div>
              {unitsSaved && unitNos.length > 0 && (
                <p className="mall-field-hint">Assigned: {unitNos.join(', ')}</p>
              )}
              {errors.numUnits && <p className="mall-field-error">{errors.numUnits}</p>}
            </div>

            {/* Contact Person */}
            <div className="mall-field-group">
              <label className="mall-field-label">CONTACT PERSON</label>
              <input
                className="mall-field-input"
                value={form.contactPerson}
                onChange={e => setField('contactPerson', e.target.value)}
                placeholder="Enter contact person"
              />
            </div>

            {/* Contact No. */}
            <div className="mall-field-group">
              <label className="mall-field-label">CONTACT NO.</label>
              <input
                className="mall-field-input"
                value={form.contactNo}
                onChange={e => setField('contactNo', e.target.value)}
                placeholder="Enter contact number"
              />
            </div>

            {/* Email */}
            <div className="mall-field-group">
              <label className="mall-field-label">EMAIL</label>
              <input
                type="email"
                className="mall-field-input"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                placeholder="Enter email"
              />
            </div>

            {/* Status */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                STATUS <span className="mall-field-required">*</span>
              </label>
              <select
                className={`mall-field-input${errors.status ? ' mall-field-input--error' : ''}`}
                value={form.status}
                onChange={e => setField('status', e.target.value)}
              >
                <option value="unmapped">Unmapped</option>
                <option value="mapped">Mapped</option>
              </select>
              {errors.status && <p className="mall-field-error">{errors.status}</p>}
            </div>

            {/* Others only: Category */}
            {isOthers && (
              <div className="mall-field-group">
                <label className="mall-field-label">
                  CATEGORY <span className="mall-field-required">*</span>
                </label>
                <select
                  className={`mall-field-input${errors.category ? ' mall-field-input--error' : ''}`}
                  value={form.category}
                  onChange={e => setField('category', e.target.value)}
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="mall-field-error">{errors.category}</p>}
              </div>
            )}

            {/* Others only: Brand Name */}
            {isOthers && (
              <div className="mall-field-group">
                <label className="mall-field-label">BRAND NAME</label>
                <input
                  className="mall-field-input"
                  value={form.brandName}
                  onChange={e => setField('brandName', e.target.value)}
                  placeholder="Enter brand name"
                />
              </div>
            )}
          </div>

          {/* Others only: Logo upload */}
          {isOthers && (
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">
                STORE LOGO <span className="mall-field-required">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="mall-logo-hidden-input"
                onChange={handleLogoChange}
              />
              {logoPreview ? (
                <div className="mall-logo-input-wrap">
                  <img src={logoPreview} alt="Store logo" className="mall-logo-preview" />
                  <button
                    className="mall-logo-browse-btn"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div
                  className="store-logo-upload"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                >
                  <ImageIcon size={56} color="#9B9C9C" />
                  <span className="store-logo-upload-text">Click to upload Logo</span>
                  <span className="store-logo-upload-hint">PNG, JPG up to {MAX_LOGO_MB}MB</span>
                </div>
              )}
              {errors.logo && <p className="mall-field-error">{errors.logo}</p>}
            </div>
          )}
        </div>

        <div className="mall-modal-divider" />
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="mall-modal-save-btn" onClick={handleSave}>
            {isEdit ? 'Save' : 'Add Store'}
          </button>
        </div>
      </div>

      {/* Unit Assignment Sub-Modal */}
      {showUnitAssign && (
        <UnitAssignModal
          count={numUnits}
          units={mallUnits}
          selected={unitNos}
          onSave={handleUnitsSave}
          onClose={() => setShowUnitAssign(false)}
        />
      )}
    </>
  )
}
