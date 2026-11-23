import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export function EditorDialog({ title, subtitle, icon: Icon, children, footer, onClose, busy = false, nested = false, wide = false }) {
 const titleId = useId();
 const panel = useRef(null);
 const handlers = useRef({ onClose, busy, nested });
 useEffect(() => { handlers.current = { onClose, busy, nested }; }, [onClose, busy, nested]);
 useEffect(() => {
  const previous = document.activeElement;
  panel.current?.focus();
  const onKey = event => {
   if (handlers.current.nested) return;
   if (event.key === 'Escape' && !handlers.current.busy) { event.preventDefault(); handlers.current.onClose(); }
   if (event.key !== 'Tab') return;
   const controls = [...(panel.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])].filter(el => el.getClientRects().length);
   if (!controls.length) { event.preventDefault(); panel.current?.focus(); return; }
   const first = controls[0], last = controls.at(-1);
   if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
   else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
 }, []);
 return <div className="ne-dialog-overlay">
  <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} className={`ne-dialog${wide ? ' ne-dialog--wide' : ''}`}>
   <header className="ne-dialog-header">
    <div className="ne-dialog-heading"><span className="ne-dialog-icon"><Icon size={20} strokeWidth={1.8} /></span><div><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div></div>
    <button type="button" className="ne-icon-button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose} disabled={busy}><X size={18} /></button>
   </header>
   <div className="ne-dialog-body">{children}</div>
   <footer className="ne-dialog-footer">{footer}</footer>
  </section>
 </div>;
}
