import { useState, useRef, useEffect } from 'react'
import { X, ImageIcon } from 'lucide-react'

const BRAND_CATEGORIES = [
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

export default function AddBrandModal({ initialData = null, onClose, onSave }) {
  const isEdit = !!initialData

  const [form, setForm] = useState({
    name:        initialData?.name        || '',
    category:    initialData?.category    || '',
    description: initialData?.description || '',
  })

  const [logo, setLogo]               = useState(null)
  const [logoPreview, setLogoPreview] = useState(initialData?.logo || null)
  const [errors, setErrors]           = useState({})
  const fileInputRef = useRef(null)

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

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

  function validate() {
    const errs = {}
    if (!form.name.trim())     errs.name     = 'Brand name is required.'
    if (!form.category)        errs.category = 'Category is required.'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave({
      name:        form.name.trim(),
      category:    form.category,
      description: form.description.trim(),
      logo:        logoPreview,
    })
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="mall-modal" role="dialog" aria-modal="true">
        <div className="mall-modal-header">
          <h2 className="mall-modal-title">{isEdit ? 'Edit Brand' : 'Add Brand'}</h2>
          <button className="mall-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="mall-modal-divider" />

        <div className="mall-modal-body">
          {/* Brand Name */}
          <div className="mall-field-group">
            <label className="mall-field-label">
              BRAND NAME <span className="mall-field-required">*</span>
            </label>
            <input
              className={`mall-field-input${errors.name ? ' mall-field-input--error' : ''}`}
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Enter brand name"
            />
            {errors.name && <p className="mall-field-error">{errors.name}</p>}
          </div>

          {/* Category */}
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
              {BRAND_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <p className="mall-field-error">{errors.category}</p>}
          </div>

          {/* Description */}
          <div className="mall-field-group">
            <label className="mall-field-label">DESCRIPTION</label>
            <textarea
              className="mall-field-input brand-description-input"
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Short brand description"
              rows={4}
            />
          </div>

          {/* Store Logo */}
          <div className="mall-field-group">
            <label className="mall-field-label">STORE LOGO</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="mall-logo-hidden-input"
              onChange={handleLogoChange}
            />
            {logoPreview ? (
              <div className="mall-logo-input-wrap">
                <img src={logoPreview} alt="Brand logo" className="brand-logo-preview-img" />
                <button
                  type="button"
                  className="mall-logo-browse-btn"
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
        </div>

        <div className="mall-modal-divider" />
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="mall-modal-save-btn" onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Add Brand'}
          </button>
        </div>
      </div>
    </>
  )
}

export { BRAND_CATEGORIES }
