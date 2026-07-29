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
    return null;
  }

  if (!userId) {
    return <Login onLogin={setUserId} />;
  }

  return <Dashboard userId={userId} onLogout={handleLogout} />;
}

export default App;
