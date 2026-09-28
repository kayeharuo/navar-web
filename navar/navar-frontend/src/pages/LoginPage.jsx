import { useState } from 'react'
import { supabase } from '../config/supabase'
import MessageModal from '../components/ui/MessageModal'
import '../styles/login/login.css'

export default function LoginPage({ message }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(message || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError) setError('Invalid email or password.')
    } catch {
      setError('Unable to sign in right now. Check the connection and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <img
        className="login-bg"
        src="https://api.builder.io/api/v1/image/assets/TEMP/bb0f62020a8567632aca32c4ab2ddc66c3419ed1?width=3024"
        alt=""
      />

      <div className="login-content">
        <div className="login-brand">
          <img
            className="login-brand-icon"
            src="https://api.builder.io/api/v1/image/assets/TEMP/2c996f6b8ba0c836e18e33ad145f6784b3e43c1f?width=442"
            alt=""
          />
          <img
            className="login-brand-wordmark"
            src="https://api.builder.io/api/v1/image/assets/TEMP/0f6e96cc74f0ae3b1f43269651b5272957e26738?width=868"
            alt="NavAR"
          />
          <p className="login-tagline">Shop Smart. Move Smarter.</p>
        </div>

        <div className="login-form-panel">
          <h1 className="login-title">Welcome!</h1>
          <p className="login-subtitle">Please enter your sign in details</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              className="login-input"
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              className="login-input"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? <span className="login-spinner" aria-label="Signing in" /> : 'LOGIN'}
            </button>
          </form>
        </div>
      </div>
      {notice && <MessageModal title="Password updated" message={notice} onClose={() => setNotice('')} />}
      {error && <MessageModal title="Sign-in failed" message={error} onClose={() => setError('')} />}
    </div>
  )
}
