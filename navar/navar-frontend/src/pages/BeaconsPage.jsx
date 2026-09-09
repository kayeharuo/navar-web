import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import BeaconManager from '../components/mallManagement/BeaconManager'

const SAMPLE_MALLS = [
  {
    id: 1,
    name: 'SM Seaside City Cebu',
    city: 'Cebu City',
    address: 'SRP Area, South Road Properties, Cebu City',
    floors: 5,
    agreementStatus: 'Active',
    tier: 'Premium',
    application: 'Approved',
    arDevelopment: 'Live',
    dateAdded: 'August 15, 2024',
    lastUpdated: 'March 5, 2026',
    note: null,
    operatingHours: [{ days: ['Mon','Tue','Wed','Thu','Fri'], open: '10:00', close: '21:00' }],
    floorDetails: [
      { floorNo: 'B1', label: 'Basement' },
      { floorNo: 'GF', label: 'Ground Floor' },
      { floorNo: '2F', label: '2nd Floor' },
      { floorNo: '3F', label: '3rd Floor' },
      { floorNo: '4F', label: '4th Floor' },
    ],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6000',
    major: 1,
    beacons: [
      { id: 1, beaconCode: 'BCN-0001', floorNo: 'GF', floorLabel: 'Ground Floor', label: 'Zara Entrance', major: 1, minor: 101, txPower: -59, linkedNode: 'Zara', status: 'placed', faultyNote: '', dateAdded: 'August 15, 2024', dateInstalled: '2024-08-15', lastMaintenanceDate: '—', batteryHistory: [{ id: 1, batteryId: 'BAT-0001', status: 'current', installDate: '2024-08-15', replacedDate: null, brand: 'Panasonic CR2477' }], ticketHistory: [] },
      { id: 2, beaconCode: 'BCN-0002', floorNo: '2F', floorLabel: '2nd Floor', label: 'Starbucks Entrance', major: 1, minor: 102, txPower: -59, linkedNode: 'Starbucks', status: 'placed', faultyNote: '', dateAdded: 'August 15, 2024', dateInstalled: '2024-08-15', lastMaintenanceDate: '—', batteryHistory: [], ticketHistory: [] },
      { id: 3, beaconCode: 'BCN-0003', floorNo: 'GF', floorLabel: 'Ground Floor', label: 'Jollibee Entrance', major: 1, minor: 103, txPower: -59, linkedNode: 'Jollibee', status: 'placed', faultyNote: '', dateAdded: 'August 15, 2024', dateInstalled: '2024-08-15', lastMaintenanceDate: '—', batteryHistory: [], ticketHistory: [] },
    ],
    storesCount: 4,
    stores: [],
    agreementStartDate: 'Aug 15, 2024',
    agreementEndDate: 'Aug 15, 2026',
    annualFee: '₱50,000',
    gracePeriod: '30 days',
    majorBeacons: 1,
    beaconCount: 53,
    description: 'Largest mall in network.',
    units: [],
  },
  {
    id: 2,
    name: 'Ayala Center Cebu',
    city: 'Cebu City',
    address: 'Cebu Business Park, Archbishop Reyes Ave, Cebu City',
    floors: 4,
    agreementStatus: 'Active',
    tier: 'Premium',
    application: 'Approved',
    arDevelopment: 'Live',
    dateAdded: 'August 15, 2024',
    lastUpdated: 'March 5, 2026',
    note: '27 days overdue',
    operatingHours: [{ days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], open: '10:00', close: '21:00' }],
    floorDetails: [
      { floorNo: 'GF', label: 'Ground Floor' },
      { floorNo: '2F', label: '2nd Floor' },
      { floorNo: '3F', label: '3rd Floor' },
      { floorNo: 'RF', label: 'Roof' },
    ],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6000',
    major: 1,
    beacons: [],
    storesCount: 0,
    stores: [],
    agreementStartDate: 'Aug 15, 2024',
    agreementEndDate: 'Aug 15, 2026',
    annualFee: '₱45,000',
    gracePeriod: '30 days',
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
]

export default function BeaconsPage() {
  const { mallId } = useParams()
  const navigate = useNavigate()
  const [mall, setMall] = useState(null)

  useEffect(() => {
    const foundMall = SAMPLE_MALLS.find(m => m.id === parseInt(mallId))
    if (foundMall) {
      setMall({
        ...foundMall,
        beacons: (foundMall.beacons || []).map(beacon => ({
          ...beacon,
          dateInstalled: beacon.dateInstalled || foundMall.dateAdded,
          lastMaintenanceDate: beacon.lastMaintenanceDate || beacon.lastReplacementDate || '—',
          batteryHistory: beacon.batteryHistory || [],
          ticketHistory: beacon.ticketHistory || [],
        })),
      })
    } else {
      navigate('/mall-management')
    }
  }, [mallId, navigate])

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') {
        if (document.querySelector('[role="dialog"]')) return
        navigate('/mall-management')
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [navigate])

  function handleBeaconsSave(updatedBeacons) {
    setMall(prev => ({
      ...prev,
      beacons: updatedBeacons,
      beaconCount: updatedBeacons.length,
    }))
  }

  function handleClose() {
    navigate('/mall-management')
  }

  if (!mall) return null

  return (
    <BeaconManager
      mall={mall}
      onClose={handleClose}
      onSave={handleBeaconsSave}
    />
  )
}
