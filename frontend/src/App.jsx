import { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import api from './api';

function App() {
  const [userId, setUserId] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get('token');
    if (googleToken) {
      localStorage.setItem('token', googleToken);
      window.history.replaceState({}, '', '/');
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setCheckingSession(false);
      return;
    }

    api.get('/me')
      .then((res) => setUserId(res.data.id))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUserId(null);
  };

  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (!userId) {
    return <Login onLogin={setUserId} />;
  }

  return <Dashboard userId={userId} onLogout={handleLogout} />;
}

export default App;
