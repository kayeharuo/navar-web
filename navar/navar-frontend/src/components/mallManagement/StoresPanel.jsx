import { useState, useEffect } from 'react'
import { X, Plus, Search, XCircle, CheckCircle } from 'lucide-react'
import SelectBrandModal from './SelectBrandModal'
import AddStoreModal from './AddStoreModal'

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

let nextStoreId = 500

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
          <button
            className={`confirm-modal-confirm confirm-modal-confirm--${type}`}
            onClick={onConfirm}
          >
            {isDe ? 'Deactivate' : 'Reactivate'}
          </button>
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
  const [reactivating, setReactivating]       = useState(null)

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape' && !showSelectBrand && !showAddStore && !deactivating && !reactivating) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showSelectBrand, showAddStore, deactivating, reactivating])

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

  function handleAddSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    setStores(prev => [...prev, {
      id:            nextStoreId++,
      storeName:     data.storeName,
      unitNos:       data.unitNos || [],
      floorLabel:    getFloorLabel(data.unitNos, mallState),
      brand:         data.brand,
      brandLogo:     data.brandLogo || null,
      category:      data.category,
      contactPerson: data.contactPerson || '',
      contactNo:     data.contactNo    || '',
      email:         data.email        || '',
      status:        data.status,
      description:   data.description  || '',
      active:        true,
      dateAdded:     now,
      lastUpdated:   now,
    }])
    setShowAddStore(false)
    setSelectedBrand(null)
  }

  function handleEditSave(data) {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const oldUnitNos = editingStore?.unitNos || []
    const newUnitNos = data.unitNos || []

    // Update stores
    setStores(prev => prev.map(s =>
      s.id === editingStore.id ? {
        ...s,
        storeName:     data.storeName,
        unitNos:       newUnitNos,
        floorLabel:    getFloorLabel(newUnitNos, mallState),
        brand:         data.brand,
        brandLogo:     data.brandLogo || null,
        category:      data.category,
        contactPerson: data.contactPerson || '',
        contactNo:     data.contactNo    || '',
        email:         data.email        || '',
        status:        data.status,
        description:   data.description  || '',
        lastUpdated:   now,
      } : s
    ))

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

    setEditingStore(null)
  }

  function handleDeactivateConfirm() {
    setStores(prev => prev.map(s =>
      s.id === deactivating.id
        ? { ...s, active: false, status: s.status === 'mapped' ? 'unmapped' : s.status }
        : s
    ))
    setDeactivating(null)
  }

  function handleReactivateConfirm() {
    setStores(prev => prev.map(s =>
      s.id === reactivating.id ? { ...s, active: true } : s
    ))
    setReactivating(null)
  }

  function handleClose() {
    // Update unit statuses based on current store assignments
    let updatedUnits = [...(mallState.units || [])]

    // First mark all as vacant
    updatedUnits = updatedUnits.map(u => ({ ...u, status: 'vacant' }))

    // Then mark assigned ones as occupied
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
    ? { name: editingStore.brand, logo: editingStore.brandLogo, category: editingStore.category, isOthers: false }
    : null

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
                    <td colSpan={11} className="stores-empty">No stores found.</td>
                  </tr>
                ) : filteredStores.map(store => (
                  <tr
                    key={store.id}
                    className={`stores-table-row${!store.active ? ' stores-table-row--inactive' : ''}`}
                  >
                    <td className="stores-td-name">{store.storeName}</td>
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
                            onClick={() => setReactivating(store)}
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

      {reactivating && (
        <ConfirmModal
          type="reactivate"
          onCancel={() => setReactivating(null)}
          onConfirm={handleReactivateConfirm}
        />
      )}
    </>
  )
}
