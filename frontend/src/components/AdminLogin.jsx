import React, { useState } from 'react';
import './AdminLogin.css';

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'StarCommand!2026') {
      onLogin();
    } else {
      setError('Invalid credentials. Access Denied.');
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <h2>Command Center Login</h2>
        <p>Restricted access for StarRoute administrators only.</p>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Password"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-submit-btn">Authenticate</button>
        </form>
      </div>
    </div>
  );
}

