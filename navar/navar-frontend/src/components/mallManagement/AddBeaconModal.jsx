import { useState, useRef, useEffect } from 'react'
import { X, Pencil, ChevronDown } from 'lucide-react'

// Mock AR development versions
const AR_VERSIONS = [
  { id: 'v1', name: 'Version 1' },
  { id: 'v2', name: 'Version 2' },
  { id: 'v3', name: 'Version 3' },
  { id: 'v4', name: 'Version 4' },
]

function getNextBatteryId(mall) {
  const batteryIds = (mall.beacons || []).flatMap(beacon => beacon.batteryHistory || [])
    .map(battery => Number(battery.batteryId?.match(/^BAT-(\d+)$/)?.[1]) || 0)
  const nextNumber = Math.max(0, ...batteryIds) + 1
  return `BAT-${String(nextNumber).padStart(4, '0')}`
}

function NodeSelectModal({ numNodes, mallNodes, selectedNodeConfig, onSave, onClose }) {
  const [localConfig, setLocalConfig] = useState(selectedNodeConfig || [])
  const [expandedVersion, setExpandedVersion] = useState(null)

  function toggleNodeForVersion(versionId, nodeId) {
    setLocalConfig(prev => {
      const hasVersion = prev.find(n => n.versionId === versionId)
      if (hasVersion && hasVersion.nodeId === nodeId) {
        return prev.filter(n => n.versionId !== versionId)
      }
      if (hasVersion) {
        return prev.map(n => n.versionId === versionId ? { versionId, nodeId } : n)
      }
      if (prev.length >= numNodes) return prev
      return [...prev, { versionId, nodeId }]
    })
  }

  // eslint-disable-next-line no-unused-vars
  const versionUsed = (versionId) => localConfig.some(n => n.versionId === versionId)
  const selectedForVersion = (versionId) => localConfig.find(n => n.versionId === versionId)?.nodeId

  return (
    <>
      <div className="unit-assign-overlay" />
      <div className="unit-assign-modal" role="dialog" aria-modal="true">
        <div className="mall-modal-header">
          <h2 className="mall-modal-title">
            Select Nodes ({localConfig.length}/{numNodes})
          </h2>
          <button className="mall-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="mall-modal-divider" />

        <p className="node-select-hint">
          Each node links this beacon to one AR version. Select one node per version — no duplicate versions.
        </p>

        <div className="unit-assign-list">
          {AR_VERSIONS.map(ver => {
            const versionNodes = mallNodes.filter(n => n.versionId === ver.id)
            const isExpanded = expandedVersion === ver.id
            const selectedNode = selectedForVersion(ver.id)
            const hasSelection = !!selectedNode

            return (
              <div key={ver.id}>
                <button
                  className={`node-version-btn${hasSelection ? ' node-version-btn--selected' : ''}`}
                  onClick={() => setExpandedVersion(isExpanded ? null : ver.id)}
                >
                  <span className="node-version-name">{ver.name}</span>
                  {selectedNode && (
                    <span className="node-version-selected">{selectedNode}</span>
                  )}
                  <ChevronDown size={16} className={`node-version-chevron${isExpanded ? ' node-version-chevron--open' : ''}`} />
                </button>

                {isExpanded && versionNodes.length > 0 && (
                  <div className="node-list">
                    {versionNodes.map(node => {
                      const isSelected = selectedNode === node.nodeId
                      return (
                        <div
                          key={node.nodeId}
                          className={`unit-assign-item${isSelected ? ' unit-assign-item--selected' : ''}`}
                          onClick={() => toggleNodeForVersion(ver.id, node.nodeId)}
                        >
                          <span className="unit-assign-no">{node.nodeId}</span>
                          {isSelected && (
                            <span className="unit-assign-badge unit-assign-badge--vacant">SELECTED</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mall-modal-divider" />
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="mall-modal-save-btn" onClick={() => onSave(localConfig)}>
            Save
          </button>
        </div>
      </div>
    </>
  )
}

export default function AddBeaconModal({ mall, initialData = null, onClose, onSave, isEdit = false }) {
  const initialNodeConfig = initialData?.nodeConfig || []

  const [form, setForm] = useState({
    beaconCode: initialData?.beaconCode  || '',
    floorNo:    initialData?.floorNo     || '',
    location:   initialData?.location    || '',
    label:      initialData?.label       || '',
    minor:      initialData?.minor       != null ? String(initialData.minor) : '',
    txPower:    initialData?.txPower     != null ? String(initialData.txPower) : '-59',
    numNodes:   initialData?.numNodes    != null ? String(initialData.numNodes) : '',
    dateInstalled: initialData?.dateInstalled || '',
    lastMaintenanceDate: initialData?.lastMaintenanceDate || '',
    batteryId: initialData?.batteryHistory?.find(battery => battery.status === 'current')?.batteryId || getNextBatteryId(mall),
    batteryInstallDate: initialData?.batteryHistory?.find(battery => battery.status === 'current')?.installDate || initialData?.dateInstalled || '',
    batteryBrand: initialData?.batteryHistory?.find(battery => battery.status === 'current')?.brand || '',
  })

  const [nodeConfig, setNodeConfig] = useState(initialNodeConfig)
  const [nodesSaved, setNodesSaved] = useState(initialNodeConfig.length > 0)
  const [showNodeSelect, setShowNodeSelect] = useState(false)
  const prevNumNodes = useRef(form.numNodes)

  const [errors, setErrors] = useState({})
  const floors = mall.floorDetails || []
  const major = mall.major || 1

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

  function handleNumNodesChange(val) {
    setField('numNodes', val)
    const next = parseInt(val) || 0
    if (next !== nodeConfig.length) {
      setNodeConfig([])
      setNodesSaved(false)
    }
  }

  function handleNumNodesBlur() {
    const count = parseInt(form.numNodes) || 0
    const prev = parseInt(prevNumNodes.current) || 0
    if (count > 0 && (count !== prev || !nodesSaved)) {
      prevNumNodes.current = form.numNodes
      setNodesSaved(false)
      setShowNodeSelect(true)
    }
  }

  function handleNodeSave(config) {
    setNodeConfig(config)
    setNodesSaved(config.length > 0)
    setShowNodeSelect(false)
  }

  function validate() {
    const errs = {}
    if (!form.beaconCode.trim()) errs.beaconCode = 'Beacon code is required.'
    if (!form.floorNo)           errs.floorNo    = 'Floor is required.'
    if (!form.label.trim())      errs.label      = 'Label is required.'
    if (!form.minor.trim())      errs.minor      = 'Minor is required.'
    if (!form.txPower.trim())    errs.txPower    = 'TX Power is required.'
    if (!form.dateInstalled)      errs.dateInstalled = 'Installation date is required.'
    if (!form.batteryId.trim())   errs.batteryId = 'Battery ID is required.'
    if (!form.batteryInstallDate) errs.batteryInstallDate = 'Battery install date is required.'
    if (!form.batteryBrand.trim()) errs.batteryBrand = 'Battery brand is required.'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const floorDetail = floors.find(f => f.floorNo === form.floorNo)
    const numNodes = parseInt(form.numNodes) || 0
    const configDisplay = nodeConfig.map(nc => {
      const ver = AR_VERSIONS.find(v => v.id === nc.versionId)
      return `${ver?.name}: ${nc.nodeId}`
    })
    onSave({
      beaconCode:      form.beaconCode.trim(),
      floorNo:         form.floorNo,
      floorLabel:      floorDetail?.label || form.floorNo,
      location:        form.location.trim(),
      label:           form.label.trim(),
      major,
      minor:           parseInt(form.minor) || 0,
      txPower:         parseInt(form.txPower) || -59,
      numNodes,
      nodeConfig,
      nodeConfigDisplay: configDisplay.join('; '),
      dateInstalled:     form.dateInstalled,
      lastMaintenanceDate: form.lastMaintenanceDate || '—',
      batteryHistory: initialData?.batteryHistory?.length
        ? initialData.batteryHistory.map(battery => battery.status === 'current'
          ? { ...battery, batteryId: form.batteryId.trim(), installDate: form.batteryInstallDate, brand: form.batteryBrand.trim() }
          : battery
        )
        : [{
            id: Date.now(),
            batteryId: form.batteryId.trim(),
            status: 'current',
            installDate: form.batteryInstallDate,
            replacedDate: null,
            brand: form.batteryBrand.trim(),
          }],
    })
  }

  const numNodes = parseInt(form.numNodes) || 0

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

            {/* Location */}
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">LOCATION</label>
              <input
                className="mall-field-input"
                value={form.location}
                onChange={e => setField('location', e.target.value)}
                placeholder="e.g. Near Zara entrance, North Wing"
              />
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

            {/* Installation and maintenance */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                DATE INSTALLED <span className="mall-field-required">*</span>
              </label>
              <input
                type="date"
                className={`mall-field-input${errors.dateInstalled ? ' mall-field-input--error' : ''}`}
                value={form.dateInstalled}
                onChange={e => setField('dateInstalled', e.target.value)}
              />
              {errors.dateInstalled && <p className="mall-field-error">{errors.dateInstalled}</p>}
            </div>
            <div className="mall-field-group">
              <label className="mall-field-label">LAST MAINTENANCE / REPLACEMENT</label>
              <input
                type="date"
                className="mall-field-input"
                value={form.lastMaintenanceDate}
                onChange={e => setField('lastMaintenanceDate', e.target.value)}
              />
            </div>

            {/* Battery */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                BATTERY ID (AUTO-GENERATED)
              </label>
              <input
                className="mall-field-input"
                value={form.batteryId}
                readOnly
              />
              {errors.batteryId && <p className="mall-field-error">{errors.batteryId}</p>}
            </div>
            <div className="mall-field-group">
              <label className="mall-field-label">
                BATTERY INSTALL DATE <span className="mall-field-required">*</span>
              </label>
              <input
                type="date"
                className={`mall-field-input${errors.batteryInstallDate ? ' mall-field-input--error' : ''}`}
                value={form.batteryInstallDate}
                onChange={e => setField('batteryInstallDate', e.target.value)}
              />
              {errors.batteryInstallDate && <p className="mall-field-error">{errors.batteryInstallDate}</p>}
            </div>
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">
                BATTERY BRAND <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.batteryBrand ? ' mall-field-input--error' : ''}`}
                value={form.batteryBrand}
                onChange={e => setField('batteryBrand', e.target.value)}
                placeholder="e.g. Panasonic CR2477"
              />
              {errors.batteryBrand && <p className="mall-field-error">{errors.batteryBrand}</p>}
            </div>

            {/* No. of Nodes */}
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">NO. OF NODES</label>
              <div className="mall-floors-input-wrap">
                <input
                  type="number"
                  min="0"
                  className="mall-field-input"
                  value={form.numNodes}
                  onChange={e => handleNumNodesChange(e.target.value)}
                  onBlur={handleNumNodesBlur}
                  placeholder="0"
                />
                {numNodes > 0 && (
                  <button
                    type="button"
                    className={`mall-floors-edit-btn${!nodesSaved ? ' mall-floors-edit-btn--mandatory' : ''}`}
                    onClick={() => setShowNodeSelect(true)}
                    title={nodesSaved ? 'Edit node assignments' : 'Node assignment required — click to assign'}
                  >
                    <Pencil size={13} strokeWidth={2} />
                  </button>
                )}
              </div>
              {nodesSaved && nodeConfig.length > 0 && (
                <p className="mall-field-hint">
                  {nodeConfig.map(nc => {
                    const ver = AR_VERSIONS.find(v => v.id === nc.versionId)
                    return `${ver?.name}: ${nc.nodeId}`
                  }).join('; ')}
                </p>
              )}
              <p className="mall-field-hint">Select one node per version. Can use nodes from any available version.</p>
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

      {showNodeSelect && numNodes > 0 && (
        <NodeSelectModal
          numNodes={numNodes}
          mallNodes={mall.nodes || []}
          selectedNodeConfig={nodeConfig}
          onSave={handleNodeSave}
          onClose={() => setShowNodeSelect(false)}
        />
      )}
    </>
  )
}
