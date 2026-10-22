import { useEffect, useState } from 'react'
import { Camera, Eye, EyeOff } from 'lucide-react'
import { apiRequest } from '../../config/api'
import { supabase } from '../../config/supabase'
import MessageModal from '../ui/MessageModal'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/
const EMPTY_PROFILE = { name: '', email: '', jobTitle: '', contactNum: '', profilePicture: null }

function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  const Icon = show ? EyeOff : Eye
  return (
    <div className="profile-field">
      <label className="profile-field-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={show ? 'text' : 'password'} className="profile-field-input" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={{ width: '100%', paddingRight: '38px', boxSizing: 'border-box' }} />
        <button type="button" onClick={() => setShow(current => !current)} aria-label={show ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <Icon size={16} color="#9CA3AF" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

export default function ProfilePanel({ onClose, onProfileUpdated }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [draft, setDraft] = useState(EMPTY_PROFILE)
  const [editing, setEditing] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [requestError, setRequestError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPicture, setShowPicture] = useState(false)

  useEffect(() => {
    function handleEsc(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    apiRequest('/api/auth/profile').then(data => { setProfile(data); setDraft(data) }).catch(error => setRequestError(error.message))
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function startEdit() { setDraft({ ...profile }); setEditing(true) }

  async function saveProfile() {
    try {
      const saved = await apiRequest('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: draft.name.trim(), job_title: draft.jobTitle.trim(), contact_num: draft.contactNum }) })
      const next = { ...profile, name: saved.name, jobTitle: saved.jobTitle || '', contactNum: saved.contactNum || '' }
      setProfile(next); setDraft(next); setEditing(false); onProfileUpdated?.(next); setSuccess('Profile saved.')
    } catch (error) { setRequestError(error.message) }
  }

  function choosePicture(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setRequestError('Please choose an image file.'); return }
    if (file.size > 700000) { setRequestError('Profile picture must be 700 KB or smaller.'); return }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const saved = await apiRequest('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ profile_picture: reader.result }) })
        const next = { ...profile, profilePicture: saved.profilePicture }
        setProfile(next); setDraft(next); onProfileUpdated?.(next); setSuccess('Profile picture saved.')
      } catch (error) { setRequestError(error.message) }
    }
    reader.readAsDataURL(file)
  }

  async function changePassword() {
    const errors = {}
    if (!pwForm.current) errors.current = 'Required.'
    if (!PASSWORD_RULE.test(pwForm.newPw)) errors.newPw = 'Use at least 8 characters with lowercase, uppercase, and a special character.'
    if (pwForm.newPw !== pwForm.confirm) errors.confirm = 'Passwords do not match.'
    if (Object.keys(errors).length) { setPwErrors(errors); return }
    setPwErrors({})
    const { error: verified } = await supabase.auth.signInWithPassword({ email: profile.email, password: pwForm.current })
    if (verified) { setRequestError('The current password is incorrect.'); return }
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) { setRequestError('Unable to change the password.'); return }
    setPwForm({ current: '', newPw: '', confirm: '' }); setSuccess('Password changed successfully.')
  }

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="panel-sheet" role="dialog" aria-label="My Profile">
        <div className="panel-header"><div className="panel-header-info"><h2 className="panel-title">My Profile</h2><p className="panel-subtitle">Manage your personal information and password.</p></div><button className="panel-close" onClick={onClose}>X</button></div>
        <div className="panel-divider" />
        <div className="profile-body">
          <div className="profile-user-card">
            <button className="profile-user-avatar profile-picture-picker" type="button" title={profile.profilePicture ? 'View profile picture' : 'Add profile picture'} onClick={() => setShowPicture(true)}>
              {profile.profilePicture ? <img src={profile.profilePicture} alt="Profile" /> : <span>{profile.name?.charAt(0) || '?'}</span>}
              <span className="profile-picture-overlay"><Camera size={20} /><span>View</span></span>
            </button>
            <div><p className="profile-user-name">{profile.name || 'Loading...'}</p><p className="profile-user-meta">{profile.jobTitle || 'Super Admin'} · {profile.email}</p></div>
          </div>
          <div className="profile-section">
            <div className="profile-section-head"><h3 className="profile-section-title">Personal Information</h3><p className="profile-section-sub">Update your name, job title, and contact details.</p></div>
            <div className="profile-form-grid">
              <div className="profile-field"><label className="profile-field-label">Full Name</label><input className="profile-field-input" value={editing ? draft.name : profile.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} readOnly={!editing} /></div>
              <div className="profile-field"><label className="profile-field-label">Email Address</label><input className="profile-field-input" value={profile.email} readOnly /><p className="profile-field-hint">This is your login email and cannot be changed here.</p></div>
              <div className="profile-field"><label className="profile-field-label">Job Title</label><input className="profile-field-input" value={editing ? draft.jobTitle : profile.jobTitle} onChange={event => setDraft(current => ({ ...current, jobTitle: event.target.value }))} readOnly={!editing} /></div>
              <div className="profile-field"><label className="profile-field-label">Contact Number</label><input className="profile-field-input" type="number" inputMode="numeric" value={editing ? draft.contactNum : profile.contactNum} onChange={event => setDraft(current => ({ ...current, contactNum: event.target.value.replace(/\D/g, '') }))} readOnly={!editing} /></div>
            </div>
            <div className="profile-form-actions">{editing ? <><button className="profile-btn profile-btn--secondary" onClick={() => setEditing(false)}>Cancel</button><button className="profile-btn profile-btn--primary" onClick={saveProfile}>Save Changes</button></> : <button className="profile-btn profile-btn--primary" onClick={startEdit}>Edit</button>}</div>
          </div>
          <div className="profile-section"><div className="profile-section-head"><h3 className="profile-section-title">Change Password</h3><p className="profile-section-sub">Use at least 8 characters with lowercase, uppercase, and a special character.</p></div>
            <PasswordField label="Current Password" value={pwForm.current} onChange={value => setPwForm(current => ({ ...current, current: value }))} placeholder="Enter current password" />{pwErrors.current && <p className="profile-field-error">{pwErrors.current}</p>}
            <PasswordField label="New Password" value={pwForm.newPw} onChange={value => setPwForm(current => ({ ...current, newPw: value }))} placeholder="New password" />{pwErrors.newPw && <p className="profile-field-error">{pwErrors.newPw}</p>}
            <PasswordField label="Confirm New Password" value={pwForm.confirm} onChange={value => setPwForm(current => ({ ...current, confirm: value }))} placeholder="Repeat new password" />{pwErrors.confirm && <p className="profile-field-error">{pwErrors.confirm}</p>}
            <div className="profile-form-actions"><button className="profile-btn profile-btn--primary" onClick={changePassword}>Change Password</button></div>
          </div>
        </div>
      </div>
      {showPicture && (
        <div className="profile-picture-lightbox" onClick={event => event.target === event.currentTarget && setShowPicture(false)}>
          <div className="profile-picture-lightbox-content">
            {profile.profilePicture
              ? <img src={profile.profilePicture} alt="Profile" />
              : <div className="profile-picture-empty-preview">{profile.name?.charAt(0) || '?'}</div>}
            <div className="profile-picture-lightbox-actions">
              <label className="profile-btn profile-btn--primary">Change picture<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => { setShowPicture(false); choosePicture(event) }} hidden /></label>
              <button className="profile-btn profile-btn--secondary" type="button" onClick={() => setShowPicture(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {success && <MessageModal title="Success" message={success} onClose={() => setSuccess('')} />}
      {requestError && <MessageModal title="Request failed" message={requestError} onClose={() => setRequestError('')} />}
    </>
  )
}
