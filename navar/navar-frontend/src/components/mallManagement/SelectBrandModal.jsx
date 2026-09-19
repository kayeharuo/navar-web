import { X } from 'lucide-react'
import { useEffect } from 'react'

export const BRANDS = []

function getLogoUrl(logo) {
  return logo?.startsWith('/')
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${logo}`
    : logo
}

function BrandLogo({ brand }) {
  const logoUrl = getLogoUrl(brand.logo)
  if (logoUrl) return <img src={logoUrl} alt="" className="brand-card-logo" />
  return (
    <div className="brand-card-initial-box">
      <span className="brand-card-initial">{brand.name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

export default function SelectBrandModal({ mall, brands = BRANDS, onSelect, onClose }) {
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

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
            {[...brands.filter(brand => !brand.isOthers && brand.name !== 'Others'), { id: 'others', name: 'Others', category: null, isOthers: true }].map(brand => (
              <button
                key={brand.id}
                className="brand-card"
                onClick={() => onSelect(brand)}
              >
                <BrandLogo brand={brand} />
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
