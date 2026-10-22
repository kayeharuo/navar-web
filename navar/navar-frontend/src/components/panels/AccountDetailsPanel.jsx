import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
export default function AccountDetailsPanel({ account, onClose }) {
 const panel = useRef(null)
 useEffect(() => {
  const previous = document.activeElement
  const node = panel.current
  if (!node.open) node.showModal()
  return () => { node.close(); previous?.focus?.() }
 }, [])
 const fields = [['Full name',account.name],['Email',account.email],['Role',account.role === 'mall_admin' ? 'Mall Admin' : 'Super Admin'],
 ['Mall',account.mall],['Job title',account.jobTitle],['Contact number',account.contact],['Primary admin',account.isPrimary ? 'Yes' : 'No'],
 ['Account status',account.lifecycle === 'partial' ? 'Pending setup' : 'Official'],['Access',account.isDeactivated ? 'Deactivated' : 'Enabled'],
 ['Created',account.created],['Last updated',account.lastUpdated],['Last login',account.lastLogin],['Deactivated on',account.deactivatedOn]]
 return <dialog ref={panel} className="acct-details-panel" aria-labelledby="account-details-title" onCancel={e=>{e.preventDefault();onClose()}}
  onClick={event => {
   if (event.target !== event.currentTarget) return
   const bounds = event.currentTarget.getBoundingClientRect()
   if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}>
  <div className="panel-header"><h2 id="account-details-title" className="acct-modal-title">Account details</h2><button className="panel-close" aria-label="Close account details" type="button" onClick={onClose}><X size={20} aria-hidden="true" /></button></div>
  <div className="panel-divider"/><dl className="acct-details-fields">{fields.filter(([label])=>label!=='Mall'||account.role==='mall_admin').map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not provided'}</dd></div>)}</dl>
 </dialog>
}
