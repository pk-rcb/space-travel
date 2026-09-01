import React, { useState } from 'react';
import './KioskView.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

// ─────────────────────────────────────────────────────────────────
// API helpers — wire to your Drogon backend
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/ticket?seat=C1
 * GET /api/ticket?passenger=John
 *
 * Server response (flat format):
 * {
 *   "status":     "found",
 *   "seat_code":  "C1",
 *   "passenger":  "pk",
 *   "date":       "2026-06-03",
 *   "source":     "Earth",
 *   "dest":       "Mars"
 * }
 *
 * Returns { ok, status, data } where data is the raw server JSON.
 */
async function apiFetchTicket({ date, passengerName }) {
  try {
    const params = new URLSearchParams();
    if (date)          params.set('date', date);
    if (passengerName) params.set('passenger', passengerName.trim());

    const resp = await fetch(`${API_BASE}/api/ticket?${params}`);
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function formatDateLong(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

// Simple deterministic QR-like pattern — purely decorative
function QrDecoration({ seed = 1 }) {
  const SIZE = 7;
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => {
    const r = Math.floor(i / SIZE), c = i % SIZE;
    // Corner finder patterns
    if ((r < 2 && c < 2) || (r < 2 && c >= SIZE - 2) || (r >= SIZE - 2 && c < 2)) return 'finder';
    return ((seed * 13 + i * 7 + r * 3 + c * 5) % 5) < 2 ? 'filled' : 'empty';
  });
  return (
    <div className="qr-grid" aria-hidden="true" style={{ '--qr-size': SIZE }}>
      {cells.map((type, i) => (
        <div key={i} className={`qr-cell qr-${type}`} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// KioskView Component
// ─────────────────────────────────────────────────────────────────
export default function KioskView() {
  const [journeyDate, setJourneyDate] = useState('');
  const [passengerName, setPassengerName] = useState('');
  const [searching, setSearching]   = useState(false);
  const [ticket, setTicket]         = useState(null);
  const [error, setError]           = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!journeyDate || !passengerName.trim()) {
      setError('Please provide both date and passenger name.');
      return;
    }

    setSearching(true);
    setError('');
    setTicket(null);

    const result = await apiFetchTicket({
      date: journeyDate,
      passengerName: passengerName.trim()
    });

    setSearching(false);

    // Network failure
    if (result.status === 0) {
      setError('Cannot reach server. Make sure the Drogon backend is running on port 8080.');
      return;
    }

    const d = result.data;

    // Server signals not found
    if (!result.ok || d.status === 'not_found' || d.status === 'error') {
      setError(d.error || d.message || 'No ticket found for that search query.');
      return;
    }

    // Normalise flat server fields → shape the boarding pass template expects
    setTicket({
      passenger:    d.passenger   || '—',
      seat_code:    d.seat_code   || '—',
      journey_date: d.date        || d.journey_date || '—',
      source_planet: d.source     || d.source_planet || '—',
      dest_planet:  d.dest        || d.dest_planet   || '—',
      commander:    d.commander   || '',
      astronaut:    d.astronaut   || '',
      craft:        d.craft       || 'Starship Ares IX',
      price:        d.price       || 250000,
      ticket_id:    d.ticket_id   || d.id || null,
    });
  };

  const t = ticket;

  return (
    <div className="kiosk-view">

      {/* ── Page header ── */}
      <div className="kiosk-page-header">
        <div>
          <h1 className="kiosk-page-title">Ticket Retrieval Kiosk</h1>
          <p className="kiosk-page-sub">Retrieve your boarding pass by seat code or passenger name</p>
        </div>
      </div>

      {/* ── Search form ── */}
      <section className="kiosk-search-card" aria-label="Ticket search">
        <form onSubmit={handleSearch} className="search-form" noValidate>
          
          <div className="search-input-group">
            <input
              id="kiosk-date-input"
              className="search-input"
              type="date"
              value={journeyDate}
              onChange={e => setJourneyDate(e.target.value)}
              aria-label="Journey date"
              required
            />
            
            <input
              id="kiosk-passenger-input"
              className="search-input"
              type="text"
              placeholder="Enter passenger full name…"
              value={passengerName}
              onChange={e => setPassengerName(e.target.value)}
              aria-label="Passenger name"
              required
            />
          </div>

          <button
            id="retrieve-ticket-btn"
            type="submit"
            className={`search-btn ${searching ? 'search-btn-loading' : ''}`}
            disabled={searching}
          >
            {searching
              ? <><span className="btn-spinner" /> Searching…</>
              : <>Retrieve Ticket</>}
          </button>
        </form>

        {error && <div className="search-error-msg">[Error] {error}</div>}
      </section>

      {/* ── Boarding Pass ── */}
      {t && (
        <section className="boarding-pass" aria-label="Your boarding pass">

          {/* Top half */}
          <div className="bp-top-half">
            {/* Header bar */}
            <div className="bp-header-bar">
              <div className="bp-brand">
                <div>
                  <span className="bp-brand-name">StarRoute</span>
                  <span className="bp-brand-tag">INTERPLANETARY</span>
                </div>
              </div>
              <div className="bp-badge-label">BOARDING PASS</div>
            </div>

            {/* Route display */}
            <div className="bp-route-row">
              <div className="bp-city">
                <span className="bp-city-code">
                  {(t.source_planet || 'ERT').slice(0, 3).toUpperCase()}
                </span>
                <span className="bp-city-name">{t.source_planet || '—'}</span>
              </div>
              <div className="bp-route-vis">
                <span className="bp-route-dot" />
                <span className="bp-route-line-seg" />
                <span className="bp-route-line-seg" />
                <span className="bp-route-dot" />
              </div>
              <div className="bp-city bp-city-right">
                <span className="bp-city-code red">
                  {(t.dest_planet || 'MRS').slice(0, 3).toUpperCase()}
                </span>
                <span className="bp-city-name">{t.dest_planet || '—'}</span>
              </div>
            </div>

            {/* Details grid */}
            <div className="bp-details-grid">
              <div className="bp-detail bp-detail-wide">
                <span className="bp-detail-label">PASSENGER</span>
                <span className="bp-detail-value">{t.passenger || t.passenger_name || '—'}</span>
              </div>
              <div className="bp-detail">
                <span className="bp-detail-label">SEAT</span>
                <span className="bp-detail-value bp-seat-highlight">{t.seat_code || '—'}</span>
              </div>
              <div className="bp-detail">
                <span className="bp-detail-label">DEPARTURE DATE</span>
                <span className="bp-detail-value">{formatDateLong(t.journey_date || t.date)}</span>
              </div>
              <div className="bp-detail">
                <span className="bp-detail-label">TICKET NO.</span>
                <span className="bp-detail-value">#{String(t.ticket_id || 0).padStart(5, '0')}</span>
              </div>
              <div className="bp-detail">
                <span className="bp-detail-label">COMMANDER</span>
                <span className="bp-detail-value">{t.commander || '—'}</span>
              </div>
              <div className="bp-detail">
                <span className="bp-detail-label">ASTRONAUT</span>
                <span className="bp-detail-value">{t.astronaut || '—'}</span>
              </div>
            </div>
          </div>

          {/* Perforated tear line */}
          <div className="bp-tear" aria-hidden="true">
            <div className="bp-tear-circle bp-circle-left" />
            <div className="bp-tear-dashes" />
            <div className="bp-tear-circle bp-circle-right" />
          </div>

          {/* Bottom stub */}
          <div className="bp-bottom-stub">
            <div className="bp-qr-section">
              <QrDecoration seed={t.ticket_id || 42} />
              <span className="bp-qr-label">SCAN TO BOARD</span>
            </div>

            <div className="bp-stub-details">
              <div className="bp-stub-row">
                <span className="bp-stub-label">STATUS</span>
                <span className="bp-stub-value bp-status-confirmed">✓ CONFIRMED</span>
              </div>
              <div className="bp-stub-row">
                <span className="bp-stub-label">SPACECRAFT</span>
                <span className="bp-stub-value">{t.craft || 'Starship Ares IX'}</span>
              </div>
              <div className="bp-stub-info">
                <span className="bp-stub-label">Price Paid</span>
                <span className="bp-stub-value">₹{(t.price || 250000).toLocaleString()}</span>
              </div>
            </div>

            <div className="bp-stub-seat-badge">
              <span className="bp-stub-seat-label">SEAT</span>
              <span className="bp-stub-seat-code">{t.seat_code || '—'}</span>
            </div>
          </div>

        </section>
      )}

    </div>
  );
}
