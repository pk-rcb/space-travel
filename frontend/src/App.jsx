import React, { useState } from 'react';
import { FlightProvider } from './context/FlightContext';
import Nav from './components/Nav';
import AdminView from './components/AdminView';
import AdminLogin from './components/AdminLogin';
import PassengerView from './components/PassengerView';
import KioskView from './components/KioskView';
import './App.css';

export default function App() {
  const [activeView, setActiveView]     = useState('passenger');
  const [isAdminAuth, setIsAdminAuth]   = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, msg) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 5500);
  };

  return (
    <FlightProvider>
      <div className="app-root">


        {/* ── Header ── */}
        <header className="app-header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-text">StarRoute</span>
              <span className="logo-badge">INTERPLANETARY</span>
            </div>
            <nav className="header-nav" aria-label="Header links">
              <span className="nav-item active">Platform</span>
            </nav>
          </div>
        </header>

        {/* ── Tab navigation ── */}
        <Nav activeView={activeView} onNavigate={setActiveView} />

        {/* ── Global notification banner ── */}
        {notification && (
          <div
            className={`notification-banner notification-${notification.type}`}
            role="alert"
            aria-live="assertive"
          >
            {notification.msg}
          </div>
        )}

        {/* ── View container ── */}
        <main className="view-container">
          {activeView === 'admin' && (
            isAdminAuth ? (
              <AdminView onScheduled={() => setActiveView('passenger')} />
            ) : (
              <AdminLogin onLogin={() => setIsAdminAuth(true)} />
            )
          )}
          {activeView === 'passenger' && (
            <PassengerView onNotification={showNotification} />
          )}
          {activeView === 'kiosk' && (
            <KioskView />
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="app-footer">
          <p>StarRoute Interplanetary · Drogon C++ API · Redis · RabbitMQ · PostgreSQL</p>
        </footer>
      </div>
    </FlightProvider>
  );
}
