import { useState } from 'react';
import api from './api';
import './Login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignup) {
        await api.post('/signup', { name, email, password });
      }
      const res = await api.post('/login', { email, password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.userId);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-brand">
          <span className="auth-hero-mark">✦</span>
          AI Task Manager
        </div>

        <div className="auth-hero-copy">
          <h1>Plan smarter, ship faster.</h1>
          <p>
            Organize workspaces, projects, and tasks in one place — with an
            AI teammate that helps you stay on top of it all in real time.
          </p>
        </div>

        <div className="auth-hero-stats">
          <div>
            <strong>Real-time</strong>
            <span>Live task sync</span>
          </div>
          <div>
            <strong>AI-powered</strong>
            <span>Chat to manage work</span>
          </div>
          <div>
            <strong>Role-based</strong>
            <span>Team permissions</span>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-mark">
            <span>✦</span>
            AI Task Manager
          </div>

          <h1 className="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-subtitle">
            {isSignup ? 'Start organizing your team’s work in minutes.' : 'Log in to pick up where you left off.'}
          </p>

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <div className="auth-field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="btn btn-primary btn-block auth-submit">
              {isSignup ? 'Sign Up' : 'Log In'}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button onClick={handleGoogleLogin} className="btn btn-secondary btn-block">
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Sign in with Google
          </button>

          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => setIsSignup(!isSignup)}>
              {isSignup ? 'Log In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
