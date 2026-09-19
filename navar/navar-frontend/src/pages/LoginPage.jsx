import { useState } from 'react'
import '../styles/login/login.css'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onLogin()
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
              type="text"
              placeholder="Email address or username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            <input
              className="login-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button className="login-submit" type="submit">LOGIN</button>
          </form>
        </div>
      </div>
    </div>
  )
}
