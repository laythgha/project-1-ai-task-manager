import { useState } from 'react';
import api from './api';

const colors = {
  bg: '#f4f5f7',
  panel: '#ffffff',
  border: '#e2e4e9',
  text: '#1f2430',
  muted: '#6b7280',
  primary: '#4f46e5',
  primaryText: '#ffffff',
  danger: '#dc2626',
};

const styles = {
  page: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    backgroundColor: colors.bg,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 360,
    backgroundColor: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 1px 3px rgba(16, 24, 40, 0.06)',
  },
  title: { margin: '0 0 4px 0', fontSize: 20, fontWeight: 700, color: colors.text },
  subtitle: { margin: '0 0 20px 0', fontSize: 14, color: colors.muted },
  input: {
    width: '100%',
    padding: 10,
    backgroundColor: '#fff',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    marginBottom: 10,
    boxSizing: 'border-box',
  },
  buttonPrimary: {
    width: '100%',
    padding: 10,
    backgroundColor: colors.primary,
    color: colors.primaryText,
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 10,
  },
  buttonSecondary: {
    width: '100%',
    padding: 10,
    backgroundColor: '#fff',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 10,
  },
  switchText: { fontSize: 13, color: colors.muted, textAlign: 'center', margin: 0 },
  switchButton: { border: 'none', background: 'none', color: colors.primary, cursor: 'pointer', fontWeight: 600 },
  errorText: { color: colors.danger, fontSize: 13, margin: '0 0 10px 0' },
  divider: { textAlign: 'center', color: colors.muted, fontSize: 12, margin: '4px 0 14px 0' },
};

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
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>AI Task Manager</h1>
        <p style={styles.subtitle}>{isSignup ? 'Create an account' : 'Welcome back'}</p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          {error && <p style={styles.errorText}>{error}</p>}

          <button type="submit" style={styles.buttonPrimary}>
            {isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <div style={styles.divider}>or</div>

        <button onClick={handleGoogleLogin} style={styles.buttonSecondary}>
          Sign in with Google
        </button>

        <p style={styles.switchText}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsSignup(!isSignup)} style={styles.switchButton}>
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
