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
        return apiRequest(`/api/malls/${mallId}/stores`)
          .catch(error => {
            console.error('Could not load stores:', error)
            return []
          })
          .then(stores => setMall({ ...data, stores, units: data.units || [] }))
      })
      .catch(() => navigate('/mall-management', { replace: true }))
  }, [mallId, navigate])

  async function handleStoresSave(updatedStores) {
    const savedStores = await apiRequest(`/api/malls/${mallId}/stores`, {
      method: 'PUT',
      body: JSON.stringify({ stores: updatedStores }),
    })
    setMall(prev => ({
      ...prev,
      stores: savedStores,
      storesCount: savedStores.filter(store => store.active).length,
    }))
    return savedStores
  }

  function handleClose() {
    navigate('/mall-management')
  }

  if (!mall) return null

  return (
    <StoresPanel
      mall={mall}
      onClose={handleClose}
      onSave={handleStoresSave}
    />
  )
}
