import { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleUserId = params.get('userId');
    if (googleUserId) {
      setUserId(parseInt(googleUserId));
      window.history.replaceState({}, '', '/');
    }
  }, []);

  if (!userId) {
    return <Login onLogin={setUserId} />;
  }

  return <Dashboard userId={userId} />;
}

export default App;
