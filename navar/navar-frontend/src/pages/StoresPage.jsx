import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import StoresPanel from '../components/mallManagement/StoresPanel'
import { apiRequest } from '../config/api'

/* Legacy sample retained as reference only; store routes load the selected mall from the API. */
const SAMPLE_MALLS = [
  {
    id: 1,
    name: 'SM Seaside City Cebu',
    city: 'Cebu',
    province: 'Cebu',
    address: 'Aqua St, Cebu City',
    zipCode: '6000',
    floors: 4,
    floorDetails: [
      { floorNo: 1, label: 'Ground Floor' },
      { floorNo: 2, label: 'Floor 2' },
      { floorNo: 3, label: 'Floor 3' },
      { floorNo: 4, label: 'Floor 4' },
    ],
    units: [
      { id: 1, floorNo: 1, unitNo: 'G-01', status: 'occupied', isActive: true },
      { id: 2, floorNo: 1, unitNo: 'G-02', status: 'vacant', isActive: true },
      { id: 3, floorNo: 2, unitNo: 'L2-01', status: 'occupied', isActive: true },
      { id: 4, floorNo: 2, unitNo: 'L2-02', status: 'vacant', isActive: true },
    ],
    stores: [
      { id: 1, storeName: 'Jollibee', unitNos: ['G-01'], floorLabel: 'Ground Floor', brand: 'Jollibee', brandLogo: null, category: 'Food & Beverage', contactPerson: 'Maria Santos', contactNo: '+63 912 345 6789', email: 'maria@jollibee.ph', status: 'mapped', description: '', active: true, dateAdded: 'Mar 10, 2026', lastUpdated: 'Mar 15, 2026' },
      { id: 2, storeName: 'Zara', unitNos: ['L2-01'], floorLabel: 'Floor 2', brand: 'Zara', brandLogo: null, category: 'Fashion & Apparel', contactPerson: 'Juan Dela Cruz', contactNo: '+63 918 765 4321', email: 'juan@zara.ph', status: 'mapped', description: '', active: true, dateAdded: 'Mar 12, 2026', lastUpdated: 'Mar 16, 2026' },
    ],
    operatingHours: [
      { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], open: '10:00', close: '21:00' },
    ],
    storesCount: 2,
    beacons: [],
  },
]
void SAMPLE_MALLS

export default function StoresPage() {
  const { mallId } = useParams()
  const navigate = useNavigate()
  const [mall, setMall] = useState(null)

  useEffect(() => {
    apiRequest(`/api/malls/${mallId}`)
      .then(data => {
        const storedStores = (() => {
          try {
            return JSON.parse(localStorage.getItem(`navar.stores.${mallId}`) || '[]')
          } catch {
            return []
          }
        })()
        setMall({ ...data, stores: storedStores.length ? storedStores : (data.stores || []), units: data.units || [] })
      })
      .catch(() => navigate('/mall-management', { replace: true }))
  }, [mallId, navigate])

  function handleStoresSave(updatedStores) {
    // Calculate correct unit statuses based on store assignments
    let calculatedUnits = [...(mall.units || [])]

    // First mark all as vacant
    calculatedUnits = calculatedUnits.map(u => ({ ...u, status: 'vacant' }))

    // Then mark assigned ones as occupied
    updatedStores.forEach(store => {
      if (store.active && store.unitNos && store.unitNos.length > 0) {
        store.unitNos.forEach(unitNo => {
          calculatedUnits = calculatedUnits.map(u =>
            u.unitNo === unitNo ? { ...u, status: 'occupied' } : u
          )
        })
      }
    })

    setMall(prev => ({
      ...prev,
      stores: updatedStores,
      units: calculatedUnits,
      storesCount: updatedStores.filter(s => s.active).length,
    }))
    localStorage.setItem(`navar.stores.${mallId}`, JSON.stringify(updatedStores))
    apiRequest(`/api/malls/${mallId}/units`, {
      method: 'PUT',
      body: JSON.stringify({ units: calculatedUnits }),
    }).catch(error => console.error('Could not persist store unit assignments:', error))
  }

  function handleClose() {
    navigate('/mall-management')
  }

  if (!mall) return <div className="stores-page">Loading stores…</div>

  return (
    <StoresPanel
      mall={mall}
      onClose={handleClose}
      onSave={handleStoresSave}
    />
  )
}
