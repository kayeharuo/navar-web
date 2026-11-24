import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import BusyButton from '../ui/BusyButton'
import ActionResultModal from '../ui/ActionResultModal'

function getMallCodePrefix(name) {
  const words = String(name || 'MALL').toUpperCase().match(/[A-Z0-9]+/g) || ['MALL']
  return words.slice(0, 3).map(word => word[0]).join('') || 'MALL'
}

function getNextGeneratedCode(rows, field, prefix, suffix) {
  const pattern = new RegExp(`^${prefix}-${suffix}-(\\d+)$`, 'i')
  const highest = rows.reduce((max, row) => {
    const match = pattern.exec(row[field] || '')
    return Math.max(max, match ? Number(match[1]) : 0)
  }, 0)
  return `${prefix}-${suffix}-${String(highest + 1).padStart(4, '0')}`
}

export default function AddBeaconModal({ mall, initialData = null, onClose, onSave, isEdit = false, editorMode = false }) {
  const [validationResult,setValidationResult]=useState(null)
  const arVersions = mall.arVersions || []
  const initialNodeConfig = initialData?.nodeConfig || []
  const codePrefix = getMallCodePrefix(mall.name)
  const generatedBeaconCode = getNextGeneratedCode(mall.beacons || [], 'beaconCode', codePrefix, 'BCN')
  const batteryRows = (mall.beacons || []).flatMap(beacon => beacon.batteryHistory || [])
  const generatedBatteryId = getNextGeneratedCode(batteryRows, 'batteryId', codePrefix, 'BAT')
  const floors = mall.floorDetails || []

  const [form, setForm] = useState({
    beaconCode: initialData?.beaconCode || generatedBeaconCode,
    location:   initialData?.location    || '',
    label:      initialData?.label       || '',
    minor:      initialData?.minor       != null ? String(initialData.minor) : '',
    txPower:    initialData?.txPower     != null ? String(initialData.txPower) : '-30',
    dateInstalled: initialData?.dateInstalled || '',
    lastMaintenanceDate: initialData?.lastMaintenanceDate || initialData?.lastReplacementDate || '',
    batteryId: initialData?.batteryHistory?.find(battery => battery.status === 'current')?.batteryId || generatedBatteryId,
    batteryInstallDate: initialData?.batteryHistory?.find(battery => battery.status === 'current')?.installDate || initialData?.dateInstalled || '',
    batteryBrand: initialData?.batteryHistory?.find(battery => battery.status === 'current')?.brand || '',
  })

  const [nodeConfig, setNodeConfig] = useState(initialNodeConfig)
  const [nodeFloors, setNodeFloors] = useState(() => Object.fromEntries(initialNodeConfig.map(item => {
    const node = (mall.nodes || []).find(candidate => candidate.nodeId === item.nodeId)
    const floor = floors.find(candidate => String(candidate.id) === String(node?.floorId))
    return [item.versionId, floor?.floorNo || '']
  })))
  const shakeTimer = useRef(null)

  const [errors, setErrors] = useState({})
  const [shakeFields, setShakeFields] = useState(false)
  const major = mall.majorBeacons ?? mall.major ?? 1

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

  function validate() {
    const errs = {}
    if (isEdit && !form.beaconCode.trim()) errs.beaconCode = 'Beacon code is required.'
    if (!form.label.trim())      errs.label      = 'Label is required.'
    if (!form.minor.trim())      errs.minor      = 'Minor is required.'
    if (!form.txPower.trim())    errs.txPower    = 'TX Power is required.'
    if (!form.dateInstalled)      errs.dateInstalled = 'Installation date is required.'
    if (isEdit && !form.batteryId.trim()) errs.batteryId = 'Battery ID is required.'
    if (!form.batteryInstallDate) errs.batteryInstallDate = 'Battery install date is required.'
    if (!form.batteryBrand.trim()) errs.batteryBrand = 'Battery brand is required.'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setShakeFields(false)
      window.clearTimeout(shakeTimer.current)
      window.requestAnimationFrame(() => setShakeFields(true))
      shakeTimer.current = window.setTimeout(() => setShakeFields(false), 500)
      setValidationResult({success:false,title:'Complete the required fields',message:'Please check the highlighted beacon fields before saving.'})
      return
    }
    const numNodes = nodeConfig.length
    const configDisplay = nodeConfig.map(nc => {
            const ver = arVersions.find(v => v.id === nc.versionId)
      return `${ver?.name}: ${nc.nodeId}`
    })
    return onSave({
      beaconCode:      isEdit || editorMode ? form.beaconCode.trim() : '',
      location:        form.location.trim(),
      label:           form.label.trim(),
      major,
      minor:           parseInt(form.minor) || 0,
      txPower:         parseInt(form.txPower) || -30,
      numNodes,
      nodeConfig,
      batteryBrand: form.batteryBrand.trim(),
      batteryInstallDate: form.batteryInstallDate,
      nodeConfigDisplay: configDisplay.join('; '),
      dateInstalled:     form.dateInstalled,
      lastMaintenanceDate: form.lastMaintenanceDate || null,
      batteryHistory: initialData?.batteryHistory?.length
        ? initialData.batteryHistory.map(battery => battery.status === 'current'
          ? { ...battery, batteryId: form.batteryId.trim(), installDate: form.batteryInstallDate, brand: form.batteryBrand.trim() }
          : battery
        )
        : [{
            id: `${form.batteryInstallDate}-${form.batteryBrand.trim()}`,
            batteryId: form.batteryId.trim(),
            status: 'current',
            installDate: form.batteryInstallDate,
            replacedDate: null,
            brand: form.batteryBrand.trim(),
          }],
    })
  }

  const numNodes = nodeConfig.length

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      {validationResult&&<ActionResultModal result={validationResult} onClose={()=>setValidationResult(null)}/>}
      <div className="mall-modal" role="dialog" aria-modal="true">
        <div className="mall-modal-header">
          <div><h2 className="mall-modal-title">{editorMode ? isEdit ? 'Edit map beacon' : 'Add map beacon' : isEdit ? 'Edit Beacon' : 'Add Beacon'}</h2>
          {editorMode && <p className="ne-beacon-form-hint">Stage these changes in the editor, then save a snapshot to keep them.</p>}</div>
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
                className={`mall-field-input${errors.beaconCode ? ' mall-field-input--error' : ''}${shakeFields && errors.beaconCode ? ' mall-field-input--shake' : ''}`}
                value={form.beaconCode}
                onChange={e => setField('beaconCode', e.target.value)}
                readOnly={!isEdit}
                disabled={!isEdit}
              />
              {errors.beaconCode && <p className="mall-field-error">{errors.beaconCode}</p>}
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
                className={`mall-field-input${errors.label ? ' mall-field-input--error' : ''}${shakeFields && errors.label ? ' mall-field-input--shake' : ''}`}
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
                className={`mall-field-input${errors.minor ? ' mall-field-input--error' : ''}${shakeFields && errors.minor ? ' mall-field-input--shake' : ''}`}
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
                className={`mall-field-input${errors.txPower ? ' mall-field-input--error' : ''}${shakeFields && errors.txPower ? ' mall-field-input--shake' : ''}`}
                value={form.txPower}
                onChange={e => setField('txPower', e.target.value)}
                placeholder="-59"
              />
              {errors.txPower && <p className="mall-field-error">{errors.txPower}</p>}
            </div>

            {/* Beacon installation */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                DATE INSTALLED <span className="mall-field-required">*</span>
              </label>
              <input
                type="date"
                className={`mall-field-input${errors.dateInstalled ? ' mall-field-input--error' : ''}${shakeFields && errors.dateInstalled ? ' mall-field-input--shake' : ''}`}
                value={form.dateInstalled}
                onChange={e => setField('dateInstalled', e.target.value)}
              />
              {errors.dateInstalled && <p className="mall-field-error">{errors.dateInstalled}</p>}
            </div>
            {/* Battery */}
            <div className="mall-field-group">
              <label className="mall-field-label">
                BATTERY ID
              </label>
              <input
                className="mall-field-input"
                value={form.batteryId}
                readOnly
                disabled
              />
              {errors.batteryId && <p className="mall-field-error">{errors.batteryId}</p>}
            </div>
            <div className="mall-field-group">
              <label className="mall-field-label">
                BATTERY INSTALL DATE <span className="mall-field-required">*</span>
              </label>
              <input
                type="date"
                className={`mall-field-input${errors.batteryInstallDate ? ' mall-field-input--error' : ''}${shakeFields && errors.batteryInstallDate ? ' mall-field-input--shake' : ''}`}
                value={form.batteryInstallDate}
                onChange={e => setField('batteryInstallDate', e.target.value)}
              />
              {errors.batteryInstallDate && <p className="mall-field-error">{errors.batteryInstallDate}</p>}
            </div>
            <div className="mall-field-group">
              <label className="mall-field-label">LAST MAINTENANCE</label>
              <input
                type="date"
                className="mall-field-input"
                value={form.lastMaintenanceDate}
                onChange={e => setField('lastMaintenanceDate', e.target.value)}
              />
            </div>
            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">
                BATTERY BRAND <span className="mall-field-required">*</span>
              </label>
              <input
                className={`mall-field-input${errors.batteryBrand ? ' mall-field-input--error' : ''}${shakeFields && errors.batteryBrand ? ' mall-field-input--shake' : ''}`}
                value={form.batteryBrand}
                onChange={e => setField('batteryBrand', e.target.value)}
                placeholder="e.g. Panasonic CR2477"
              />
              {errors.batteryBrand && <p className="mall-field-error">{errors.batteryBrand}</p>}
            </div>

            <div className="mall-field-group mall-field-group--full">
              <label className="mall-field-label">NODE ASSIGNMENTS ({numNodes})</label>
              <p className="mall-field-hint">Choose up to one node for each AR development version.</p>
              {arVersions.length === 0 && <p className="mall-field-hint">No AR development versions are available yet.</p>}
              {arVersions.map(version => {
                const versionNodes = (mall.nodes || []).filter(node => node.versionId === version.id)
                const selectedNodeId = nodeConfig.find(item => item.versionId === version.id)?.nodeId
                const assignedNodeIds = new Set((mall.beacons || []).filter(beacon => String(beacon.id) !== String(initialData?.id)&&!['deactivated','inactive','retired'].includes(beacon.status)).flatMap(beacon => (beacon.nodeConfig || []).filter(item => item.versionId === version.id).map(item => item.nodeId)))
                const floorNo = nodeFloors[version.id] || ''
                const selectedFloor = floors.find(floor => String(floor.floorNo) === String(floorNo))
                const availableNodes = versionNodes.filter(node => String(node.floorId) === String(selectedFloor?.id) && (!assignedNodeIds.has(node.nodeId) || node.nodeId === selectedNodeId))
                return <div key={version.id} className="mall-field-group">
                  <label className="mall-field-label" htmlFor={`beacon-version-${version.id}`}>{version.name}</label>
                  <select className="mall-field-input" value={floorNo} onChange={event => { const value = event.target.value; setNodeFloors(current => ({ ...current, [version.id]: value })); setNodeConfig(previous => previous.filter(item => item.versionId !== version.id)) }}>
                    <option value="">Select floor first</option>
                    {floors.map(floor => <option key={floor.floorNo} value={floor.floorNo}>{floor.label || floor.floorNo}</option>)}
                  </select>
                  <select id={`beacon-version-${version.id}`} className="mall-field-input" value={selectedNodeId || ''} disabled={!floorNo} onChange={event => {
                    const nodeId = editorMode ? event.target.value : Number(event.target.value)
                    setNodeConfig(previous => [...previous.filter(item => item.versionId !== version.id), ...(nodeId ? [{ versionId: version.id, nodeId }] : [])])
                  }}>
                    <option value="">{!floorNo ? 'Choose a floor first' : availableNodes.length ? 'No node linked' : 'No available nodes on this floor'}</option>
                    {availableNodes.map(node => <option key={node.nodeId} value={node.nodeId}>{node.label || `Node ${node.nodeId}`} (#{node.nodeId})</option>)}
                  </select>
                </div>
              })}
            </div>
          </div>
        </div>

        <div className="mall-modal-divider" />
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <BusyButton className="mall-modal-save-btn" onClick={handleSave}>
            {editorMode ? 'Stage beacon changes' : isEdit ? 'Save Changes' : 'Add Beacon'}
          </BusyButton>
        </div>
      </div>

    </>
  )
}
