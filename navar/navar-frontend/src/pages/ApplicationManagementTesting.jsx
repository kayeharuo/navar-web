import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../config/api'
import '../styles/applicationManagement/applicationManagementTesting.css'

const blankFloor = floorId => ({ floorId, image: null, referenceLine: '', meterLength: '', accessibilityRoute: '', emergencyRoute: '', entryPoints: [{ label: '', description: '' }] })

export default function ApplicationManagementTesting() {
  const [options, setOptions] = useState({ malls: [], floors: [] })
  const [mallId, setMallId] = useState('')
  const [floorIds, setFloorIds] = useState([])
  const [floorData, setFloorData] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest('/api/testing/applications/options').then(setOptions).catch(error => setMessage(error.message))
  }, [])

  const mallFloors = useMemo(() => options.floors.filter(floor => String(floor.mall_id) === String(mallId)), [options.floors, mallId])
  const updateFloor = (id, field, value) => setFloorData(current => ({ ...current, [id]: { ...current[id], [field]: value } }))
  const toggleFloor = id => {
    setFloorIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
    setFloorData(current => ({ ...current, [id]: current[id] || blankFloor(id) }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const result = await apiRequest('/api/testing/applications', { method: 'POST', body: JSON.stringify({ mallId: Number(mallId), floors: floorIds.map(id => floorData[id]) }) })
      setMessage(`Created application #${result.application_id} for ${result.mallName}.`)
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
      <form onSubmit={submit}>
        <label>Mall<select value={mallId} onChange={event => { setMallId(event.target.value); setFloorIds([]); setFloorData({}) }} required><option value="">Select mall</option>{options.malls.map(mall => <option key={mall.mall_id} value={mall.mall_id}>{mall.mall_name}</option>)}</select></label>
        <fieldset><legend>Floors</legend>{mallFloors.map(floor => <label key={floor.floor_id} className="application-testing-check"><input type="checkbox" checked={floorIds.includes(floor.floor_id)} onChange={() => toggleFloor(floor.floor_id)} />{floor.floor_name || `Floor ${floor.floor_id}`}</label>)}</fieldset>
        {floorIds.map(id => {
          const floor = floorData[id]
          const label = mallFloors.find(item => item.floor_id === id)?.floor_name || `Floor ${id}`
          return <section className="application-testing-floor" key={id}>
            <h2>{label}</h2>
            <label>Floor plan image<input type="file" accept="image/png,image/jpeg" required onChange={event => {
              const file = event.target.files?.[0]
              if (!file) return
              if (!['image/png', 'image/jpeg'].includes(file.type)) {
                setMessage('Floor plans must be PNG or JPEG images.')
                updateFloor(id, 'image', null)
                return
              }
              if (file.size > 10 * 1024 * 1024) {
                setMessage('Each floor plan must be 10 MB or smaller.')
                updateFloor(id, 'image', null)
                return
              }
              setMessage('')
              const reader = new FileReader()
              reader.onload = () => updateFloor(id, 'image', { dataUrl: reader.result, fileName: file.name, mimeType: file.type, fileSize: file.size })
              reader.readAsDataURL(file)
            }} /></label>
            <label>Scale reference<input value={floor.referenceLine} onChange={event => updateFloor(id, 'referenceLine', event.target.value)} required /></label>
            <label>Meter length<input type="number" min="1" value={floor.meterLength} onChange={event => updateFloor(id, 'meterLength', event.target.value)} required /></label>
            <label>Accessibility route<textarea value={floor.accessibilityRoute} onChange={event => updateFloor(id, 'accessibilityRoute', event.target.value)} /></label>
            <label>Emergency route<textarea value={floor.emergencyRoute} onChange={event => updateFloor(id, 'emergencyRoute', event.target.value)} /></label>
            {floor.entryPoints.map((entry, index) => <div className="application-testing-entry" key={index}><input placeholder="Entry/exit label" value={entry.label} onChange={event => updateFloor(id, 'entryPoints', floor.entryPoints.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /><input placeholder="Description" value={entry.description} onChange={event => updateFloor(id, 'entryPoints', floor.entryPoints.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} /></div>)}
            <button type="button" onClick={() => updateFloor(id, 'entryPoints', [...floor.entryPoints, { label: '', description: '' }])}>Add entry point</button>
          </section>
        })}
        <button className="application-testing-submit" disabled={saving || !mallId || !floorIds.length}>{saving ? 'Creating...' : 'Create submitted application'}</button>
      </form>
      {message && <p className="application-testing-message">{message}</p>}
    </main>
  )
}
