import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../config/api'
import '../styles/applicationManagement/applicationManagementTesting.css'

const blankFloor = () => ({
  image: null,
  referenceLine: '',
  meterLength: '',
  accessibilityRoute: '',
  emergencyRoute: '',
  entryPoints: [{ label: '', description: '' }],
})

function validateFloor(floor) {
  if (!floor?.image) return 'Upload a floor plan image (PNG or JPEG, up to 10 MB).'
  if (!floor.referenceLine.trim()) return 'Describe the scale reference for this floor.'
  if (!(Number(floor.meterLength) > 0)) return 'Enter the real-world length in meters (greater than 0).'
  return ''
}

export default function ApplicationManagementTesting() {
  const [options, setOptions] = useState({ malls: [], floors: [] })
  const [mallId, setMallId] = useState('')
  const [floorData, setFloorData] = useState({})
  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest('/api/testing/applications/options').then(setOptions).catch(error => setMessage(error.message))
  }, [])

  const mall = options.malls.find(item => String(item.mall_id) === String(mallId))
  // Every floor of the mall is part of the application, taken one at a time from the first floor.
  const mallFloors = useMemo(
    () => options.floors
      .filter(floor => String(floor.mall_id) === String(mallId))
      .sort((a, b) => (a.floor_num ?? 0) - (b.floor_num ?? 0) || a.floor_id - b.floor_id),
    [options.floors, mallId],
  )

  const floor = mallFloors[step]
  const data = floor ? floorData[floor.floor_id] || blankFloor() : null
  const isLast = step === mallFloors.length - 1
  const blocked = mall && !mall.canSubmit

  function selectMall(value) {
    setMallId(value)
    setFloorData({})
    setStep(0)
    setStepError('')
    setMessage('')
  }

  function updateFloor(field, value) {
    setFloorData(current => ({
      ...current,
      [floor.floor_id]: { ...(current[floor.floor_id] || blankFloor()), [field]: value },
    }))
    setStepError('')
  }

  function updateEntry(index, field, value) {
    updateFloor('entryPoints', data.entryPoints.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      updateFloor('image', null)
      setStepError('Floor plans must be PNG or JPEG images.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      updateFloor('image', null)
      setStepError('Each floor plan must be 10 MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => updateFloor('image', { dataUrl: reader.result, fileName: file.name, mimeType: file.type, fileSize: file.size })
    reader.readAsDataURL(file)
  }

  function goNext() {
    const problem = validateFloor(data)
    if (problem) { setStepError(problem); return }
    setStepError('')
    setStep(current => current + 1)
  }

  function goBack() {
    setStepError('')
    setStep(current => Math.max(0, current - 1))
  }

  async function submit() {
    const problem = validateFloor(data)
    if (problem) { setStepError(problem); return }
    setSaving(true)
    setMessage('')
    try {
      const floors = mallFloors.map(item => ({ floorId: item.floor_id, ...(floorData[item.floor_id] || blankFloor()) }))
      const result = await apiRequest('/api/testing/applications', {
        method: 'POST',
        body: JSON.stringify({ mallId: Number(mallId), floors }),
      })
      setMessage(`Created application #${result.application_id} (version ${result.application_version}) for ${result.mallName}.`)
      const refreshed = await apiRequest('/api/testing/applications/options')
      setOptions(refreshed)
      setMallId('')
      setFloorData({})
      setStep(0)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="application-testing">
      <h1>Application Testing Intake</h1>
      <p className="application-testing-warning">Temporary super-admin testing page. This route is not linked from normal navigation.</p>

      <label>Mall
        <select value={mallId} onChange={event => selectMall(event.target.value)}>
          <option value="">Select mall</option>
          {options.malls.map(item => (
            <option key={item.mall_id} value={item.mall_id}>{item.mall_name}</option>
          ))}
        </select>
      </label>

      {mall && !blocked && (
        <p className="application-testing-info">This will create version {mall.nextVersion} for {mall.mall_name}.</p>
      )}
      {blocked && <p className="application-testing-blocked">{mall.blockedReason}</p>}
      {mall && !blocked && mallFloors.length === 0 && (
        <p className="application-testing-blocked">This mall has no floors yet. Add its floors in Mall Management first.</p>
      )}

      {mall && !blocked && floor && (
        <section className="application-testing-floor">
          <div className="application-testing-progress">
            <span>Floor {step + 1} of {mallFloors.length}</span>
            <div className="application-testing-dots" aria-hidden="true">
              {mallFloors.map((item, index) => (
                <span key={item.floor_id} className={`application-testing-dot${index === step ? ' application-testing-dot--active' : ''}${index < step ? ' application-testing-dot--done' : ''}`} />
              ))}
            </div>
          </div>
          <h2>{floor.floor_name || `Floor ${floor.floor_num ?? floor.floor_id}`}</h2>

          <label>Floor plan image
            <input type="file" accept="image/png,image/jpeg" onChange={handleFile} />
            {data.image && <span className="application-testing-file">Selected: {data.image.fileName}</span>}
          </label>
          <label>Scale reference
            <input value={data.referenceLine} onChange={event => updateFloor('referenceLine', event.target.value)} placeholder="e.g. Entrance A to Room A is 5 meters" />
          </label>
          <label>Meter length
            <input type="number" min="1" value={data.meterLength} onChange={event => updateFloor('meterLength', event.target.value)} />
          </label>
          <label>Accessibility route
            <textarea value={data.accessibilityRoute} onChange={event => updateFloor('accessibilityRoute', event.target.value)} />
          </label>
          <label>Emergency route
            <textarea value={data.emergencyRoute} onChange={event => updateFloor('emergencyRoute', event.target.value)} />
          </label>
          {data.entryPoints.map((entry, index) => (
            <div className="application-testing-entry" key={index}>
              <input placeholder="Entry/exit label" value={entry.label} onChange={event => updateEntry(index, 'label', event.target.value)} />
              <input placeholder="Description" value={entry.description} onChange={event => updateEntry(index, 'description', event.target.value)} />
            </div>
          ))}
          <button type="button" onClick={() => updateFloor('entryPoints', [...data.entryPoints, { label: '', description: '' }])}>Add entry point</button>

          {stepError && <p className="application-testing-blocked">{stepError}</p>}

          <div className="application-testing-nav">
            <button type="button" onClick={goBack} disabled={step === 0 || saving}>Back</button>
            {isLast
              ? <button type="button" className="application-testing-submit" onClick={submit} disabled={saving}>{saving ? 'Creating...' : 'Create submitted application'}</button>
              : <button type="button" className="application-testing-submit" onClick={goNext}>Next floor</button>}
          </div>
        </section>
      )}

      {message && <p className="application-testing-message">{message}</p>}
    </main>
  )
}