import React from 'react';
import './Nav.css';

const VIEWS = [
  { id: 'admin',     label: 'Command Center',   sub: 'Admin'     },
  { id: 'passenger', label: 'Booking Terminal',  sub: 'Passenger' },
  { id: 'kiosk',     label: 'My Boarding Pass',  sub: 'Kiosk'     },
];

export default function Nav({ activeView, onNavigate }) {
  return (
    <nav className="main-nav" role="navigation" aria-label="Main navigation">
      <div className="main-nav-inner">
        {VIEWS.map(v => (
          <button
            key={v.id}
            id={`nav-${v.id}`}
            className={`nav-tab ${activeView === v.id ? 'nav-tab-active' : ''}`}
            onClick={() => onNavigate(v.id)}
            aria-current={activeView === v.id ? 'page' : undefined}
            type="button"
          >
            <div className="nav-tab-text">
              <span className="nav-tab-label">{v.label}</span>
              <span className="nav-tab-sub">{v.sub}</span>
            </div>
            {activeView === v.id && <span className="nav-tab-indicator" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
