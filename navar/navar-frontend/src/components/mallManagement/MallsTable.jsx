import { useState } from 'react'
import { Search, Plus, } from 'lucide-react'
import AddMallModal from './AddMallModal'
import UnitsPanel from './UnitsPanel'
import MallInfoPanel from './MallInfoPanel'
import StoresPanel from './StoresPanel'
import BeaconManager from './BeaconManager'
import '../../styles/mallManagement/mallModal.css'

const TABS = ['Malls', 'Brands', 'Inquiries', 'Beacon Tickets']

const STATUS_FILTERS = [
  { label: 'All',          count: 17 },
  { label: 'Active',       count: 10 },
  { label: 'Grace Period', count: 1  },
  { label: 'Suspended',    count: 1  },
  { label: 'Setup',        count: 5  },
]

const initialMalls = [
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
      { id: 1, beaconCode: 'BCN-0001', floorNo: 'GF', floorLabel: 'Ground Floor', label: 'Zara Entrance', major: 1, minor: 101, txPower: -59, linkedNode: 'Zara', status: 'placed', faultyNote: '', dateAdded: 'August 15, 2024' },
      { id: 2, beaconCode: 'BCN-0002', floorNo: '2F', floorLabel: '2nd Floor', label: 'Starbucks Entrance', major: 1, minor: 102, txPower: -59, linkedNode: 'Starbucks', status: 'placed', faultyNote: '', dateAdded: 'August 15, 2024' },
      { id: 3, beaconCode: 'BCN-0003', floorNo: 'GF', floorLabel: 'Ground Floor', label: 'Jollibee Entrance', major: 1, minor: 103, txPower: -59, linkedNode: 'Jollibee', status: 'placed', faultyNote: '', dateAdded: 'August 15, 2024' },
    ],
    storesCount: 4,
    stores: [
      { id: 1, storeName: 'Zara SM Seaside City Cebu', unitNos: ['L2-04'], floorLabel: '2nd Floor', brand: 'Zara', brandLogo: null, category: 'Fashion & Apparel', contactPerson: 'Jenny Chua', contactNo: '09134246439', email: 'zara.team@gmail.com', status: 'mapped', description: '', active: true, dateAdded: 'August 15, 2024', lastUpdated: 'March 5, 2026' },
      { id: 2, storeName: 'National Book Store', unitNos: ['L2-08'], floorLabel: '2nd Floor', brand: 'National Book Store', brandLogo: null, category: 'Books & Hobby', contactPerson: 'Mark Tan', contactNo: '09345231234', email: '', status: 'mapped', description: '', active: true, dateAdded: 'August 15, 2024', lastUpdated: 'March 5, 2026' },
      { id: 3, storeName: 'Mercury Drug', unitNos: ['G-12'], floorLabel: 'Ground Floor', brand: 'Mercury Drug', brandLogo: null, category: 'Health & Beauty', contactPerson: 'Kipuka Jiang', contactNo: '09334451234', email: '', status: 'mapped', description: '', active: true, dateAdded: 'August 15, 2024', lastUpdated: 'March 5, 2026' },
      { id: 4, storeName: 'Starbucks', unitNos: ['G-03'], floorLabel: 'Ground Floor', brand: 'Starbucks', brandLogo: null, category: 'Food & Beverage', contactPerson: 'Ocean Liu', contactNo: '09876741234', email: '', status: 'mapped', description: '', active: true, dateAdded: 'August 15, 2024', lastUpdated: 'March 5, 2026' },
    ],
    agreementStartDate: 'Aug 15, 2024',
    agreementEndDate: 'Aug 15, 2026',
    annualFee: '₱50,000',
    gracePeriod: '30 days',
    majorBeacons: 1,
    beaconCount: 53,
    description: 'Largest mall in network.',
    units: [
      { id: 1, floorNo: 'GF', unitNo: 'G-01', status: 'occupied' },
      { id: 2, floorNo: 'GF', unitNo: 'G-03', status: 'occupied' },
      { id: 3, floorNo: 'GF', unitNo: 'G-12', status: 'occupied' },
      { id: 4, floorNo: 'GF', unitNo: 'G-15', status: 'vacant' },
      { id: 5, floorNo: '2F', unitNo: 'L2-04', status: 'occupied' },
      { id: 6, floorNo: '2F', unitNo: 'L2-08', status: 'occupied' },
      { id: 7, floorNo: '2F', unitNo: 'L2-11', status: 'vacant' },
    ],
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
    storesCount: 0,
    agreementStartDate: 'Aug 15, 2024',
    agreementEndDate: 'Aug 15, 2026',
    annualFee: '₱45,000',
    gracePeriod: '30 days',
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 3,
    name: 'Parkmall',
    city: 'Mandaue City',
    address: 'M.C. Briones St., North Reclamation Area, Mandaue City',
    floors: 2,
    agreementStatus: 'Suspended',
    tier: 'Standard',
    application: 'Approved',
    arDevelopment: 'Unpublished',
    dateAdded: 'July 1, 2024',
    lastUpdated: 'February 10, 2026',
    note: null,
    operatingHours: [{ days: ['Mon','Tue','Wed','Thu','Fri'], open: '10:00', close: '20:00' }],
    floorDetails: [
      { floorNo: 'GF', label: 'Ground Floor' },
      { floorNo: '2F', label: '2nd Floor' },
    ],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6014',
    storesCount: 0,
    agreementStartDate: 'Jul 1, 2024',
    agreementEndDate: 'Jul 1, 2026',
    annualFee: '₱30,000',
    gracePeriod: '30 days',
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 4,
    name: 'SM Seaside City Cebu',
    city: 'Cebu City',
    address: 'SRP Area, South Road Properties, Cebu City',
    floors: 5,
    agreementStatus: 'Active',
    tier: 'Standard',
    application: 'Approved',
    arDevelopment: 'Live',
    dateAdded: 'August 15, 2024',
    lastUpdated: 'March 5, 2026',
    note: null,
    operatingHours: [],
    floorDetails: [],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6000',
    storesCount: 0,
    agreementStartDate: null,
    agreementEndDate: null,
    annualFee: null,
    gracePeriod: null,
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 5,
    name: 'SM Seaside City Cebu',
    city: 'Cebu City',
    address: 'SRP Area, South Road Properties, Cebu City',
    floors: 5,
    agreementStatus: 'Active',
    tier: 'Standard',
    application: 'Approved',
    arDevelopment: 'Live',
    dateAdded: 'August 15, 2024',
    lastUpdated: 'March 5, 2026',
    note: null,
    operatingHours: [],
    floorDetails: [],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6000',
    storesCount: 0,
    agreementStartDate: null,
    agreementEndDate: null,
    annualFee: null,
    gracePeriod: null,
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 6,
    name: 'SM Seaside City Cebu',
    city: 'Cebu City',
    address: 'SRP Area, South Road Properties, Cebu City',
    floors: 5,
    agreementStatus: 'Active',
    tier: 'Standard',
    application: 'Approved',
    arDevelopment: 'Live',
    dateAdded: 'August 15, 2024',
    lastUpdated: 'March 5, 2026',
    note: null,
    operatingHours: [],
    floorDetails: [],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6000',
    storesCount: 0,
    agreementStartDate: null,
    agreementEndDate: null,
    annualFee: null,
    gracePeriod: null,
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 7,
    name: 'SM Seaside City Cebu',
    city: 'Cebu City',
    address: 'SRP Area, South Road Properties, Cebu City',
    floors: 5,
    agreementStatus: 'Active',
    tier: 'Basic',
    application: 'Approved',
    arDevelopment: 'Live',
    dateAdded: 'August 15, 2024',
    lastUpdated: 'March 5, 2026',
    note: null,
    operatingHours: [],
    floorDetails: [],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6000',
    storesCount: 0,
    agreementStartDate: null,
    agreementEndDate: null,
    annualFee: null,
    gracePeriod: null,
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 8,
    name: 'Robinsons Galleria Cebu',
    city: 'Cebu City',
    address: 'General Maxilom Ave, Cebu City',
    floors: 4,
    agreementStatus: 'Setup',
    tier: 'Standard',
    application: 'Draft',
    arDevelopment: 'Pending',
    dateAdded: 'January 10, 2025',
    lastUpdated: 'January 12, 2025',
    note: null,
    operatingHours: [],
    floorDetails: [],
    logoUrl: null,
    province: 'Cebu',
    zipCode: '6000',
    storesCount: 0,
    agreementStartDate: null,
    agreementEndDate: null,
    annualFee: null,
    gracePeriod: null,
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 9,
    name: 'Robinsons Place Iloilo',
    city: 'Iloilo City',
    address: 'Quezon St., Iloilo City',
    floors: 3,
    agreementStatus: 'Setup',
    tier: 'Basic',
    application: 'Draft',
    arDevelopment: 'Pending',
    dateAdded: 'February 3, 2025',
    lastUpdated: 'February 5, 2025',
    note: null,
    operatingHours: [],
    floorDetails: [],
    logoUrl: null,
    province: 'Iloilo',
    zipCode: '5000',
    storesCount: 0,
    agreementStartDate: null,
    agreementEndDate: null,
    annualFee: null,
    gracePeriod: null,
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
  {
    id: 10,
    name: 'Abreeza Mall',
    city: 'Davao City',
    address: 'J.P. Laurel Ave, Bajada, Davao City',
    floors: 3,
    agreementStatus: 'Grace Period',
    tier: 'Standard',
    application: 'Approved',
    arDevelopment: 'Live',
    dateAdded: 'March 20, 2024',
    lastUpdated: 'April 1, 2026',
    note: '5 days overdue',
    operatingHours: [],
    floorDetails: [],
    logoUrl: null,
    province: 'Davao del Sur',
    zipCode: '8000',
    storesCount: 0,
    agreementStartDate: 'Mar 20, 2024',
    agreementEndDate: 'Mar 20, 2026',
    annualFee: '₱30,000',
    gracePeriod: '30 days',
    majorBeacons: 0,
    beaconCount: 0,
    description: null,
    units: [],
  },
]

const agreementVariantMap = {
  Active:         'active',
  Suspended:      'suspended',
  'Grace Period': 'grace',
  Setup:          'setup',
}

const applicationVariantMap = {
  Approved:      'approved',
  Draft:         'pending',
  'For Revision':'revision',
}

const arDevVariantMap = {
  Live:        'live',
  Unpublished: 'unpublished',
  Pending:     'pending',
}

function AgreementCell({ status, tier }) {
  return (
    <div className="mall-agreement-cell">
      <span className={`mall-status-badge mall-status-badge--${agreementVariantMap[status] || 'pending'}`}>
        {status}
      </span>
      <span className="mall-tier-label">{tier}</span>
    </div>
  )
}

function StatusBadge({ value, variantMap }) {
  const variant = variantMap[value] || 'pending'
  return (
    <span className={`mall-status-badge mall-status-badge--${variant}`}>{value}</span>
  )
}

function ActionButtons({ onEdit, onUnits, onStores, onBeacons }) {
  function stop(fn) {
    return e => { e.stopPropagation(); fn && fn() }
  }
  return (
    <div className="mall-action-row" onClick={e => e.stopPropagation()}>
      <button className="mall-action-btn mall-action-btn--units" onClick={stop(onUnits)}>Units</button>
      <button className="mall-action-btn mall-action-btn--stores" onClick={stop(onStores)}>Stores</button>
      <button className="mall-action-btn mall-action-btn--beacons" onClick={stop(onBeacons)}>Beacons</button>
      <button className="mall-action-btn mall-action-btn--edit" onClick={stop(onEdit)}>Edit</button>
    </div>
  )
}

let nextId = initialMalls.length + 1

export default function MallsTable() {
  const [activeTab, setActiveTab] = useState('Malls')
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [malls, setMalls] = useState(initialMalls)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMall, setEditingMall] = useState(null)
  const [unitsMall, setUnitsMall] = useState(null)
  const [storesMall, setStoresMall] = useState(null)
  const [beaconsMall, setBeaconsMall] = useState(null)
  const [viewMall, setViewMall] = useState(null)

  function handleAddSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    setMalls(prev => [
      ...prev,
      {
        id: nextId++,
        name: data.name,
        city: data.city,
        address: data.address,
        floors: data.floors,
        agreementStatus: 'Setup',
        tier: data.agreementType,
        application: 'Draft',
        arDevelopment: 'Pending',
        dateAdded: now,
        lastUpdated: now,
        note: null,
        operatingHours: data.operatingHours,
        floorDetails: data.floorDetails,
        logoUrl: data.logoUrl,
      },
    ])
    setShowAddModal(false)
  }

  function handleEditSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    setMalls(prev =>
      prev.map(m =>
        m.id === editingMall.id
          ? {
              ...m,
              name: data.name,
              city: data.city,
              address: data.address,
              floors: data.floors,
              tier: data.agreementType,
              operatingHours: data.operatingHours,
              floorDetails: data.floorDetails,
              logoUrl: data.logoUrl,
              lastUpdated: now,
            }
          : m
      )
    )
    setEditingMall(null)
  }

  function handleUnitsSave(updatedUnits) {
    setMalls(prev =>
      prev.map(m => m.id === unitsMall.id ? { ...m, units: updatedUnits } : m)
    )
    setUnitsMall(null)
  }

  function handleStoresSave(updatedStores) {
    setMalls(prev =>
      prev.map(m =>
        m.id === storesMall.id
          ? { ...m, stores: updatedStores, storesCount: updatedStores.filter(s => s.active).length }
          : m
      )
    )
    setStoresMall(null)
  }

  function handleBeaconsSave(updatedBeacons) {
    setMalls(prev =>
      prev.map(m =>
        m.id === beaconsMall.id
          ? { ...m, beacons: updatedBeacons, beaconCount: updatedBeacons.length }
          : m
      )
    )
    setBeaconsMall(null)
  }

  function openUnitsFromInfo(mall) {
    setUnitsMall(mall)
  }

  function openEditFromInfo(mall) {
    setEditingMall(mall)
  }

  function openStoresFromInfo(mall) {
    setViewMall(null)
    setStoresMall(mall)
  }

  function openBeaconsFromInfo(mall) {
    setViewMall(null)
    setBeaconsMall(mall)
  }

  const filteredMalls = malls.filter(mall => {
    const matchesFilter =
      activeFilter === 'All' || mall.agreementStatus === activeFilter
    const matchesSearch =
      searchQuery === '' ||
      mall.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mall.city.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Render Stores as full content replacement
  if (storesMall) {
    return (
      <StoresPanel
        mall={storesMall}
        onClose={() => setStoresMall(null)}
        onSave={handleStoresSave}
      />
    )
  }

  // Render Beacons as full content replacement
  if (beaconsMall) {
    return (
      <BeaconManager
        mall={beaconsMall}
        onClose={() => setBeaconsMall(null)}
        onSave={handleBeaconsSave}
      />
    )
  }

  return (
    <>
      <div className="mall-content">
        {/* Page header */}
        <div className="mall-header">
          <div className="mall-header-info">
            <h1 className="mall-title">List of Malls</h1>
            <p className="mall-subtitle">{malls.length} malls * Click any row to view full details</p>
          </div>
          <button className="mall-add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={16} strokeWidth={2.5} />
            Add Mall
          </button>
        </div>

        {/* Tab navigation */}
        <div className="mall-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`mall-tab-btn${activeTab === tab ? ' mall-tab-btn--active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter bar + search */}
        <div className="mall-toolbar">
          <div className="mall-filters">
            {STATUS_FILTERS.map(({ label, count }) => (
              <button
                key={label}
                onClick={() => setActiveFilter(label)}
                className={`mall-filter-btn${activeFilter === label ? ' mall-filter-btn--active' : ''}`}
              >
                {label}
                <span className={`mall-filter-count${activeFilter === label ? ' mall-filter-count--active' : ''}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="mall-search-wrap">
            <Search size={16} className="mall-search-icon" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="mall-search-input"
            />
          </div>
        </div>

        {/* Table */}
        {activeTab === 'Malls' ? (
          <div className="mall-table-wrap">
            <div className="mall-table-scroll">
              <table className="mall-table">
                <thead>
                  <tr>
                    <th>Mall Name</th>
                    <th>City</th>
                    <th>No. of Floors</th>
                    <th>Agreement</th>
                    <th>Application</th>
                    <th>AR Development</th>
                    <th>Date Added</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMalls.map(mall => (
                    <tr
                      key={mall.id}
                      className="mall-table-row"
                      onClick={() => setViewMall(mall)}
                    >
                      <td>
                        <p className={`mall-name-text${mall.agreementStatus === 'Grace Period' ? ' mall-name-text--grace' : mall.agreementStatus === 'Suspended' ? ' mall-name-text--suspended' : ''}`}>
                          {mall.name}
                        </p>
                        {mall.note && <p className="mall-overdue-note">{mall.note}</p>}
                      </td>
                      <td>{mall.city}</td>
                      <td>
                        <div className="mall-floors-cell" onClick={e => e.stopPropagation()}>
                          <span>{mall.floors ?? '—'}</span>
                        </div>
                      </td>
                      <td>
                        <AgreementCell status={mall.agreementStatus} tier={mall.tier} />
                      </td>
                      <td>
                        <StatusBadge value={mall.application} variantMap={applicationVariantMap} />
                      </td>
                      <td>
                        <StatusBadge value={mall.arDevelopment} variantMap={arDevVariantMap} />
                      </td>
                      <td className="mall-date-cell">{mall.dateAdded}</td>
                      <td className="mall-date-cell">{mall.lastUpdated}</td>
                      <td>
                        <ActionButtons
                          onEdit={() => setEditingMall(mall)}
                          onUnits={() => setUnitsMall(mall)}
                          onStores={() => setStoresMall(mall)}
            onBeacons={() => setBeaconsMall(mall)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mall-tab-placeholder">
            <p>{activeTab} — coming soon</p>
          </div>
        )}
      </div>

      {/* Add Mall modal */}
      {showAddModal && (
        <AddMallModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSave}
        />
      )}

      {/* Units panel (stacked on top of info panel) */}
      {unitsMall && (
        <UnitsPanel
          mall={unitsMall}
          onClose={() => setUnitsMall(null)}
          onSave={handleUnitsSave}
          stackedOnInfoPanel={!!viewMall}
        />
      )}

      {/* Edit Mall modal (stacked on top of info panel) */}
      {editingMall && (
        <AddMallModal
          initialData={editingMall}
          onClose={() => setEditingMall(null)}
          onSave={handleEditSave}
          stackedOnInfoPanel={!!viewMall}
        />
      )}

      {/* Mall Info Panel */}
      {viewMall && (
        <MallInfoPanel
          mall={viewMall}
          onClose={() => setViewMall(null)}
          onUnits={() => openUnitsFromInfo(viewMall)}
          onStores={() => openStoresFromInfo(viewMall)}
          onBeacons={() => openBeaconsFromInfo(viewMall)}
          onEdit={() => openEditFromInfo(viewMall)}
        />
      )}
    </>
  )
}
