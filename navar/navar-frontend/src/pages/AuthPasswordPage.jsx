import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { apiRequest } from '../config/api'
import MessageModal from '../components/ui/MessageModal'
import '../styles/login/login.css'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/
const REQUEST_ID_RULE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function AuthPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isReset = location.pathname.endsWith('reset-password')
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const requestId = useRef('')

  useEffect(() => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (!settled) setExpired(true)
    }, 5000)
    async function establishLinkSession() {
      const search = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const id = search.get('request') || ''
      requestId.current = id
      if (!REQUEST_ID_RULE.test(id)) throw new Error('Missing request')

      const existing = await apiRequest('/api/auth/password-link/validate', {
        method: 'POST',
        body: JSON.stringify({ request_id: id }),
      }).catch(() => null)
      if (existing?.valid) {
        settled = true
        setReady(true)
        window.clearTimeout(timer)
        window.history.replaceState({}, '', `${window.location.pathname}?request=${encodeURIComponent(id)}`)
        return
      }

      const { data: currentSession } = await supabase.auth.getSession()
      if (currentSession.session) await supabase.auth.signOut({ scope: 'local' })
      let result
      const hashAccessToken = hash.get('access_token')
      const hashRefreshToken = hash.get('refresh_token')
      if (hashAccessToken && hashRefreshToken) {
        result = await supabase.auth.setSession({ access_token: hashAccessToken, refresh_token: hashRefreshToken })
      } else if (search.get('code')) {
        result = await supabase.auth.exchangeCodeForSession(search.get('code'))
      } else if (search.get('token_hash')) {
        result = await supabase.auth.verifyOtp({
          token_hash: search.get('token_hash'),
          type: search.get('type') || (isReset ? 'recovery' : 'invite'),
        })
      } else {
        throw new Error('Missing authentication token')
      }
      if (result.error) throw result.error
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Missing session')
      const validated = await apiRequest('/api/auth/password-link/validate', {
        method: 'POST',
        body: JSON.stringify({ request_id: id }),
      })
      if (!validated?.valid) throw new Error('Invalid request')
      settled = true
      setReady(true)
      window.clearTimeout(timer)
      window.history.replaceState({}, '', `${window.location.pathname}?request=${encodeURIComponent(id)}`)
    }

    establishLinkSession().catch(async () => {
      await supabase.auth.signOut({ scope: 'local' })
      setExpired(true)
    })
    return () => {
      window.clearTimeout(timer)
    }
  }, [isReset])

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!PASSWORD_RULE.test(password)) {
      setError('Password must be at least 8 characters and include a lowercase letter, an uppercase letter, and a special character.')
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    const claimed = await apiRequest('/api/auth/password-link/claim', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId.current }),
    }).catch(() => null)
    if (!claimed) {
      setError('Unable to save your password. Please request a new link.')
      setSaving(false)
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Unable to save your password. Please request a new link.')
      setSaving(false)
      return
    }
    const { data: passwordSession } = await supabase.auth.getSession()
    const email = passwordSession.session?.user?.email
    const { error: signInError } = email
      ? await supabase.auth.signInWithPassword({ email, password })
      : { error: new Error('Missing account email') }
    if (signInError) {
      setError('Password changed, but account setup could not be completed. Please contact a Super Admin.')
      setSaving(false)
      return
    }
    const completed = await apiRequest('/api/auth/password-link/complete', {
      method: 'POST',
      body: JSON.stringify({ request_id: requestId.current }),
    }).catch(() => null)
    if (!completed) {
      setError('Password changed, but account setup could not be completed. Please contact a Super Admin.')
      setSaving(false)
      return
    }
    await supabase.auth.signOut({ scope: 'global' })
    navigate('/login', { replace: true, state: { message: 'Password saved. Please sign in.' } })
  }

  if (expired) return <div className="login-page"><MessageModal title="Link unavailable" message="This link is invalid or expired. Ask a Super Admin to send a new one." onClose={() => navigate('/login', { replace: true })} /></div>
  if (!ready) return <div className="login-page" aria-busy="true"><span className="login-spinner login-spinner--dark" aria-label="Loading" /></div>

  return (
    <div className="login-page">
      <div className="login-form-panel">
        <h1 className="login-title">{isReset ? 'Reset password' : 'Set your password'}</h1>
        <form className="login-form" onSubmit={submit}>
          <input className="login-input" type="password" placeholder="New password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required />
          <input className="login-input" type="password" placeholder="Confirm password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
          <p className="password-requirement"><span>*</span> Password must be at least 8 characters and include a lowercase letter, an uppercase letter, and a special character.</p>
          <button className="login-submit" type="submit" disabled={saving}>{saving ? <span className="login-spinner" aria-label="Saving password" /> : 'SAVE PASSWORD'}</button>
        </form>
      </div>
      {error && <MessageModal title="Password not saved" message={error} onClose={() => setError('')} />}
    </div>
  )
}