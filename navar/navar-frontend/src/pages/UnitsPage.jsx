import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import UnitsPanel from '../components/mallManagement/UnitsPanel'
import { apiRequest } from '../config/api'
import '../styles/mallManagement/mallManagementLayout.css'
import '../styles/mallManagement/mallModal.css'

export default function UnitsPage() {
  const { mallId } = useParams()
  const navigate = useNavigate()
  const [mall, setMall] = useState(null)

  useEffect(() => {
    apiRequest(`/api/malls/${mallId}`).then(setMall).catch(() => navigate('/mall-management', { replace: true }))
  }, [mallId, navigate])

  async function saveUnits(units) {
    const saved = await apiRequest(`/api/malls/${mallId}/units`, { method: 'PUT', body: JSON.stringify({ units }) })
    setMall(current => ({ ...current, units: saved }))
  }

  if (!mall) {
    return <div className="stores-page-loading" role="status" aria-live="polite"><span className="stores-page-spinner" aria-hidden="true" /><span>Loading units...</span></div>
  }
  return (
    <UnitsPanel mall={mall} onClose={() => navigate('/mall-management')} onSave={saveUnits} />
  )
}
