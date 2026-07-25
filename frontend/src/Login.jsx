import { useState } from 'react';
import api from './api';

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
      onLogin(res.data.userId);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleGoogleLogin = () => {
  window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
};

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>AI Task Manager</h1>
      <h2>{isSignup ? 'Sign Up' : 'Log In'}</h2>

      <form onSubmit={handleSubmit}>
        {isSignup && (
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: 8, backgroundColor: 'white', color: 'black' }}
              required
            />
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
	    style={{ width: '100%', padding: 8, backgroundColor: 'white', color: 'black' }}
	    required
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8, backgroundColor: 'white', color: 'black' }}
            required
          />
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" style={{ width: '100%', padding: 10, backgroundColor: 'black', marginBottom: 10 }}>
          {isSignup ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      <button onClick={handleGoogleLogin} style={{ width: '100%', padding: 10, backgroundColor: 'black', marginBottom: 10 }}>
        Sign in with Google
      </button>

      <p>
        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button onClick={() => setIsSignup(!isSignup)} style={{ border: 'none', background: 'none', color: 'blue', cursor: 'pointer' }}>
          {isSignup ? 'Log In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
}

export default Login;