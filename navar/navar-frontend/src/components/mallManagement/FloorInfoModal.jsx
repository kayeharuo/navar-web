import { useState } from 'react'
import { X } from 'lucide-react'

export default function FloorInfoModal({ floorCount, initialDetails, onSave, onClose }) {
  const [details, setDetails] = useState(() => {
    const arr = []
    for (let i = 0; i < floorCount; i++) {
      arr.push(
        initialDetails && initialDetails[i]
          ? { ...initialDetails[i] }
          : { floorNo: '', label: '' }
      )
    }
    return arr
  })

  const [errors, setErrors] = useState([])

  function handleChange(index, field, value) {
    setDetails(prev => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
    setErrors(prev => prev.filter(e => !(e.index === index && e.field === field)))
  }

  function validate() {
    const errs = []
    details.forEach((d, i) => {
      if (!d.floorNo.trim()) errs.push({ index: i, field: 'floorNo' })
      if (!d.label.trim()) errs.push({ index: i, field: 'label' })
    })
    return errs
  }

  function hasError(index, field) {
    return errors.some(e => e.index === index && e.field === field)
  }

  function handleSave() {
    const errs = validate()
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    onSave(details)
  }

  return (
    <>
      <div className="modal-overlay modal-overlay--front" onClick={onClose} />
      <div className="floor-modal">
        <div className="mall-modal-header">
          <h2 className="mall-modal-title">Floor Information</h2>
          <button className="mall-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="mall-modal-divider" />

        <div className="floor-modal-body">
          {details.map((detail, index) => (
            <div key={index} className="floor-modal-row">
              <div className="mall-field-group">
                <label className="mall-field-label">
                  FLOOR NO. <span className="mall-field-required">*</span>
                </label>
                <input
                  className={`mall-field-input${hasError(index, 'floorNo') ? ' mall-field-input--error' : ''}`}
                  value={detail.floorNo}
                  onChange={e => handleChange(index, 'floorNo', e.target.value)}
                  placeholder={`e.g. ${index + 1}`}
                />
              </div>
              <div className="mall-field-group">
                <label className="mall-field-label">
                  FLOOR LABEL <span className="mall-field-required">*</span>
                </label>
                <input
                  className={`mall-field-input${hasError(index, 'label') ? ' mall-field-input--error' : ''}`}
                  value={detail.label}
                  onChange={e => handleChange(index, 'label', e.target.value)}
                  placeholder="e.g. Ground Floor"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Close</button>
          <button className="mall-modal-save-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </>
  )
}
