import {useEffect} from 'react'
import {createPortal} from 'react-dom'
import {CircleCheck,CircleAlert} from 'lucide-react'
import '../../styles/applicationManagement/applicationManagement.css'

export default function ActionResultModal({result,onClose}){
  useEffect(()=>{const close=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();onClose()}};window.addEventListener('keydown',close,true);return()=>window.removeEventListener('keydown',close,true)},[onClose])
  const Icon=result.success?CircleCheck:CircleAlert
  return createPortal(<div className="app-modal-overlay action-result-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="action-result-title"><div className="app-modal-icon"><Icon size={50} color={result.success?'#16a34a':'#dc2626'}/></div><h2 id="action-result-title" className="app-modal-title">{result.title}</h2><p className="app-modal-desc" role={result.success?'status':'alert'}>{result.message}</p><div className="app-modal-actions"><button className={result.success?'app-modal-btn-approve':'app-modal-btn-cancel'} autoFocus onClick={onClose}>Okay</button></div></div></div>,document.body)
}
