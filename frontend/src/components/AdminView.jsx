import React, { useState } from 'react';
import { useFlight } from '../context/FlightContext';
import './AdminView.css';

const PLANETS = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

// ─────────────────────────────────────────────────────────────────
// API helper — wire to your Drogon backend
// POST /api/journey/schedule
// ─────────────────────────────────────────────────────────────────
async function apiScheduleJourney(payload) {
  try {
    const resp = await fetch(`${API_BASE}/api/journey/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function AdminView({ onScheduled }) {
  const { scheduleJourney, scheduledFlights } = useFlight();

  const [form, setForm] = useState({
    date: '',
    sourcePlanet: 'Earth',
    destPlanet: 'Mars',
    commander: '',
    astronaut: '',
  });
  const [submitState, setSubmitState] = useState('idle'); // 'idle'|'loading'|'success'|'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [existingFlights, setExistingFlights] = useState([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);

  const handleEditChange = (e) => {
    setEditingFlight(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submitEdit = async () => {
    if (!editingFlight || !editingFlight.commander.trim() || !editingFlight.astronaut.trim()) return;
    
    try {
      await fetch(`${API_BASE}/api/journey/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFlight),
      });
    } catch(err) {
      console.error(err);
    }

    setEditingFlight(null);
    setLoadingFlights(true);
    fetch(`${API_BASE}/api/flights?date=${encodeURIComponent(form.date)}`)
      .then(res => res.json())
      .then(data => setExistingFlights(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error fetching flights:", err))
      .finally(() => setLoadingFlights(false));
  };

  React.useEffect(() => {
    if (!form.date) {
      setExistingFlights([]);
      return;
    }
    setLoadingFlights(true);
    fetch(`${API_BASE}/api/flights?date=${encodeURIComponent(form.date)}`)
      .then(res => res.json())
      .then(data => {
        setExistingFlights(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error("Error fetching flights:", err))
      .finally(() => setLoadingFlights(false));
  }, [form.date]);

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.commander.trim() || !form.astronaut.trim()) {
      setErrorMsg('Please fill in all fields.');
      setSubmitState('error');
      return;
    }
    if (form.sourcePlanet === form.destPlanet) {
      setErrorMsg('Source and destination planets must be different.');
      setSubmitState('error');
      return;
    }

    setSubmitState('loading');
    setErrorMsg('');

    // Save to global context immediately (works even if backend is offline)
    scheduleJourney(form);

    // Attempt to persist on backend
    await apiScheduleJourney(form);

    // Refetch existing flights to include the new one
    try {
      const res = await fetch(`${API_BASE}/api/flights?date=${encodeURIComponent(form.date)}`);
      const data = await res.json();
      setExistingFlights(Array.isArray(data) ? data : []);
    } catch(err) {
      console.error(err);
    }

    setSubmitState('success');
  };

  return (
    <div className="admin-view">
      {/* Page header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Mission Command Center</h1>
          <p className="admin-page-sub">Schedule and activate interplanetary journeys</p>
        </div>
      </div>

      <div className="admin-layout">

        {/* ─── Schedule Form ─── */}
        <section className="admin-card" aria-label="Schedule new journey">
          <div className="admin-card-header">
            <h2 className="admin-card-title">Schedule New Journey</h2>
          </div>

          <form onSubmit={handleSubmit} className="admin-form" noValidate>

            {/* Journey Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-journey-date">Journey Date</label>
              <input
                id="admin-journey-date"
                name="date"
                type="date"
                className="form-input"
                min={getTomorrow()}
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>

            {/* Planet row */}
            <div className="form-planet-row">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-source-planet">Source Planet</label>
                <div className="form-select-wrap">
                  <select
                    id="admin-source-planet"
                    name="sourcePlanet"
                    className="form-select"
                    value={form.sourcePlanet}
                    onChange={handleChange}
                  >
                    {PLANETS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <span className="select-chevron">▾</span>
                </div>
              </div>

              <div className="planet-row-arrow">→</div>

              <div className="form-group">
                <label className="form-label" htmlFor="admin-dest-planet">Destination Planet</label>
                <div className="form-select-wrap">
                  <select
                    id="admin-dest-planet"
                    name="destPlanet"
                    className="form-select"
                    value={form.destPlanet}
                    onChange={handleChange}
                  >
                    {PLANETS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <span className="select-chevron">▾</span>
                </div>
              </div>
            </div>

            {/* Crew row */}
            <div className="form-crew-row">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-commander">Assigned Commander</label>
                <input
                  id="admin-commander"
                  name="commander"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cmdr. Ramesh"
                  value={form.commander}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-astronaut">Assigned Astronaut</label>
                <input
                  id="admin-astronaut"
                  name="astronaut"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Lt. Priya"
                  value={form.astronaut}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Status messages */}
            {submitState === 'error' && (
              <div className="form-msg form-msg-error">[Error] {errorMsg}</div>
            )}
            {submitState === 'success' && (
              <div className="form-msg form-msg-success">
                [Success] Journey activated! The Booking Terminal is now live.
              </div>
            )}

            {/* Submit */}
            <button
              id="activate-journey-btn"
              type="submit"
              className={`form-submit-btn ${submitState === 'loading' ? 'btn-loading' : ''}`}
              disabled={submitState === 'loading'}
            >
              {submitState === 'loading'
                ? <><span className="btn-spinner" /> Activating…</>
                : <>Activate Journey</>}
            </button>

            {/* Quick-navigate to booking after success */}
            {submitState === 'success' && (
              <button
                id="go-booking-btn"
                type="button"
                className="form-link-btn"
                onClick={onScheduled}
              >
                Open Booking Terminal →
              </button>
            )}
          </form>
        </section>

        {/* ─── Scheduled Flights Sidebar ─── */}
        <section className="admin-card admin-card-alt" aria-label="Scheduled journeys">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              {form.date ? `Flights on ${form.date}` : "Scheduled Journeys"}
            </h2>
          </div>

          {!form.date ? (
            <div className="admin-empty">
              <p>Select a date to view existing flights.</p>
            </div>
          ) : loadingFlights ? (
            <div className="admin-empty">
              <span className="btn-spinner" style={{borderColor: "rgba(124, 77, 255, 0.3)", borderTopColor: "#7c4dff"}} />
              <p>Loading...</p>
            </div>
          ) : existingFlights.length === 0 ? (
            <div className="admin-empty">
              <p>No flights scheduled on this date yet. Use the form to activate a mission.</p>
            </div>
          ) : (
            <ul className="scheduled-list" role="list">
              {existingFlights.map((f, i) => (
                <li key={f.flight_id || i} className="scheduled-item">
                  <div className="scheduled-route">
                    <span className="scheduled-planet-name">{f.origin}</span>
                    <span className="scheduled-arrow-icon">→</span>
                    <span className="scheduled-planet-name">{f.destination}</span>
                  </div>
                  
                  {editingFlight && editingFlight.flight_id === f.flight_id ? (
                    <div className="edit-flight-form" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        name="commander" 
                        value={editingFlight.commander} 
                        onChange={handleEditChange} 
                        className="form-input" 
                        style={{ padding: '0.4rem' }} 
                        placeholder="Commander" 
                      />
                      <input 
                        type="text" 
                        name="astronaut" 
                        value={editingFlight.astronaut} 
                        onChange={handleEditChange} 
                        className="form-input" 
                        style={{ padding: '0.4rem' }} 
                        placeholder="Astronaut" 
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={submitEdit} className="form-submit-btn" style={{ padding: '0.4rem', fontSize: '0.8rem' }}>Save</button>
                        <button type="button" onClick={() => setEditingFlight(null)} className="form-link-btn" style={{ padding: '0.4rem', fontSize: '0.8rem' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="scheduled-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>Date: {f.date || 'No date'}</span>
                        <span>Cmdr: {f.commander || '—'}</span>
                        <span>Astro: {f.astronaut || '—'}</span>
                      </div>
                      <button 
                        type="button" 
                        className="form-link-btn" 
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => setEditingFlight(f)}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}
