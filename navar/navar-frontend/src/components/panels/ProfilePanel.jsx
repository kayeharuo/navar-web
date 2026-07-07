import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const INITIAL_PROFILE = {
  fullName:    'Delicious Burger',
  email:       'delicious.b@navar.ph',
  jobTitle:    'IT Manager',
  contactNo:   '09171234567',
}

function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  const Icon = show ? EyeOff : Eye

  return (
    <div className="profile-field">
      <label className="profile-field-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          className="profile-field-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', paddingRight: '38px', boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <Icon size={16} color="#9CA3AF" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

export default function ProfilePanel({ onClose }) {
  const [profile, setProfile] = useState(INITIAL_PROFILE)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(INITIAL_PROFILE)

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function startEdit() {
    setDraft({ ...profile })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  function saveEdit() {
    setProfile({ ...draft })
    setEditing(false)
  }

  function handlePwChange() {
    const errs = {}
    if (!pwForm.current.trim()) errs.current = 'Required.'
    if (!pwForm.newPw.trim() || pwForm.newPw.length < 8) errs.newPw = 'Must be at least 8 characters.'
    if (pwForm.newPw !== pwForm.confirm) errs.confirm = 'Passwords do not match.'
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return }
    setPwErrors({})
    setPwSuccess(true)
    setPwForm({ current: '', newPw: '', confirm: '' })
    setTimeout(() => setPwSuccess(false), 3000)
  }

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="panel-sheet" role="dialog" aria-label="My Profile">
        {/* Header */}
        <div className="panel-header">
          <div className="panel-header-info">
            <h2 className="panel-title">My Profile</h2>
            <p className="panel-subtitle">Manage your personal information and password.</p>
          </div>
          <button className="panel-close" onClick={onClose}>X</button>
        </div>
        <div className="panel-divider" />

        <div className="profile-body">
          {/* Identity card */}
          <div className="profile-user-card">
            <div className="profile-user-avatar">🍔</div>
            <div>
              <p className="profile-user-name">{profile.fullName}</p>
              <p className="profile-user-meta">{profile.jobTitle} · {profile.email}</p>
            </div>
          </div>

          {/* Personal Information */}
          <div className="profile-section">
            <div className="profile-section-head">
              <h3 className="profile-section-title">Personal Information</h3>
              <p className="profile-section-sub">Update your name, job title, and contact details.</p>
            </div>

            <div className="profile-form-grid">
              <div className="profile-field">
                <label className="profile-field-label">Full Name</label>
                <input
                  className="profile-field-input"
                  value={editing ? draft.fullName : profile.fullName}
                  onChange={e => setDraft(d => ({ ...d, fullName: e.target.value }))}
                  readOnly={!editing}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label">Email Address</label>
                <input
                  className="profile-field-input"
                  value={profile.email}
                  readOnly
                />
                <p className="profile-field-hint">This is your login email and cannot be changed here.</p>
              </div>

              <div className="profile-field">
                <label className="profile-field-label">Job Title</label>
                <input
                  className="profile-field-input"
                  value={editing ? draft.jobTitle : profile.jobTitle}
                  onChange={e => setDraft(d => ({ ...d, jobTitle: e.target.value }))}
                  readOnly={!editing}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label">Contact Number</label>
                <input
                  className="profile-field-input"
                  value={editing ? draft.contactNo : profile.contactNo}
                  onChange={e => setDraft(d => ({ ...d, contactNo: e.target.value }))}
                  readOnly={!editing}
                />
              </div>
            </div>

            <div className="profile-form-actions">
              {editing ? (
                <>
                  <button className="profile-btn profile-btn--secondary" onClick={cancelEdit}>Cancel</button>
                  <button className="profile-btn profile-btn--primary" onClick={saveEdit}>Save Changes</button>
                </>
              ) : (
                <button className="profile-btn profile-btn--primary" onClick={startEdit}>Edit</button>
              )}
            </div>
          </div>

          {/* Change Password */}
          <div className="profile-section">
            <div className="profile-section-head">
              <h3 className="profile-section-title">Change Password</h3>
              <p className="profile-section-sub">Choose a strong password to keep your account secure.</p>
            </div>

            {pwSuccess && (
              <div style={{ padding: '10px 14px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', fontFamily: 'Poppins', fontSize: '13px', color: '#16A34A' }}>
                Password changed successfully.
              </div>
            )}

            <PasswordField
              label="Current Password"
              value={pwForm.current}
              onChange={v => setPwForm(f => ({ ...f, current: v }))}
              placeholder="Enter current password"
            />
            {pwErrors.current && <p className="profile-field-error">{pwErrors.current}</p>}

            <PasswordField
              label="New Password"
              value={pwForm.newPw}
              onChange={v => setPwForm(f => ({ ...f, newPw: v }))}
              placeholder="At least 8 characters"
            />
            {pwErrors.newPw && <p className="profile-field-error">{pwErrors.newPw}</p>}

            <PasswordField
              label="Confirm New Password"
              value={pwForm.confirm}
              onChange={v => setPwForm(f => ({ ...f, confirm: v }))}
              placeholder="Repeat your new password"
            />
            {pwErrors.confirm && <p className="profile-field-error">{pwErrors.confirm}</p>}

            <div className="profile-form-actions">
              <button className="profile-btn profile-btn--primary" onClick={handlePwChange}>
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
