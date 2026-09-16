import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2 } from 'lucide-react'

let nextUnitId = 1000

export default function UnitsPanel({ mall, onClose, onSave, stackedOnInfoPanel = false }) {
  const [units, setUnits] = useState(mall.units ? [...mall.units] : [])
  const [addFloor, setAddFloor] = useState('')
  const [addUnitNo, setAddUnitNo] = useState('')
  const [addError, setAddError] = useState('')
  const [editingUnit, setEditingUnit] = useState(null)

  const floors = mall.floorDetails || []

  function handleAddUnit() {
    if (!addFloor) {
      setAddError('Select a floor.')
      return
    }
    if (!addUnitNo.trim()) {
      setAddError('Enter a unit number.')
      return
    }
    const duplicate = units.find(
      u => u.floorNo === addFloor && u.unitNo.trim().toLowerCase() === addUnitNo.trim().toLowerCase() && u.isActive !== false
    )
    if (duplicate) {
      setAddError('This unit number already exists on that floor.')
      return
    }
    setAddError('')
    setUnits(prev => [
      ...prev,
      { id: nextUnitId++, floorNo: addFloor, unitNo: addUnitNo.trim(), status: 'vacant', isActive: true },
    ])
    setAddUnitNo('')
  }

  function handleEditUnit() {
    if (!editingUnit?.unitNo?.trim()) return
    const duplicate = units.find(unit => unit.id !== editingUnit.id && unit.floorNo === editingUnit.floorNo && unit.unitNo.toLowerCase() === editingUnit.unitNo.trim().toLowerCase())
    if (duplicate) return setAddError('This unit number already exists on that floor.')
    setUnits(prev => prev.map(unit => unit.id === editingUnit.id ? { ...unit, floorNo: editingUnit.floorNo, unitNo: editingUnit.unitNo.trim() } : unit))
    setEditingUnit(null)
    setAddError('')
  }

  function handleRemoveUnit(unit) {
    if (unit.status === 'occupied') return setAddError(`${unit.unitNo} is occupied and cannot be removed.`)
    setUnits(prev => prev.filter(item => item.id !== unit.id))
  }

  async function handleSave() {
    try { await onSave(units); onClose() } catch (error) { setAddError(error.message || 'Could not save units.') }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleAddUnit()
  }

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <>
      <div className={`units-overlay${stackedOnInfoPanel ? ' units-overlay--stacked' : ''}`} onClick={onClose} />

      <aside className={`units-panel${stackedOnInfoPanel ? ' units-panel--stacked' : ''}`} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="units-panel-header">
          <div className="units-panel-header-info">
            <h2 className="units-panel-title">Units — {mall.name}</h2>
            <p className="units-panel-subtitle">{mall.city}</p>
          </div>
          <button className="units-panel-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="units-panel-divider" />

        {/* Units list — scrollable */}
        <div className="units-list-area">
          {floors.length === 0 ? (
            <p className="units-no-floors">No floor information available. Set up floors first.</p>
          ) : (
            floors.map(floor => {
              const floorUnits = units.filter(u => u.floorNo === floor.floorNo)
              return (
                <div key={floor.floorNo} className="units-floor-section">
                  <p className="units-floor-label">{floor.label}</p>

                  {floorUnits.length === 0 ? (
                    <p className="units-empty-floor">No Units on this Floor yet.</p>
                  ) : (
                    <ul className="units-list">
                      {floorUnits.map(unit => (
                        <li key={unit.id} className={`units-card${unit.isActive === false ? ' units-card--inactive' : ''}`}>
                          <span className="units-card-number">{unit.unitNo}</span>

                          {unit.status === 'occupied' ? (
                            <span className="units-badge units-badge--occupied">OCCUPIED</span>
                          ) : (
                            <span className="units-badge units-badge--vacant">VACANT</span>
                          )}

                          <div className="units-card-actions">
                            <button className="units-action-btn units-action-btn--edit" onClick={() => setEditingUnit({ ...unit })}><Pencil size={16} /> Edit</button>
                            <button className="units-action-btn units-action-btn--remove" disabled={unit.status === 'occupied'} title={unit.status === 'occupied' ? 'Occupied units cannot be removed.' : 'Remove unit'} onClick={() => handleRemoveUnit(unit)}><Trash2 size={16} /> Remove</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="units-panel-divider" />

        {/* Add Unit section */}
        <div className="units-add-section">
          <p className="units-add-label">{editingUnit ? 'EDIT UNIT' : 'ADD UNIT'}</p>

          <div className="units-add-form">
            <div className="units-add-field">
              <label className="units-add-field-label">Floor</label>
              <select
                className="units-add-select"
                value={editingUnit ? editingUnit.floorNo : addFloor}
                onChange={e => editingUnit ? setEditingUnit(unit => ({ ...unit, floorNo: e.target.value })) : (setAddFloor(e.target.value), setAddError(''))}
              >
                <option value="">Select</option>
                {floors.map(floor => (
                  <option key={floor.floorNo} value={floor.floorNo}>
                    {floor.floorNo} — {floor.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="units-add-field units-add-field--grow">
              <label className="units-add-field-label">Unit No.</label>
              <input
                type="text"
                className="units-add-input"
                value={editingUnit ? editingUnit.unitNo : addUnitNo}
                onChange={e => editingUnit ? setEditingUnit(unit => ({ ...unit, unitNo: e.target.value })) : (setAddUnitNo(e.target.value), setAddError(''))}
                onKeyDown={editingUnit ? e => e.key === 'Enter' && handleEditUnit() : handleKeyDown}
                placeholder="e.g. G-01, L2-04"
              />
            </div>

            <button
              type="button"
              className="units-add-plus-btn"
              onClick={editingUnit ? handleEditUnit : handleAddUnit}
              aria-label={editingUnit ? 'Save unit' : 'Add unit'}
            >
              {editingUnit ? <Pencil size={18} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}
            </button>
          </div>

          {addError && <p className="mall-field-error">{addError}</p>}

          <div className="units-footer-btns">
            <button className="units-footer-btn units-footer-btn--cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="units-footer-btn units-footer-btn--save" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
