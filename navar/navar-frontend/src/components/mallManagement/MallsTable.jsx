import { useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { Search, Plus, Pencil, ImageIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AddMallModal from './AddMallModal'
import AddBrandModal from './AddBrandModal'
import UnitsPanel from './UnitsPanel'
import MallInfoPanel from './MallInfoPanel'
import InquiriesTab from './InquiriesTab'
import BeaconTicketsTab from './BeaconTicketsTab'
import '../../styles/mallManagement/mallModal.css'
import '../../styles/mallManagement/inquiries.css'

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
      <button className="mall-action-btn mall-action-btn--stores" onClick={stop(() => onStores())}>Stores</button>
      <button className="mall-action-btn mall-action-btn--beacons" onClick={stop(onBeacons)}>Beacons</button>
      <button className="mall-action-btn mall-action-btn--edit" onClick={stop(onEdit)}>Edit</button>
    </div>
  )
}

const initialBrands = [
  { id: 1, name: 'Jollibee',     category: 'Food & Beverages',  description: 'Bida ang saya',                logo: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23E31937%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2265%22 font-size=%2270%22 fill=%22%23FFF%22 text-anchor=%22middle%22%3EJ%3C/text%3E%3C/svg%3E', dateAdded: 'August 15, 2024', lastUpdated: 'August 15, 2024' },
  { id: 2, name: 'Zara',         category: 'Fashion & Apparel', description: 'International fashion icon',   logo: null, dateAdded: 'August 15, 2024', lastUpdated: 'August 15, 2024' },
  { id: 3, name: 'H & M',        category: 'Fashion & Apparel', description: 'Affordable and quality fashion', logo: null, dateAdded: 'August 15, 2024', lastUpdated: 'August 15, 2024' },
  { id: 4, name: 'Starbucks',    category: 'Food & Beverages',  description: 'Sip the quality',              logo: null, dateAdded: 'August 15, 2024', lastUpdated: 'August 15, 2024' },
  { id: 5, name: 'Uniqlo',       category: 'Fashion & Apparel', description: 'Genderless international fashion', logo: null, dateAdded: 'August 15, 2024', lastUpdated: 'August 15, 2024' },
]

let nextId = initialMalls.length + 1
let nextBrandId = initialBrands.length + 1

export default function MallsTable() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Malls')
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [malls, setMalls] = useState(initialMalls)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMall, setEditingMall] = useState(null)
  const [unitsMall, setUnitsMall] = useState(null)
  const [viewMall, setViewMall] = useState(null)

  function handleStoresClick(mall) {
    navigate(`/mall-management/stores/${mall.id}`)
  }

  function handleBeaconsClick(mall) {
    navigate(`/mall-management/beacons/${mall.id}`)
  }

  const [brands, setBrands] = useState(initialBrands)
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [editingBrand, setEditingBrand] = useState(null)
  const [brandSearch, setBrandSearch] = useState('')
  
  function openBrandImage(brand) {
    try {
      if (brand.logo) {
        window.open(brand.logo, '_blank', 'noopener,noreferrer')
        return
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect fill="#E5E7EB" width="100%" height="100%"/><text x="50%" y="55%" font-size="360" fill="#9CA3AF" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, sans-serif">${brand.name.charAt(0)}</text></svg>`
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      window.open(url, '_blank', 'noopener,noreferrer')
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // fallback: do nothing
    }
  }

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

  function handleBrandAddSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    setBrands(prev => [...prev, { id: nextBrandId++, ...data, dateAdded: now, lastUpdated: now }])
    setShowBrandModal(false)
  }

  function handleBrandEditSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    setBrands(prev => prev.map(b =>
      b.id === editingBrand.id ? { ...b, ...data, lastUpdated: now } : b
    ))
    setEditingBrand(null)
  }

  function openUnitsFromInfo(mall) {
    setUnitsMall(mall)
  }

  function openEditFromInfo(mall) {
    setEditingMall(mall)
  }

  function openStoresFromInfo(mall) {
    setViewMall(null)
    handleStoresClick(mall)
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

  return (
    <>
      <div className="mall-content">
        {/* Page header */}
        <div className="mall-header">
          <div className="mall-header-info">
            <h1 className="mall-title">Mall Management</h1>
            {activeTab === 'Brands' ? (
              <p className="mall-subtitle">Brands List</p>
            ) : activeTab === 'Beacon Tickets' ? (
              <p className="mall-subtitle">Manage Tickets Filed after a beacon is found to be faulty by the system or the mall administrators.</p>
            ) : (
              <p className="mall-subtitle">{malls.length} malls · Click any row to view full details</p>
            )}
          </div>
          {activeTab === 'Brands' ? (
            <button className="mall-add-btn" onClick={() => setShowBrandModal(true)}>
              <Plus size={16} strokeWidth={2.5} />
              Add Brand
            </button>
          ) : activeTab === 'Malls' ? (
            <button className="mall-add-btn" onClick={() => setShowAddModal(true)}>
              <Plus size={16} strokeWidth={2.5} />
              Add Mall
            </button>
          ) : null}
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

        {/* Filter bar + search — Malls tab only */}
        {activeTab === 'Malls' && <div className="mall-toolbar">
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
        </div>}

        {/* Brands tab */}
        {activeTab === 'Brands' && (() => {
          const filteredBrands = brands.filter(b =>
            !brandSearch ||
            b.name.toLowerCase().includes(brandSearch.toLowerCase()) ||
            b.category.toLowerCase().includes(brandSearch.toLowerCase())
          )
          return (
            <>
              <div className="brands-toolbar">
                <span className="brands-count">{brands.length} brand{brands.length !== 1 ? 's' : ''}</span>
                <div className="mall-search-wrap">
                  <Search size={16} className="mall-search-icon" />
                  <input
                    type="text"
                    placeholder="Search"
                    value={brandSearch}
                    onChange={e => setBrandSearch(e.target.value)}
                    className="mall-search-input"
                  />
                </div>
              </div>
              <div className="mall-table-wrap">
                <div className="mall-table-scroll">
                  <table className="mall-table brands-table">
                    <thead>
                      <tr>
                        <th>LOGO</th>
                        <th>BRAND NAME</th>
                        <th>CATEGORY</th>
                        <th>DESCRIPTION</th>
                        <th>DATE ADDED</th>
                        <th>LAST UPDATED</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBrands.length === 0 ? (
                        <tr><td colSpan={7} className="mall-table-empty">No brands found.</td></tr>
                      ) : filteredBrands.map(brand => (
                        <tr key={brand.id} className="mall-table-row">
                          <td>
                            {brand.logo ? (
                              <img
                                src={brand.logo}
                                alt={brand.name}
                                className="brand-table-logo brand-table-logo--clickable"
                                onClick={() => openBrandImage(brand)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && openBrandImage(brand)}
                                title="Open image in new tab"
                              />
                            ) : (
                              <div
                                className="brand-table-logo-placeholder"
                                onClick={() => openBrandImage(brand)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && openBrandImage(brand)}
                                title="Open placeholder in new tab"
                              >
                                <span className="brand-table-initial">{brand.name.charAt(0)}</span>
                              </div>
                            )}
                          </td>
                          <td className="brand-table-name">{brand.name}</td>
                          <td>{brand.category}</td>
                          <td className="brand-table-desc">{brand.description || '—'}</td>
                          <td className="mall-date-cell">{brand.dateAdded}</td>
                          <td className="mall-date-cell">{brand.lastUpdated}</td>
                          <td>
                            <button
                              className="mall-action-btn mall-action-btn--edit"
                              onClick={() => setEditingBrand(brand)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
        })()}

        {/* Table */}
        {activeTab === 'Malls' && (
          <>
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
                            onStores={() => handleStoresClick(mall)}
                            onBeacons={() => handleBeaconsClick(mall)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mall-table-hint">Click any row to view full details.</p>
          </>
        )}

        {/* Inquiries tab */}
        {activeTab === 'Inquiries' && (
          <InquiriesTab />
        )}

        {/* Beacon Tickets tab */}
        {activeTab === 'Beacon Tickets' && (
          <BeaconTicketsTab />
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

      {/* Add Brand modal */}
      {showBrandModal && (
        <AddBrandModal
          onClose={() => setShowBrandModal(false)}
          onSave={handleBrandAddSave}
        />
      )}

      {/* Edit Brand modal */}
      {editingBrand && (
        <AddBrandModal
          initialData={editingBrand}
          onClose={() => setEditingBrand(null)}
          onSave={handleBrandEditSave}
        />
      )}

      {/* Brand Logo Lightbox */}
      {/* Brand images now open in a new tab; inline lightbox removed */}

      {/* Mall Info Panel */}
      {viewMall && (
        <MallInfoPanel
          mall={viewMall}
          onClose={() => setViewMall(null)}
          onUnits={() => openUnitsFromInfo(viewMall)}
          onStores={() => openStoresFromInfo(viewMall)}
          onBeacons={() => { setViewMall(null); handleBeaconsClick(viewMall) }}
          onEdit={() => openEditFromInfo(viewMall)}
        />
      )}
    </>
  )
}
