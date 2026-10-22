import { useState, useMemo, useEffect, useRef } from 'react'
import '../styles/accountManagement/accountManagement.css'
import { apiRequest as sendRequest } from '../config/api'
import { withRequestTimeout } from '../components/mallManagement/followupRequest'

async function apiRequest(path, options = {}) {
  try { return await withRequestTimeout(signal => sendRequest(path, {...options, signal}), options.method ? 90000 : 20000) }
  catch (error) {
    if (error.name === 'TimeoutError') throw new Error(options.method ? 'This request has not been confirmed. Refresh accounts and check their status before retrying; it may still finish on the server.' : 'Loading accounts took too long. Please refresh and try again.', { cause: error })
    throw error
  }
}
import MessageModal from '../components/ui/MessageModal'
import BusyButton from '../components/ui/BusyButton'
import '../styles/panels.css'
import AccountDetailsPanel from '../components/panels/AccountDetailsPanel'

/* ─── SVG Icons ─── */


function IconKey() {
  return (
    <svg width="42" height="41" viewBox="0 0 42 41" fill="none">
      <path d="M37.4436 4.45429C34.9728 2.03937 31.7404 0.507404 28.2681 0.105608C24.7957-0.296188 21.2859 0.45562 18.305 2.23971C15.3242 4.02381 13.0461 6.73612 11.8385 9.93897C10.6309 13.1418 10.5641 16.6484 11.649 19.8928L0.911947 30.3724C0.621801 30.6533 0.391764 30.9878 0.235211 31.3562C0.0786576 31.7247-0.00129 32.1199 1.57399e-05 32.5188V37.9635C1.57399e-05 38.7689 0.327788 39.5412 0.911226 40.1106C1.49466 40.6801 2.28598 41 3.11108 41H9.33322C9.74577 41 10.1414 40.84 10.4331 40.5553C10.7249 40.2706 10.8887 39.8844 10.8887 39.4818V36.4453H13.9998C14.4124 36.4453 14.808 36.2854 15.0997 36.0006C15.3915 35.7159 15.5554 35.3297 15.5554 34.9271V31.8906H18.6664C18.8708 31.8908 19.0731 31.8516 19.262 31.7754C19.4508 31.6992 19.6224 31.5875 19.767 31.4465L21.6258 29.6303C23.1817 30.1243 24.8079 30.3747 26.4441 30.3724H26.4635C29.5385 30.3687 32.5434 29.4757 35.0986 27.806C37.6538 26.1363 39.6446 23.7649 40.8196 20.9914C41.9946 18.2179 42.301 15.1667 41.7001 12.2234C41.0992 9.27997 39.618 6.57643 37.4436 4.45429Z" fill="black"/>
    </svg>
  )
}

function IconWarning() {
  return (
    <svg width="44" height="37" viewBox="0 0 44 37" fill="none">
      <path d="M43.3713 30.3565L26.1945 2.2608C25.7653 1.57247 25.1525 1.00174 24.4169 0.605178C23.6814 0.208619 22.8485 0 22.001 0C21.1534 0 20.3206 0.208619 19.585 0.605178C18.8494 1.00174 18.2367 1.57247 17.8074 2.2608L0.630646 30.3565C0.217649 31.0222 0 31.7795 0 32.5506C0 33.3216 0.217649 34.0789 0.630646 34.7446C1.05438 35.4371 1.66611 36.011 2.40305 36.4073C3.14 36.8036 3.97562 37.0081 4.82418 36.9998H39.1778C40.0257 37.0074 40.8605 36.8026 41.5967 36.4063C42.3329 36.0101 42.944 35.4366 43.3674 34.7446C43.781 34.0792 43.9993 33.3221 44 32.5511C44.0007 31.78 43.7837 31.0226 43.3713 30.3565ZM20.4296 14.8V22.1999C20.4296 22.5924 20.5952 22.9689 20.8899 23.2464C21.1846 23.524 21.5842 23.6799 22.001 23.6799C22.4177 23.6799 22.8174 23.524 23.1121 23.2464C23.4068 22.9689 23.5723 22.5924 23.5723 22.1999V14.8C23.5723 14.4075 23.4068 14.031 23.1121 13.7535C22.8174 13.4759 22.4177 13.32 22.001 13.32C21.5842 13.32 21.1846 13.4759 20.8899 13.7535C20.5952 14.031 20.4296 14.4075 20.4296 14.8ZM22.001 26.6399C21.5348 26.6399 21.0791 26.7701 20.6915 27.014C20.3039 27.2579 20.0018 27.6046 19.8234 28.0103C19.645 28.4159 19.5983 28.8623 19.6892 29.2929C19.7802 29.7236 20.0047 30.1191 20.3343 30.4296C20.6639 30.7401 21.0839 30.9515 21.5411 31.0372C21.9984 31.1228 22.4723 31.0789 22.903 30.9108C23.3337 30.7428 23.7018 30.4583 23.9608 30.0932C24.2198 29.7281 24.358 29.2989 24.358 28.8598C24.358 28.2711 24.1097 27.7064 23.6676 27.2901C23.2256 26.8738 22.6261 26.6399 22.001 26.6399Z" fill="black"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" fill="#16A34A">
      <path d="M35.6612 17.7138C35.8384 17.8909 35.979 18.1011 36.075 18.3325C36.1709 18.5639 36.2203 18.812 36.2203 19.0625C36.2203 19.313 36.1709 19.5611 36.075 19.7925C35.979 20.0239 35.8384 20.2341 35.6612 20.4112L22.3174 33.7549C22.1404 33.9322 21.9302 34.0728 21.6987 34.1687C21.4673 34.2646 21.2193 34.314 20.9688 34.314C20.7183 34.314 20.4702 34.2646 20.2388 34.1687C20.0074 34.0728 19.7971 33.9322 19.6201 33.7549L13.9013 28.0362C13.5436 27.6785 13.3427 27.1933 13.3427 26.6875C13.3427 26.1817 13.5436 25.6965 13.9013 25.3388C14.259 24.9811 14.7442 24.7802 15.25 24.7802C15.7559 24.7802 16.241 24.9811 16.5987 25.3388L20.9688 29.7113L32.9638 17.7138C33.1409 17.5366 33.3511 17.396 33.5825 17.3001C33.8139 17.2041 34.062 17.1548 34.3125 17.1548C34.563 17.1548 34.8111 17.2041 35.0425 17.3001C35.2739 17.396 35.4841 17.5366 35.6612 17.7138ZM49.5625 24.7812C49.5625 29.6825 48.1091 34.4737 45.3861 38.549C42.6631 42.6242 38.7928 45.8005 34.2646 47.6761C29.7365 49.5518 24.7538 50.0425 19.9467 49.0863C15.1396 48.1301 10.724 45.77 7.25827 42.3042C3.79255 38.8385 1.43237 34.4229 0.476176 29.6158C-0.480014 24.8087 0.0107373 19.8261 1.88637 15.2979C3.76201 10.7697 6.93828 6.89939 11.0135 4.17639C15.0888 1.45339 19.88 0 24.7813 0C31.3515 0.00693832 37.6507 2.62004 42.2966 7.26592C46.9425 11.9118 49.5556 18.211 49.5625 24.7812ZM45.75 24.7812C45.75 20.634 44.5202 16.5799 42.2161 13.1316C39.9121 9.68334 36.6372 6.99573 32.8057 5.40865C28.9741 3.82158 24.758 3.40632 20.6905 4.21541C16.6229 5.02449 12.8866 7.02157 9.95412 9.95411C7.02158 12.8866 5.0245 16.6229 4.21542 20.6905C3.40634 24.758 3.82159 28.9741 5.40866 32.8056C6.99574 36.6372 9.68335 39.9121 13.1316 42.2161C16.5799 44.5202 20.634 45.75 24.7813 45.75C30.3406 45.7437 35.6704 43.5325 39.6014 39.6014C43.5325 35.6704 45.7437 30.3406 45.75 24.7812Z"/>
    </svg>
  )
}

/* ─── Sample Data ─── */

function formatDate(d) {
  if (!d || Number.isNaN(new Date(d).getTime())) return '-'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/* ────────────────────────────────────────
   MODAL: Create / Edit Account
──────────────────────────────────────── */
function AccountFormModal({ mode, account, createTabInit, mallAdmins, malls, onClose, onSave }) {
  const isEdit = mode === 'edit'
  const [roleTab, setRoleTab] = useState(isEdit ? (account?.mall !== undefined ? 'mall-admin' : 'super-admin') : (createTabInit || 'super-admin'))


  const emptyForm = {
    name: '', email: '', jobTitle: '', contact: '', mall: '', isPrimary: 'no',
  }
  const [form, setForm] = useState(isEdit && account ? {
    name: account.name || '',
    email: account.email || '',
    jobTitle: account.jobTitle || '',
    contact: account.contact || '',
    mall: String(account.mallId || ''),
    isPrimary: account.isPrimary ? 'yes' : 'no',
  } : emptyForm)
  const [errors, setErrors] = useState({})

  const activePrimaryForMall = useMemo(() => {
    if (!form.mall) return null
    return mallAdmins.find(a => String(a.mallId) === String(form.mall) && a.isPrimary && !a.isDeactivated && a.id !== account?.id) || null
  }, [form.mall, mallAdmins, account])

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Full name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.'
    if (form.name.trim().length > 100) e.name = 'Use at most 100 characters.'
    if (form.contact && !/^[+]?[0-9][0-9 ()-]{6,19}$/.test(form.contact)) e.contact = 'Enter a valid contact number.'
    if (roleTab === 'mall-admin') {
      if (!form.contact.trim()) e.contact = 'Contact number is required.'
      if (!form.mall) e.mall = 'Assigned mall is required.'
      if (!isEdit && form.isPrimary === 'yes' && activePrimaryForMall) {
        e.isPrimary = `${activePrimaryForMall.mall} already has a primary admin, including accounts awaiting setup.`
      }
    }
    return e
  }

  function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    return onSave({
      role: roleTab,
      name: form.name.trim(),
      email: form.email.trim(),
      jobTitle: form.jobTitle.trim(),
      contact: form.contact.trim(),
      mall: form.mall,
      isPrimary: form.isPrimary === 'yes',
    })
  }

  const superAdminFields = (
    <>
      <div className="acct-form-group">
        <label className="acct-form-label">FULL NAME <span className="acct-form-label-required">*</span></label>
        <input className={`acct-form-input${errors.name ? ' acct-form-input--error' : ''}`} placeholder="e.g., Maria Santos" maxLength={100} value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(ev => ({ ...ev, name: '' })) }} />
        {errors.name && <span className="acct-form-error">{errors.name}</span>}
      </div>
      <div className="acct-form-group">
        <label className="acct-form-label">EMAIL ADDRESS <span className="acct-form-label-required">*</span></label>
            <input className={`acct-form-input${errors.email ? ' acct-form-input--error' : ''}`} placeholder="user@company.ph" type="email" maxLength={100} value={form.email} readOnly={isEdit} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(ev => ({ ...ev, email: '' })) }} />
        {errors.email && <span className="acct-form-error">{errors.email}</span>}
      </div>
      <div className="acct-form-group">
        <label className="acct-form-label">JOB TITLE</label>
        <input className="acct-form-input" placeholder="e.g., IT Manager, Operations Head" maxLength={100} value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
      </div>
      <div className="acct-form-group">
        <label className="acct-form-label">CONTACT NUMBER</label>
        <input className={`acct-form-input${errors.contact ? ' acct-form-input--error' : ''}`} placeholder="Contact number" type="tel" inputMode="tel" maxLength={20} value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value.replace(/[^+0-9 ()-]/g, '') }))} />
      </div>
    </>
  )

  const mallAdminFields = (
    <>
      <div className="acct-form-group">
        <label className="acct-form-label">FULL NAME <span className="acct-form-label-required">*</span></label>
        <input className={`acct-form-input${errors.name ? ' acct-form-input--error' : ''}`} placeholder="e.g., Maria Santos" maxLength={100} value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(ev => ({ ...ev, name: '' })) }} />
        {errors.name && <span className="acct-form-error">{errors.name}</span>}
      </div>
      <div className="acct-form-row">
        <div className="acct-form-group">
          <label className="acct-form-label">EMAIL ADDRESS <span className="acct-form-label-required">*</span></label>
            <input className={`acct-form-input${errors.email ? ' acct-form-input--error' : ''}`} placeholder="user@company.ph" type="email" maxLength={100} value={form.email} readOnly={isEdit} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(ev => ({ ...ev, email: '' })) }} />
          {errors.email && <span className="acct-form-error">{errors.email}</span>}
        </div>
        <div className="acct-form-group">
          <label className="acct-form-label">JOB TITLE</label>
          <input className="acct-form-input" placeholder="e.g., IT Manager, Operations Head" maxLength={100} value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
        </div>
      </div>
      <div className="acct-form-group">
        <label className="acct-form-label">CONTACT NUMBER <span className="acct-form-label-required">*</span></label>
        <input className={`acct-form-input${errors.contact ? ' acct-form-input--error' : ''}`} placeholder="Contact number" type="tel" inputMode="tel" maxLength={20} value={form.contact} onChange={e => { setForm(f => ({ ...f, contact: e.target.value.replace(/[^+0-9 ()-]/g, '') })); setErrors(ev => ({ ...ev, contact: '' })) }} />
        {errors.contact && <span className="acct-form-error">{errors.contact}</span>}
      </div>
      <div className="acct-form-group">
        <label className="acct-form-label">ASSIGNED MALL <span className="acct-form-label-required">*</span></label>
        <select disabled={isEdit} className={`acct-form-select${errors.mall ? ' acct-form-input--error' : ''}`} value={form.mall} onChange={e => { setForm(f => ({ ...f, mall: e.target.value, isPrimary: 'no' })); setErrors(ev => ({ ...ev, mall: '', isPrimary: '' })) }}>
          <option value="">-- Select a Mall --</option>
          {malls.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
        </select>
        {errors.mall && <span className="acct-form-error">{errors.mall}</span>}
      </div>
      <div className="acct-form-group">
        <label className="acct-form-label">IS PRIMARY <span className="acct-form-label-required">*</span></label>
        <div className="acct-radio-group">
          <label className="acct-radio-label">
            <input type="radio" name="isPrimary" value="yes" checked={form.isPrimary === 'yes'} disabled={isEdit || !!activePrimaryForMall} onChange={() => { setForm(f => ({ ...f, isPrimary: 'yes' })); setErrors(ev => ({ ...ev, isPrimary: '' })) }} />
            Yes
          </label>
          <label className="acct-radio-label">
            <input type="radio" name="isPrimary" disabled={isEdit} value="no" checked={form.isPrimary === 'no'} onChange={() => { setForm(f => ({ ...f, isPrimary: 'no' })); setErrors(ev => ({ ...ev, isPrimary: '' })) }} />
            No
          </label>
        </div>
        {activePrimaryForMall && (
          <p className="acct-primary-locked-note">⚠ {activePrimaryForMall.mall} already has an active primary admin ({activePrimaryForMall.name}). Only one primary admin is allowed per mall.</p>
        )}
        {errors.isPrimary && <span className="acct-form-error">{errors.isPrimary}</span>}
      </div>
    </>
  )

  return (
    <div className="acct-modal-overlay">
      <div className="acct-create-modal">
        <div className="acct-modal-header">
          <div className="acct-modal-title-row">
            <h2 className="acct-modal-title">{isEdit ? 'Edit Account' : 'Create new Account'}</h2>
            <button className="acct-modal-close" onClick={onClose}>X</button>
          </div>
          {isEdit ? (
            <p className="acct-modal-subtitle">{account?.mall !== undefined ? 'Mall Admin' : 'Super Admin'}</p>
          ) : (
            <p className="acct-modal-subtitle">An invitation email will be sent. The recipient must set a password before signing in.</p>
          )}
        </div>
        {!isEdit && (
          <div className="acct-modal-role-tabs">
            <button className={`acct-modal-role-tab${roleTab === 'super-admin' ? ' acct-modal-role-tab--active' : ''}`} onClick={() => { setRoleTab('super-admin'); setErrors({}) }}>Super Admin</button>
            <button className={`acct-modal-role-tab${roleTab === 'mall-admin' ? ' acct-modal-role-tab--active' : ''}`} onClick={() => { setRoleTab('mall-admin'); setErrors({}) }}>Mall Admin</button>
          </div>
        )}
        <div className="acct-modal-body">
          {(isEdit ? (account?.mall !== undefined ? 'mall-admin' : 'super-admin') : roleTab) === 'super-admin' ? superAdminFields : mallAdminFields}
        </div>
        <div className="acct-modal-footer">
          <button className="acct-modal-btn-cancel" onClick={onClose}>Cancel</button>
          <BusyButton className="acct-modal-btn-primary" onClick={handleSubmit}>{isEdit ? 'Save Changes' : 'Create Account'}</BusyButton>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
   MODAL: Account Created
──────────────────────────────────────── */
function AccountCreatedModal({ account, onClose }) {

  return (
    <div className="acct-modal-overlay">
      <div className="acct-created-modal">
        <div className="acct-modal-header">
          <div className="acct-modal-title-row">
            <h2 className="acct-modal-title">Account Created</h2>
            <button className="acct-modal-close" onClick={onClose}>X</button>
          </div>
          <p className="acct-modal-subtitle">{account.warning || 'An invitation email was submitted to this address.'}</p>
          <div className="acct-modal-divider" />
        </div>
        <div className="acct-modal-body">
          <div className="acct-created-info-table">
            {[
              ['Name', account.name],
              ['Email', account.email],
              ['Role', account.role === 'mall-admin' ? 'Mall Admin' : 'Super Admin'],
              account.jobTitle ? ['Job Title', account.jobTitle] : null,
              account.contact ? ['Contact No.', account.contact] : null,
              account.mall ? ['Assigned Mall', account.mall] : null,
            ].filter(Boolean).map(([label, value]) => (
              <div className="acct-created-info-row" key={label}>
                <span className="acct-created-info-label">{label}</span>
                <span className="acct-created-info-value">{value}</span>
              </div>
            ))}
          </div>
          <div className="acct-magic-link-box">
            <p className="acct-magic-link-title">{account.warning ? 'Invitation delivery unconfirmed' : `Invitation submitted to ${account.email}`}</p>
            <p className="acct-magic-link-text">{account.warning || 'The recipient must use the invitation email to set a password before signing in.'}</p>
          </div>
        </div>
        <div className="acct-modal-footer">
          <button className="acct-modal-btn-full" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
  MODAL: Email Sent
──────────────────────────────────────── */
function ResetPasswordModal({ account, onClose, onConfirm }) {
  return (
    <div className="acct-modal-overlay">
      <div className="acct-confirm-modal">
        <div className="acct-confirm-icon"><IconKey /></div>
        <div>
          <h3 className="acct-confirm-title">Reset Password</h3>
          <p className="acct-confirm-desc">Send {account.name} an email to set a new password. Their current password remains valid until they complete the reset.</p>
        </div>
        <div className="acct-confirm-actions">
          <button className="acct-modal-btn-cancel" onClick={onClose}>Cancel</button>
          <BusyButton className="acct-confirm-btn-proceed" onClick={onConfirm}>Send Reset Link</BusyButton>
        </div>
      </div>
    </div>
  )
}

function MagicLinkSentModal({ email, onClose }) {

  return (
    <div className="acct-modal-overlay">
      <div className="acct-magic-sent-modal">
        <div className="acct-magic-sent-body">
          <IconKey />
          <div>
            <h3 className="acct-confirm-title">Email Sent</h3>
            <p className="acct-confirm-desc">The email provider accepted the password-link email for {email}.</p>
          </div>
          <div className="acct-magic-link-box">
            <p className="acct-magic-link-title">Email sent to {email}</p>
            <p className="acct-magic-link-text">Ask the recipient to check their inbox and spam folder and use the newest link.</p>
          </div>
        </div>
        <div className="acct-magic-sent-footer">
          <button className="acct-modal-btn-full" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
   MODAL: Deactivate Account
──────────────────────────────────────── */
function DeactivateModal({ account, onClose, onConfirm }) {
  const isPrimaryMallAdmin = account?.mall !== undefined && account?.isPrimary


  return (
    <div className="acct-modal-overlay">
      <div className="acct-confirm-modal">
        <div className="acct-confirm-icon"><IconWarning /></div>
        <div>
          <h3 className="acct-confirm-title">Deactivate Account</h3>
          <p className="acct-confirm-desc">{account.name} will lose access immediately.</p>
          {isPrimaryMallAdmin && (
            <p className="acct-confirm-warning">⚠ {account.mall} will lose access through this primary admin until the account is reactivated.</p>
          )}
        </div>
        <div className="acct-confirm-actions">
          <button className="acct-modal-btn-cancel" onClick={onClose}>Cancel</button>
          <BusyButton className="acct-confirm-btn-deactivate" onClick={onConfirm}>Deactivate</BusyButton>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
   MODAL: Reactivate Account
──────────────────────────────────────── */
function ReactivateModal({ account, onClose, onConfirm }) {

  return (
    <div className="acct-modal-overlay">
      <div className="acct-confirm-modal">
        <div className="acct-confirm-icon"><IconCheck /></div>
        <div>
          <h3 className="acct-confirm-title">Reactivate Account</h3>
          <p className="acct-confirm-desc">{account.name} will regain access immediately.</p>
        </div>
        <div className="acct-confirm-actions">
          <button className="acct-modal-btn-cancel" onClick={onClose}>Cancel</button>
          <BusyButton className="acct-confirm-btn-reactivate" onClick={onConfirm}>Reactivate</BusyButton>
        </div>
      </div>
    </div>
  )
}

/* ── Stat card icons (module-level) ── */
function StatIconSuperAdmin() {
  return (
    <svg width="27" height="27" viewBox="0 0 27 27" fill="none">
      <path d="M8.85938 16.875C11.8883 16.875 14.3438 14.4196 14.3438 11.3906C14.3438 8.36169 11.8883 5.90625 8.85938 5.90625C5.83044 5.90625 3.375 8.36169 3.375 11.3906C3.375 14.4196 5.83044 16.875 8.85938 16.875Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.07812 21.0938C1.92091 19.7979 3.07401 18.7331 4.43273 17.996C5.79145 17.2589 7.31277 16.8728 8.85856 16.8728C10.4043 16.8728 11.9257 17.2589 13.2844 17.996C14.6431 18.7331 15.7962 19.7979 16.639 21.0938" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.1406 16.875C19.6863 16.8741 21.2078 17.2596 22.5666 17.9963C23.9254 18.7331 25.0785 19.7979 25.9211 21.0938" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.1055 6.29648C16.8557 5.99726 17.6627 5.86744 18.4689 5.91629C19.2751 5.96514 20.0606 6.19146 20.7692 6.57907C21.4778 6.96668 22.0921 7.50602 22.568 8.15855C23.044 8.81107 23.37 9.56068 23.5227 10.3538C23.6754 11.1469 23.651 11.964 23.4513 12.7466C23.2516 13.5292 22.8816 14.258 22.3675 14.881C21.8535 15.504 21.2082 16.0058 20.4778 16.3505C19.7473 16.6952 18.9498 16.8743 18.1421 16.875" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function StatIconMallAdmin() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <path d="M21 20H5V8H21V20Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 8V5H17V8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 14H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function StatIconPending() {
  return (
    <svg width="27" height="27" viewBox="0 0 42 42" fill="none">
      <path d="M17.2377 8.81358C17.1679 8.52799 17.2097 8.22534 17.3542 7.97171C17.4986 7.71808 17.7339 7.53408 18.0086 7.45989C20.2991 6.8467 22.7021 6.8467 24.9926 7.45989C25.2463 7.52732 25.4675 7.6886 25.6147 7.91343C25.7619 8.13826 25.825 8.41116 25.792 8.68083C25.759 8.9505 25.6322 9.19838 25.4356 9.37789C25.2389 9.55739 24.9858 9.65616 24.724 9.65562C24.6333 9.65513 24.5431 9.64295 24.4553 9.61937C22.5173 9.09995 20.4839 9.09995 18.5458 9.61937C18.409 9.65579 18.2665 9.66382 18.1266 9.64302C17.9868 9.62221 17.8522 9.57298 17.7307 9.49813C17.6092 9.42328 17.5031 9.32429 17.4185 9.20682C17.3339 9.08936 17.2725 8.95573 17.2377 8.81358ZM21.5006 24.8459C22.3506 24.8459 23.1816 24.5842 23.8883 24.094C24.5951 23.6038 25.146 22.9071 25.4713 22.0919C25.7966 21.2768 25.8817 20.3798 25.7158 19.5144C25.55 18.649 25.1407 17.8541 24.5396 17.2302C23.9385 16.6063 23.1727 16.1814 22.339 16.0093C21.5054 15.8371 20.6412 15.9255 19.8559 16.2631C19.0705 16.6008 18.3993 17.1726 17.9271 17.9062C17.4548 18.6399 17.2028 19.5024 17.2028 20.3847C17.2028 21.5679 17.6556 22.7026 18.4616 23.5392C19.2676 24.3759 20.3607 24.8459 21.5006 24.8459Z" fill="white"/>
    </svg>
  )
}

function StatIconDeactivated() {
  return (
    <svg width="24" height="24" viewBox="0 0 42 42" fill="none">
      <path d="M21.5 7C18.83 7 16.2199 7.79176 13.9998 9.27516C11.7797 10.7586 10.0494 12.867 9.02763 15.3338C8.00585 17.8006 7.7385 20.515 8.2594 23.1337C8.78031 25.7525 10.0661 28.1579 11.9541 30.0459C13.8421 31.9339 16.2475 33.2197 18.8663 33.7406C21.485 34.2615 24.1994 33.9942 26.6662 32.9724C29.133 31.9506 31.2414 30.2203 32.7248 28.0002C34.2082 25.7801 35 23.17 35 20.5C34.9962 16.9207 33.5727 13.4892 31.0418 10.9582C28.5108 8.42731 25.0793 7.00378 21.5 7ZM20.4615 21.5385V14.2692C20.4615 13.9938 20.571 13.7297 20.7657 13.5349C20.9604 13.3402 21.2246 13.2308 21.5 13.2308C21.7754 13.2308 22.0396 13.3402 22.2343 13.5349C22.4291 13.7297 22.5385 13.9938 22.5385 14.2692V21.5385C22.5385 21.8139 22.4291 22.078 22.2343 22.2728C22.0396 22.4675 21.7754 22.5769 21.5 22.5769C21.2246 22.5769 20.9604 22.4675 20.7657 22.2728C20.571 22.078 20.4615 21.8139 20.4615 21.5385Z" fill="white"/>
    </svg>
  )
}

/* ────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────── */
export default function AccountManagement() {
  const [activeTab, setActiveTab] = useState('super-admins')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [createdAccount, setCreatedAccount] = useState(null)
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [currentAdminId, setCurrentAdminId] = useState(null)
  const [currentAdminPrimary, setCurrentAdminPrimary] = useState(false)
  const [createTabInit, setCreateTabInit] = useState('super-admin')

  const [superAdmins, setSuperAdmins] = useState([])
  const [mallAdmins, setMallAdmins] = useState([])
  const [deactSuper, setDeactSuper] = useState([])
  const [deactMall, setDeactMall] = useState([])
  const [requestError, setRequestError] = useState('')
  const [loading, setLoading] = useState(true)
  const [malls, setMalls] = useState([])
  const [details, setDetails] = useState(null)
  const loadSequence = useRef(0)
  const actionInFlight = useRef(false)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    loadAccounts(true)
    return () => { loadSequence.current += 1 }
  }, [])

  function loadAccounts(initial = false) {
    const sequence = ++loadSequence.current
    if (initial) setLoading(true)
    return Promise.all([apiRequest('/api/admin-accounts'), apiRequest('/api/auth/me'), apiRequest('/api/admin-accounts/malls')])
      .then(([accounts, me, mallOptions]) => {
        if (sequence !== loadSequence.current) return
        setMalls(mallOptions)
        setCurrentAdminId(me.id)
        const currentAccount = accounts.find(account => String(account.id) === String(me.id))
        setCurrentAdminPrimary(me.isPrimary === true || currentAccount?.isPrimary === true)
        const mapped = accounts.map(account => ({
          ...account,
          isPrimary: account.isPrimary === true,
          lifecycle: account.status,
          status: account.isDeactivated ? 'deactivated' : account.status === 'partial' ? 'pending' : 'active',
          deactivatedOn: formatDate(account.deactivatedOn),
          contact: account.contactNum || '',
          created: account.createdAt ? formatDate(account.createdAt) : '-',
          lastUpdated: account.updatedAt ? formatDate(account.updatedAt) : '-',
          lastLogin: account.lastLogin ? formatDate(account.lastLogin) : 'Never',
        }))
        setDetails(current => current ? mapped.find(account => account.id === current.id) || null : null)
        setSuperAdmins(mapped.filter(account => account.role === 'super_admin' && !account.isDeactivated))
        setMallAdmins(mapped.filter(account => account.role === 'mall_admin' && !account.isDeactivated))
        setDeactSuper(mapped.filter(account => account.role === 'super_admin' && account.isDeactivated))
        setDeactMall(mapped.filter(account => account.role === 'mall_admin' && account.isDeactivated))
      })
      .catch(error => { if (sequence === loadSequence.current) setRequestError(error.message) })
      .finally(() => { if (sequence === loadSequence.current) setLoading(false) })
  }


  /* ── Computed stats ── */
  const pendingCount = superAdmins.filter(a => a.status === 'pending').length + mallAdmins.filter(a => a.status === 'pending').length
  const deactivatedCount = deactSuper.length + deactMall.length
  const canManageAccounts = currentAdminPrimary

  /* ── Search filter ── */
  function filterList(list) {
    const q = search.trim().toLowerCase()
    return list.filter(a => [a.name, a.email, a.mall, a.jobTitle].some(value => (value || '').toLowerCase().includes(q)))
  }

  /* ── Handlers ── */
  function openCreate(tab) {
    setCreateTabInit(tab)
    setModal('create')
  }

  async function handleSaveCreate({ role, name, email, jobTitle, contact, mall, isPrimary }) {
    try {
      const created = await apiRequest('/api/admin-accounts', {
        method: 'POST',
        body: JSON.stringify({ email: email.toLowerCase(), name, job_title: jobTitle, contact_num: contact, role: role === 'mall-admin' ? 'mall_admin' : 'super_admin', ...(role === 'mall-admin' ? {mall_id: Number(mall), is_primary: isPrimary} : {}) }),
      })
      const newAccount = { id: created.id, name: created.name, email: created.email, jobTitle, contact, status: 'pending', created: formatDate(new Date()), lastUpdated: formatDate(new Date()), lastLogin: 'Never' }
      await loadAccounts()
      setCreatedAccount({ ...newAccount, role, mall: malls.find(m => String(m.id) === String(mall))?.name, isPrimary, warning: created.warning })
      setModal('created')
    } catch (error) {
      setRequestError(error.message)
    }
  }

  async function handleSaveEdit({ name, jobTitle, contact }) {
    try {
      await apiRequest(`/api/admin-accounts/${selectedAccount.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, job_title: jobTitle, contact_num: contact }),
      })
      await loadAccounts()
      setModal(null)
      setSelectedAccount(null)
    } catch (error) {
      setRequestError(error.message)
    }
  }

  function resetPasswordReason(account) {
    if (!canManageAccounts || account.isPrimary) return 'Password resets are only available for non-primary accounts.'
    if (String(account.id) === String(currentAdminId)) return 'Use Forgot Password to reset your own password.'
    if (account.isDeactivated) return 'Reactivate this account before resetting its password.'
    if (account.lifecycle !== 'official') return 'This account has not completed setup. Use Resend invite instead.'
    return ''
  }

  function handleResetPassword(account) {
    if (actionInFlight.current || resetPasswordReason(account)) return
    setSelectedAccount(account)
    setModal('reset')
  }

  async function handleConfirmReset() {
    if (!selectedAccount || resetPasswordReason(selectedAccount)) return
    try {
      await apiRequest(`/api/admin-accounts/${selectedAccount.id}/reset-password`, { method: 'POST' })
      setMagicLinkEmail(selectedAccount.email)
      setModal('magic-sent')
    } catch (error) {
      setRequestError(error.message)
      setModal(null)
      setSelectedAccount(null)
    }
  }

  async function handleResendLink(account) {
    try {
      await apiRequest(`/api/admin-accounts/${account.id}/resend-invite`, { method: 'POST' })
      setMagicLinkEmail(account.email)
      setModal('magic-sent')
    } catch (error) {
      setRequestError(error.message)
    }
  }

  function deactivationReason(account) {
    if (!canManageAccounts) return 'Only the primary Super Admin can deactivate accounts.'
    if (String(account.id) === String(currentAdminId)) return 'You cannot deactivate your own account.'
    if (account.role === 'super_admin' && account.isPrimary) return 'The primary Super Admin account is protected.'
    return ''
  }

  function handleDeactivate(account) {
    setSelectedAccount(account)
    setModal('deactivate')
  }

  async function handleConfirmDeactivate() {
    try {
      const result = await apiRequest(`/api/admin-accounts/${selectedAccount.id}/deactivate`, { method: 'POST' })
      await loadAccounts()
      if (result.warning) setRequestError(result.warning)
      setModal(null)
      setSelectedAccount(null)
    } catch (error) {
      setRequestError(error.message)
    }
  }

  function handleReactivate(account) {
    setSelectedAccount(account)
    setModal('reactivate')
  }

  async function handleConfirmReactivate() {
    try {
      await apiRequest(`/api/admin-accounts/${selectedAccount.id}/reactivate`, { method: 'POST' })
      await loadAccounts()
      setModal(null)
      setSelectedAccount(null)
      setActiveTab(selectedAccount.role === 'mall_admin' ? 'mall-admins' : 'super-admins')
    } catch (error) {
      setRequestError(error.message)
    }
  }

  function closeModal() {
    if (actionInFlight.current) return
    setModal(null)
    setSelectedAccount(null)
  }

  async function runAction(action, ...args) {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setActionBusy(true)
    setRequestError('')
    try { return await action(...args) } finally { actionInFlight.current = false; setActionBusy(false) }
  }

  /* ── Tab config ── */
  const tabs = [
    { key: 'super-admins', label: 'Super Admins', count: superAdmins.length },
    { key: 'mall-admins', label: 'Mall Admins', count: mallAdmins.length },
    { key: 'deact-super', label: 'Deactivated Super Admins', count: deactSuper.length },
    { key: 'deact-mall', label: 'Deactivated Mall Admins', count: deactMall.length },
  ]

  function renderTable() {
    if (loading) {
      return <div className="acct-table-loading" role="status"><span className="table-loading"><span className="table-loading-spinner" />Loading accounts...</span></div>
    }
    const superList = filterList(superAdmins)
    const mallList = filterList(mallAdmins)
    const deactSuperList = filterList(deactSuper)
    const deactMallList = filterList(deactMall)

    if (activeTab === 'super-admins') return (
      <div className="acct-mgmt-table-wrap">
        <div className="acct-mgmt-table-scroll">
          <table className="acct-mgmt-table">
            <thead><tr><th>ACCOUNT</th><th>EMAIL</th><th>JOB TITLE</th><th>CONTACT</th><th>CREATED</th><th>LAST UPDATED</th><th>LAST LOGIN</th><th>ACCOUNT STATUS</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {superList.length === 0 && <tr className="acct-empty-row"><td colSpan={9}>No accounts found.</td></tr>}
              {superList.map(a => {
                const accountStatus = a.lifecycle === 'partial' ? 'Partial' : 'Official'
                return (
                  <tr key={a.id} tabIndex={0} onClick={event => { if (!event.target.closest('button')) setDetails(a) }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setDetails(a) } }} className={a.status === 'pending' ? 'row--pending' : ''}>
                    <td><div className="acct-name-cell"><span className="acct-name-label">{a.name}</span>{a.status === 'pending' && <span className="acct-pending-badge">Pending</span>}</div></td>
                    <td>{a.email}</td>
                    <td>{a.jobTitle || '-'}</td>
                    <td>{a.contact || '-'}</td>
                    <td>{a.created}</td>
                    <td>{a.lastUpdated}</td>
                    <td>{a.lastLogin}</td>
                    <td><span className={`acct-account-status-badge acct-account-status--${accountStatus.toLowerCase()}`}>{accountStatus}</span></td>
                    <td>
                    <div className="acct-actions">
                      <button disabled={actionBusy} className="acct-action-btn acct-action-btn--edit" onClick={() => { setSelectedAccount(a); setModal('edit') }}>Edit</button>
                      {canManageAccounts && !a.isPrimary && <button disabled={actionBusy || !!resetPasswordReason(a)} title={resetPasswordReason(a) || 'Send a password reset email'} className="acct-action-btn acct-action-btn--reset" onClick={() => handleResetPassword(a)}>Reset Password</button>}
                      {canManageAccounts && <button disabled={actionBusy || !!deactivationReason(a)} title={deactivationReason(a) || 'Deactivate this account'} className="acct-action-btn acct-action-btn--deactivate" onClick={() => handleDeactivate(a)}>Deactivate</button>}
                      {a.status === 'pending' && canManageAccounts && String(a.id) !== String(currentAdminId) && <BusyButton disabled={actionBusy} className="acct-action-btn acct-action-btn--resend" onClick={() => runAction(handleResendLink, a)}>Resend invite</BusyButton>}
                    </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )

    if (activeTab === 'mall-admins') return (
      <div className="acct-mgmt-table-wrap">
        <div className="acct-mgmt-table-scroll">
          <table className="acct-mgmt-table">
            <thead><tr><th>ACCOUNT</th><th>MALL</th><th>EMAIL</th><th>JOB TITLE</th><th>CONTACT</th><th>CREATED</th><th>LAST UPDATED</th><th>LAST LOGIN</th><th>IS PRIMARY</th><th>ACCOUNT STATUS</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {mallList.length === 0 && <tr className="acct-empty-row"><td colSpan={11}>No accounts found.</td></tr>}
              {mallList.map(a => {
                const accountStatus = a.lifecycle === 'partial' ? 'Partial' : 'Official'
                return (
                  <tr key={a.id} tabIndex={0} onClick={event => { if (!event.target.closest('button')) setDetails(a) }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setDetails(a) } }} className={a.status === 'pending' ? 'row--pending' : ''}>
                    <td><div className="acct-name-cell"><span className="acct-name-label">{a.name}</span>{a.status === 'pending' && <span className="acct-pending-badge">Pending</span>}</div></td>
                    <td>{a.mall}</td>
                    <td>{a.email}</td>
                    <td>{a.jobTitle || '-'}</td>
                    <td>{a.contact}</td>
                    <td>{a.created}</td>
                    <td>{a.lastUpdated}</td>
                    <td>{a.lastLogin}</td>
                    <td><span className={`acct-primary-badge acct-primary-badge--${a.isPrimary ? 'yes' : 'no'}`}>{a.isPrimary ? 'Yes' : 'No'}</span></td>
                    <td><span className={`acct-account-status-badge acct-account-status--${accountStatus.toLowerCase()}`}>{accountStatus}</span></td>
                    <td>
                      <div className="acct-actions">
                        <button disabled={actionBusy} className="acct-action-btn acct-action-btn--edit" onClick={() => { setSelectedAccount(a); setModal('edit') }}>Edit</button>
                        {canManageAccounts && <button disabled={actionBusy || !!deactivationReason(a)} title={deactivationReason(a) || 'Deactivate this account'} className="acct-action-btn acct-action-btn--deactivate" onClick={() => handleDeactivate(a)}>Deactivate</button>}
                      {a.status === 'pending' && canManageAccounts && String(a.id) !== String(currentAdminId) && <BusyButton disabled={actionBusy} className="acct-action-btn acct-action-btn--resend" onClick={() => runAction(handleResendLink, a)}>Resend invite</BusyButton>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )

    if (activeTab === 'deact-super') return (
      <div className="acct-mgmt-table-wrap">
        <div className="acct-mgmt-table-scroll">
          <table className="acct-mgmt-table">
            <thead><tr><th>ACCOUNT</th><th>EMAIL</th><th>JOB TITLE</th><th>CONTACT</th><th>CREATED</th><th>LAST UPDATED</th><th>LAST LOGIN</th><th>DEACTIVATED ON</th><th>ACTION</th></tr></thead>
            <tbody>
              {deactSuperList.length === 0 && <tr className="acct-empty-row"><td colSpan={9}>No deactivated accounts.</td></tr>}
              {deactSuperList.map(a => (
                <tr key={a.id} tabIndex={0} onClick={event => { if (!event.target.closest('button')) setDetails(a) }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setDetails(a) } }}>
                  <td><span className="acct-name-label">{a.name}</span></td>
                  <td>{a.email}</td>
                  <td>{a.jobTitle || '-'}</td>
                  <td>{a.contact || '-'}</td>
                  <td>{a.created}</td>
                  <td>{a.lastUpdated}</td>
                  <td>{a.lastLogin}</td>
                  <td>{a.deactivatedOn}</td>
                  <td>{canManageAccounts && <button disabled={actionBusy} className="acct-action-btn acct-action-btn--reactivate" onClick={() => handleReactivate(a)}>Reactivate</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )

    if (activeTab === 'deact-mall') return (
      <div className="acct-mgmt-table-wrap">
        <div className="acct-mgmt-table-scroll">
          <table className="acct-mgmt-table">
            <thead><tr><th>ACCOUNT</th><th>MALL</th><th>EMAIL</th><th>JOB TITLE</th><th>CONTACT</th><th>CREATED</th><th>LAST UPDATED</th><th>LAST LOGIN</th><th>DEACTIVATED ON</th><th>ACCOUNT STATUS</th><th>ACTION</th></tr></thead>
            <tbody>
              {deactMallList.length === 0 && <tr className="acct-empty-row"><td colSpan={11}>No deactivated accounts.</td></tr>}
              {deactMallList.map(a => {
                const accountStatus = a.lifecycle === 'partial' ? 'Partial' : 'Official'
                return (
                  <tr key={a.id} tabIndex={0} onClick={event => { if (!event.target.closest('button')) setDetails(a) }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setDetails(a) } }}>
                    <td><span className="acct-name-label">{a.name}</span></td>
                    <td>{a.mall}</td>
                    <td>{a.email}</td>
                    <td>{a.jobTitle || '-'}</td>
                    <td>{a.contact || '-'}</td>
                    <td>{a.created}</td>
                    <td>{a.lastUpdated}</td>
                    <td>{a.lastLogin}</td>
                    <td>{a.deactivatedOn}</td>
                    <td><span className={`acct-account-status-badge acct-account-status--${accountStatus.toLowerCase()}`}>{accountStatus}</span></td>
                    <td>{canManageAccounts && <button disabled={actionBusy} className="acct-action-btn acct-action-btn--reactivate" onClick={() => handleReactivate(a)}>Reactivate</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )

    return null
  }

  return (
    <div className="acct-mgmt-page">
      {/* Header */}
      <div className="acct-mgmt-header">
        <div className="acct-mgmt-header-left">
          <h1 className="acct-mgmt-title">Account Management</h1>
          <p className="acct-mgmt-subtitle">
            {superAdmins.length} super admins · {mallAdmins.length} mall admins ·{' '}
            <span className="acct-mgmt-subtitle-alert">{deactivatedCount} deactivated</span>
          </p>
        </div>
        <div className="acct-header-actions">
          <BusyButton className="acct-refresh-btn" disabled={actionBusy || loading} onClick={() => loadAccounts(true)}>Refresh accounts</BusyButton>
          <button disabled={loading || actionBusy} className="acct-mgmt-add-btn" onClick={() => openCreate('super-admin')}>Add new account</button>
        </div>
      </div>

      {actionBusy && <div className="acct-request-tools" role="status">Processing account request...</div>}
      {/* Stats */}
      <div className="acct-mgmt-stats">
        <div className="acct-stat-card acct-stat-card--super">
          <div className="acct-stat-icon"><StatIconSuperAdmin /></div>
          <div className="acct-stat-count acct-stat-count--super">{superAdmins.length}</div>
          <div className="acct-stat-label acct-stat-label--super">Super Admins</div>
        </div>
        <div className="acct-stat-card acct-stat-card--mall">
          <div className="acct-stat-icon"><StatIconMallAdmin /></div>
          <div className="acct-stat-count acct-stat-count--mall">{mallAdmins.length}</div>
          <div className="acct-stat-label acct-stat-label--mall">Mall Admins</div>
        </div>
        <div className="acct-stat-card acct-stat-card--pending">
          <div className="acct-stat-icon"><StatIconPending /></div>
          <div className="acct-stat-count acct-stat-count--pending">{pendingCount}</div>
          <div className="acct-stat-label acct-stat-label--pending">Pending Login</div>
        </div>
        <div className="acct-stat-card acct-stat-card--deactivated">
          <div className="acct-stat-icon"><StatIconDeactivated /></div>
          <div className="acct-stat-count acct-stat-count--deactivated">{deactivatedCount}</div>
          <div className="acct-stat-label acct-stat-label--deactivated">Deactivated</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="acct-mgmt-toolbar">
        <div className="acct-mgmt-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`acct-tab-btn${activeTab === t.key ? ' acct-tab-btn--active' : ''}`}
              onClick={() => { setActiveTab(t.key); setSearch('') }}
            >
              {t.label}
              <span className={`acct-tab-count${activeTab === t.key ? ' acct-tab-count--super-active' : ''}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="acct-mgmt-search-wrap">
          <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
            <path d="M8.75 17.5C13.5825 17.5 17.5 13.5825 17.5 8.75C17.5 3.91751 13.5825 0 8.75 0C3.91751 0 0 3.91751 0 8.75C0 13.5825 3.91751 17.5 8.75 17.5Z" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.9375 14.9373L21.0002 21" stroke="#979797" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input className="acct-mgmt-search-input" placeholder="Search accounts" aria-label="Search by name, email, mall or job title" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      {renderTable()}

      {details && <AccountDetailsPanel account={details} onClose={() => setDetails(null)} />}

      {/* Modals */}
      {modal === 'create' && (
        <AccountFormModal
          mode="create"
          createTabInit={createTabInit}
          mallAdmins={mallAdmins}
          malls={malls}
          onClose={closeModal}
          onSave={values => runAction(handleSaveCreate, values)}
        />
      )}
      {modal === 'created' && createdAccount && (
        <AccountCreatedModal account={createdAccount} onClose={closeModal} />
      )}
      {modal === 'edit' && selectedAccount && (
        <AccountFormModal
          mode="edit"
          account={selectedAccount}
          mallAdmins={mallAdmins}
          malls={malls}
          onClose={closeModal}
          onSave={values => runAction(handleSaveEdit, values)}
        />
      )}
      {modal === 'reset' && selectedAccount && (
        <ResetPasswordModal account={selectedAccount} onClose={closeModal} onConfirm={() => runAction(handleConfirmReset)} />
      )}
      {modal === 'magic-sent' && (
        <MagicLinkSentModal email={magicLinkEmail} onClose={closeModal} />
      )}
      {modal === 'deactivate' && selectedAccount && (
        <DeactivateModal account={selectedAccount} onClose={closeModal} onConfirm={() => runAction(handleConfirmDeactivate)} />
      )}
      {modal === 'reactivate' && selectedAccount && (
        <ReactivateModal account={selectedAccount} onClose={closeModal} onConfirm={() => runAction(handleConfirmReactivate)} />
      )}
      {requestError && <MessageModal title="Account notice" message={requestError} onClose={() => setRequestError('')} />}
    </div>
  )
}