import { X } from 'lucide-react'

// eslint-disable-next-line react-refresh/only-export-components
export const BRANDS = [
  { id: 1, name: 'Jollibee',           category: 'Food & Beverage' },
  { id: 2, name: 'Zara',               category: 'Fashion & Apparel' },
  { id: 3, name: 'H & M',              category: 'Fashion & Apparel' },
  { id: 4, name: 'Starbucks',          category: 'Food & Beverage' },
  { id: 5, name: 'Uniqlo',             category: 'Fashion & Apparel' },
  { id: 6, name: 'National Book Store',category: 'Books & Hobby' },
  { id: 7, name: 'Mercury Drug',       category: 'Health & Beauty' },
  { id: 8, name: 'Others',             category: null, isOthers: true },
]

function BrandInitial({ name }) {
  return (
    <div className="brand-card-initial-box">
      <span className="brand-card-initial">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

export default function SelectBrandModal({ mall, onSelect, onClose }) {
  return (
    <>
      <div className="sbrand-overlay" onClick={onClose} />
      <div className="sbrand-modal" role="dialog" aria-modal="true">
        <div className="mall-modal-header">
          <div>
            <h2 className="mall-modal-title">Select Brand</h2>
            <p className="sbrand-subtitle">{mall.name}</p>
          </div>
          <button className="mall-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="mall-modal-divider" />

        <div className="sbrand-body">
          <p className="sbrand-hint">
            Choose a brand or select Others for unlisted stores.
          </p>
          <div className="sbrand-grid">
            {BRANDS.map(brand => (
              <button
                key={brand.id}
                className="brand-card"
                onClick={() => onSelect(brand)}
              >
                <BrandInitial name={brand.name} />
                <span className="brand-card-name">{brand.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mall-modal-divider" />
        <div className="mall-modal-footer">
          <button className="mall-modal-cancel-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  )
}
