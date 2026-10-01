import { useCallback, useState, useEffect } from 'react'
import { Plus, Search, XCircle, CheckCircle } from 'lucide-react'
import SelectBrandModal from './SelectBrandModal'
import AddStoreModal from './AddStoreModal'
import { apiRequest } from '../../config/api'
import BusyButton from '../ui/BusyButton'

const CATEGORIES = [
  'All',
  'Fashion & Apparel',
  'Books & Hobby',
  'Health & Beauty',
  'Food & Beverages',
  'Electronics',
  'Sports & Fitness',
  'Services',
  'Retail & General',
  'Entertainment',
  'Others',
]

function ConfirmModal({ type, onCancel, onConfirm }) {
  const isDe = type === 'deactivate'

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  return (
    <>
      <div className="confirm-modal-overlay" />
      <div className="confirm-modal">
        <div className="confirm-modal-icon">
          {isDe ? (
            <XCircle size={63} color="#D51D1D" strokeWidth={1.5} />
          ) : (
            <CheckCircle size={63} color="#16A34A" strokeWidth={1.5} />
          )}
        </div>
        <h3 className="confirm-modal-title">{isDe ? 'Deactivate' : 'Reactivate'}</h3>
        <p className="confirm-modal-text">
          Are you sure you want to {isDe ? 'deactivate' : 'reactivate'} this store?
        </p>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-cancel" onClick={onCancel}>Cancel</button>
          <BusyButton
            className={`confirm-modal-confirm confirm-modal-confirm--${type}`}
            onClick={onConfirm}
          >
            {isDe ? 'Deactivate' : 'Reactivate'}
          </BusyButton>
        </div>
      </div>
    </>
  )
}

function getFloorLabel(unitNos, mall) {
  if (!unitNos || unitNos.length === 0) return ''
  const unitObj = (mall.units || []).find(u => u.unitNo === unitNos[0])
  if (!unitObj) return ''
  const fd = (mall.floorDetails || []).find(f => f.floorNo === unitObj.floorNo)
  return fd?.label || unitObj.floorNo || ''
}

export default function StoresPanel({ mall, onClose, onSave }) {
  const [stores, setStores] = useState(mall.stores ? [...mall.stores] : [])
  const [mallState, setMallState] = useState(mall)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [searchQuery, setSearchQuery]       = useState('')

  const [showSelectBrand, setShowSelectBrand] = useState(false)
  const [selectedBrand, setSelectedBrand]     = useState(null)
  const [showAddStore, setShowAddStore]       = useState(false)
  const [editingStore, setEditingStore]       = useState(null)
  const [deactivating, setDeactivating]       = useState(null)
  const [brands, setBrands] = useState([])

  useEffect(() => {
    apiRequest('/api/brands')
      .then(items => {
        setBrands(items)
      })
      .catch(() => setBrands([]))
  }, [])

  const handleClose = useCallback(() => {
    // Update unit statuses based on current store assignments
    let updatedUnits = [...(mallState.units || [])]
    updatedUnits = updatedUnits.map(u => ({ ...u, status: 'vacant' }))
    stores.forEach(store => {
      if (store.active && store.unitNos && store.unitNos.length > 0) {
        store.unitNos.forEach(unitNo => {
          updatedUnits = updatedUnits.map(u =>
            u.unitNo === unitNo ? { ...u, status: 'occupied' } : u
          )
        })
      }
    })
    onSave(stores, updatedUnits)
    onClose()
  }, [mallState.units, onClose, onSave, stores])

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape' && !showSelectBrand && !showAddStore && !deactivating && !editingStore) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [handleClose, showSelectBrand, showAddStore, deactivating, editingStore])

  function handleAddStoreClick() { setShowSelectBrand(true) }

  function handleBrandSelect(brand) {
    setSelectedBrand(brand)
    setShowSelectBrand(false)
    setShowAddStore(true)
  }

  function handleBrandChange() {
    setShowAddStore(false)
    setSelectedBrand(null)
    setShowSelectBrand(true)
  }

  async function handleAddSave(data) {
    try {
      const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      let brand = data.brand
      let brandLogo = data.brandLogo || null
      let category = data.category

      if (data.isOthers) {
        const savedBrand = await apiRequest('/api/brands', {
          method: 'POST',
          body: JSON.stringify({ name: data.brand, category: data.category, description: data.brandDescription, logo: data.brandLogo }),
        })
        brand = savedBrand.name
        brandLogo = savedBrand.logo || brandLogo
        category = savedBrand.category
        data.brandId = savedBrand.id
        const nextBrands = [...brands, savedBrand]
        setBrands(nextBrands)
      }

      const newStore = {
        storeName: data.storeName,
        unitNos: data.unitNos || [],
        floorLabel: getFloorLabel(data.unitNos, mallState),
        brand,
        brandLogo,
        brandId: data.brandId || null,
        category,
        contactPerson: data.contactPerson || '',
        contactNo: data.contactNo || '',
        email: data.email || '',
        status: 'unmapped',
        description: data.description || '',
        active: true,
        dateAdded: now,
        lastUpdated: now,
      }
      const nextStores = [...stores, newStore]
      const savedStores = await onSave(nextStores)
      setStores(savedStores || nextStores)
      const savedByUnit = new Map(
        (savedStores || nextStores).flatMap(store =>
          (store.active ? store.unitNos || [] : []).map(unitNo => [unitNo, store.id])
        )
      )
      setMallState(prev => ({
        ...prev,
        units: (prev.units || []).map(unit => savedByUnit.has(unit.unitNo)
          ? { ...unit, status: 'occupied', storeId: savedByUnit.get(unit.unitNo) }
          : { ...unit, status: 'vacant', storeId: null }
        ),
      }))
      setShowAddStore(false)
      setSelectedBrand(null)
    } catch (error) {
      window.alert(error.message || 'Could not save the store.')
    }
  }

  async function handleEditSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const oldUnitNos = editingStore?.unitNos || []
    const newUnitNos = data.unitNos || []

    // Update stores
    const nextStores = stores.map(s =>
      s.id === editingStore.id ? {
        ...s,
        storeName:     data.storeName,
        unitNos:       newUnitNos,
        floorLabel:    getFloorLabel(newUnitNos, mallState),
        brand:         data.brand,
        brandLogo:     data.brandLogo || null,
        brandId:       data.brandId || editingStore.brandId || null,
        category:      data.category,
        contactPerson: data.contactPerson || '',
        contactNo:     data.contactNo    || '',
        email:         data.email        || '',
        status:        editingStore.status === 'mapped' ? 'mapped' : 'unmapped',
        active:        true,
        description:   data.description  || '',
        lastUpdated:   now,
      } : s
    )
    // Update unit statuses immediately so pencil button shows correct statuses
    if (mallState.units) {
      const updatedUnits = mallState.units.map(u => {
        if (oldUnitNos.includes(u.unitNo) && !newUnitNos.includes(u.unitNo)) {
          return { ...u, status: 'vacant' }
        }
        if (newUnitNos.includes(u.unitNo) && !oldUnitNos.includes(u.unitNo)) {
          return { ...u, status: 'occupied' }
        }
        return u
      })
      setMallState(prev => ({ ...prev, units: updatedUnits }))
    }
    const savedStores = await onSave(nextStores)
    setStores(savedStores || nextStores)

    setEditingStore(null)
  }

  async function handleDeactivateConfirm() {
    const nextStores = stores.map(s =>
      s.id === deactivating.id
        ? { ...s, active: false, status: 'unmapped' }
        : s
    )
    setMallState(prev => ({
      ...prev,
      units: (prev.units || []).map(unit =>
        deactivating.unitNos?.includes(unit.unitNo) ? { ...unit, status: 'vacant', storeId: null } : unit
      ),
    }))
    const savedStores = await onSave(nextStores)
    setStores(savedStores || nextStores)
    setDeactivating(null)
  }

  const activeCount = stores.filter(s => s.active).length

  const filteredStores = stores.filter(s => {
    const matchesCat = categoryFilter === 'All' || s.category === categoryFilter
    const matchesSearch = !searchQuery ||
      s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.brand || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  const editingBrand = editingStore
    ? { id: editingStore.brandId, name: editingStore.brand, logo: editingStore.brandLogo, category: editingStore.category, isOthers: false }
    : null
  const isReactivating = editingStore && stores.find(store => store.id === editingStore.id)?.active === false

  return (
    <>
      {/* Page-level content — replaces the malls table, no overlay */}
      <div className="stores-page">
        {/* Header */}
        <div className="stores-page-header">
          <div className="stores-page-header-info">
            <h1 className="stores-page-title">{mall.name}</h1>
            <p className="stores-page-subtitle">{activeCount} Stores | {mall.floors || 0} floors</p>
          </div>
          <button className="stores-page-close" onClick={handleClose} title="Back to malls">
            X
          </button>
        </div>

        {/* Filters + Add Store */}
        <div className="stores-page-toolbar">
          <div className="stores-filters-row">
            <div className="stores-category-filters">
              {CATEGORIES.map(cat => {
                const isActive = categoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`stores-cat-btn${isActive ? (cat === 'All' ? ' stores-cat-btn--all-active' : ' stores-cat-btn--active') : ''}`}
                  >
                    {cat === 'All' ? `All (${activeCount})` : cat}
                  </button>
                )
              })}
            </div>
          </div>
          <button className="stores-add-btn" onClick={handleAddStoreClick}>
            <Plus size={14} strokeWidth={2.5} />
            Add Store
          </button>
        </div>

        {/* Search */}
        <div className="stores-search-wrap">
          <Search size={16} className="stores-search-icon" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="stores-search-input"
          />
        </div>

        {/* Table */}
        <div className="stores-table-container">
          <div className="stores-table-scroll">
            <table className="stores-table">
              <thead>
                <tr>
                  <th>STORE NAME</th>
                  <th>TYPE</th>
                  <th>UNIT NO.</th>
                  <th>FLOOR</th>
                  <th>BRAND</th>
                  <th>CATEGORY</th>
                  <th>CONTACT PERSON</th>
                  <th>CONTACT NO.</th>
                  <th>EMAIL</th>
                  <th>STATUS</th>
                  <th>DESCRIPTION</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="stores-empty">No stores found.</td>
                  </tr>
                ) : filteredStores.map(store => (
                  <tr
                    key={store.id}
                    className={`stores-table-row${!store.active ? ' stores-table-row--inactive' : ''}`}
                  >
                    <td className="stores-td-name">{store.storeName}</td>
                    <td>
                      <span style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: store.storeType === 'stall' ? '#E8F3FF' : '#F0F0F0',
                        color: store.storeType === 'stall' ? '#0066CC' : '#666',
                        fontWeight: '500'
                      }}>
                        {store.storeType === 'stall' ? 'Stall' : 'Store'}
                      </span>
                    </td>
                    <td>{store.unitNos?.join(', ') || '—'}</td>
                    <td>{store.floorLabel || '—'}</td>
                    <td>{store.brand || '—'}</td>
                    <td>{store.category || '—'}</td>
                    <td>{store.contactPerson || '—'}</td>
                    <td>{store.contactNo || '—'}</td>
                    <td>{store.email || '—'}</td>
                    <td>
                      <span className={`stores-status-badge stores-status-badge--${store.status}`}>
                        {store.status === 'mapped' ? 'Mapped' : 'Unmapped'}
                      </span>
                    </td>
                    <td className="stores-td-desc">{store.description || '—'}</td>
                    <td>
                      <div className="stores-action-row">
                        {store.active ? (
                          <>
                            <button
                              className="stores-action-btn stores-action-btn--edit"
                              onClick={() => setEditingStore(store)}
                            >
                              Edit
                            </button>
                            <button
                              className="stores-action-btn stores-action-btn--deactivate"
                              onClick={() => setDeactivating(store)}
                            >
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <button
                            className="stores-action-btn stores-action-btn--reactivate"
                            onClick={() => setEditingStore({ ...store, active: true, status: 'unmapped', unitNos: [] })}
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sub-modals (overlays on top of the page content) */}
      {showSelectBrand && (
        <SelectBrandModal
          mall={mallState}
          brands={brands}
          onSelect={handleBrandSelect}
          onClose={() => setShowSelectBrand(false)}
        />
      )}

      {showAddStore && (
        <AddStoreModal
          brand={selectedBrand}
          mall={mallState}
          onClose={() => { setShowAddStore(false); setSelectedBrand(null) }}
          onSave={handleAddSave}
          onChangeBrand={handleBrandChange}
        />
      )}

      {editingStore && (
        <AddStoreModal
          brand={editingBrand}
          mall={mallState}
          initialData={editingStore}
          onClose={() => setEditingStore(null)}
          onSave={handleEditSave}
          onChangeBrand={() => {}}
          requireUnitAssignment={isReactivating}
          isEdit
        />
      )}

      {deactivating && (
        <ConfirmModal
          type="deactivate"
          onCancel={() => setDeactivating(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}

    </>
  )
}
