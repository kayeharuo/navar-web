import { useState } from 'react'
import { X } from 'lucide-react'

export default function AddBeaconModal({ mall, initialData = null, onClose, onSave, isEdit = false }) {
  const [form, setForm] = useState({
    beaconCode:  initialData?.beaconCode  || '',
    floorNo:     initialData?.floorNo     || '',
    label:       initialData?.label       || '',
    minor:       initialData?.minor       != null ? String(initialData.minor) : '',
    txPower:     initialData?.txPower     != null ? String(initialData.txPower) : '-59',
    linkedNode:  initialData?.linkedNode  || '',
  })

  const [errors, setErrors] = useState({})
  const floors = mall.floorDetails || []
  const major = mall.major || 1

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const errs = {}
    if (!form.beaconCode.trim()) errs.beaconCode = 'Beacon code is required.'
    if (!form.floorNo)           errs.floorNo    = 'Floor is required.'
    if (!form.label.trim())      errs.label      = 'Label is required.'
    if (!form.minor.trim())      errs.minor      = 'Minor is required.'
    if (!form.txPower.trim())    errs.txPower    = 'TX Power is required.'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const floorDetail = floors.find(f => f.floorNo === form.floorNo)
    onSave({
      beaconCode:  form.beaconCode.trim(),
      floorNo:     form.floorNo,
      floorLabel:  floorDetail?.label || form.floorNo,
      label:       form.label.trim(),
      major,
      minor:       parseInt(form.minor) || 0,
      txPower:     parseInt(form.txPower) || -59,
      linkedNode:  form.linkedNode.trim(),
    })
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="mall-modal" role="dialog" aria-modal="true">
        <div className="mall-modal-header">
          <h2 className="mall-modal-title">{isEdit ? 'Edit Beacon' : 'Add Beacon'}</h2>
          <button className="mall-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mall-modal-divider" />

        <div className="mall-modal-body">
          <div className="mall-modal-grid">
            {/* Beacon Code */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                BEACON CODE <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.beaconCode ? ' mall-field-input--error' : ''}`}
                value={form.beaconCode}
                onChange={e => setField('beaconCode', e.target.value)}
                placeholder="e.g. BCN-0001"
              />
              {errors.beaconCode && <p className="mall-field-error">{errors.beaconCode}</p>}
            </div>

            {/* Floor */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                FLOOR <span className="mall-field-required">*</span>
              </label>
              <select
                className={`mall-field-input${errors.floorNo ? ' mall-field-input--error' : ''}`}
                value={form.floorNo}
                onChange={e => setField('floorNo', e.target.value)}
              >
                <option value="">Select floor</option>
                {floors.map(f => (
                  <option key={f.floorNo} value={f.floorNo}>
                    {f.label || f.floorNo}
                  </option>
                ))}
              </select>
              {errors.floorNo && <p className="mall-field-error">{errors.floorNo}</p>}
            </div>

            {/* Label */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                LABEL <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.label ? ' mall-field-input--error' : ''}`}
                value={form.label}
                onChange={e => setField('label', e.target.value)}
                placeholder="e.g. Zara Entrance"
              />
              {errors.label && <p className="mall-field-error">{errors.label}</p>}
            </div>

            {/* Major (read-only) */}
            <div className="mall-field-group">
              <label className="mall-field-label">MAJOR</label>
              <input
                className="mall-field-input"
                value={major}
                readOnly
                title="Major is set by the mall and cannot be changed."
              />
              <p className="mall-field-hint">Set by the mall — read-only</p>
            </div>

            {/* Minor */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                MINOR <span className="mall-field-required">*</span>
              </label>
              <input
                type="number"
                className={`mall-field-input${errors.minor ? ' mall-field-input--error' : ''}`}
                value={form.minor}
                onChange={e => setField('minor', e.target.value)}
                placeholder="e.g. 101"
              />
              {errors.minor && <p className="mall-field-error">{errors.minor}</p>}
            </div>

            {/* TX Power */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                TX POWER (dBm) <span className="mall-field-required">*</span>
              </label>
              <input
                type="number"
                className={`mall-field-input${errors.txPower ? ' mall-field-input--error' : ''}`}
                value={form.txPower}
                onChange={e => setField('txPower', e.target.value)}
                placeholder="-59"
              />
              {errors.txPower && <p className="mall-field-error">{errors.txPower}</p>}
            </div>

            {/* Linked Node */}
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">LINKED NODE</label>
              <input
                className="mall-field-input"
                value={form.linkedNode}
                onChange={e => setField('linkedNode', e.target.value)}
                placeholder="Enter linked node identifier"
              />
            </div>
          </div>
        </div>

        <div className="mall-modal-divider" />
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="mall-modal-save-btn" onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Add Beacon'}
          </button>
        </div>
      </div>
    </>
  )
}
