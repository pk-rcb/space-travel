import React, { useState, useEffect } from 'react';
import { useFlight } from '../context/FlightContext';
import SeatMap from './SeatMap';
import './PassengerView.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

// ─────────────────────────────────────────────────────────────────
// API helpers — wire to your Drogon backend
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/seats?date=YYYY-MM-DD
 * Hydrates the seat map with real-time availability for a specific journey date.
 * Expected response: { seats: [{ seat_code: "A1", status: "booked" }, ...] }
 */
async function apiFetchSeats(flightId) {
  try {
    const resp = await fetch(`${API_BASE}/api/seats?flight_id=${encodeURIComponent(flightId)}`);
    if (resp.ok) return await resp.json();
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const PLANET_DISTANCES = {
  Mercury: 57.9,
  Venus: 108.2,
  Earth: 149.6,
  Mars: 227.9,
  Jupiter: 778.5,
  Saturn: 1434.0,
  Uranus: 2871.0,
  Neptune: 4495.0
};

function calculatePrice(src, dst, journeyDate) {
  if (!src || !dst || !journeyDate) return 250000;
  
  const dSrc = PLANET_DISTANCES[src] || 149.6;
  const dDst = PLANET_DISTANCES[dst] || 227.9;
  const distance = Math.abs(dDst - dSrc);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const travelDate = new Date(journeyDate);
  travelDate.setHours(0, 0, 0, 0);
  
  let remainingDays = Math.ceil((travelDate - today) / (1000 * 60 * 60 * 24));
  if (remainingDays <= 0) remainingDays = 1;
  
  const constant = 100000;
  return Math.round((distance * constant) / remainingDays);
}

// ─────────────────────────────────────────────────────────────────
// PassengerView Component
// ─────────────────────────────────────────────────────────────────
export default function PassengerView({ onNotification }) {
  const { scheduledFlights } = useFlight();

  const [journeyDate, setJourneyDate]           = useState('');
  const [passengerName, setPassengerName]       = useState('');
  const [initialBookedCodes, setInitialBookedCodes] = useState([]);
  const [hydrateStatus, setHydrateStatus]       = useState('idle'); // 'idle'|'loading'|'ok'|'error'

  const [availableFlights, setAvailableFlights] = useState([]);
  const [selectedFlight, setSelectedFlight]     = useState(null);

  // When date changes, fetch available flights from backend
  useEffect(() => {
    setSelectedFlight(null);
    setInitialBookedCodes([]);
    setHydrateStatus('idle');
    setAvailableFlights([]);

    if (!journeyDate) return;

    fetch(`${API_BASE}/api/flights?date=${encodeURIComponent(journeyDate)}`)
      .then(res => res.json())
      .then(flights => {
        const flightsArray = Array.isArray(flights) ? flights : [];
        setAvailableFlights(flightsArray);
        if (flightsArray.length === 1) {
          setSelectedFlight(flightsArray[0]);
        }
      })
      .catch(err => console.error("Failed to fetch flights", err));
  }, [journeyDate]);

  // When a flight is selected, poll seat data every 8s
  useEffect(() => {
    if (!selectedFlight) {
      setInitialBookedCodes([]);
      setHydrateStatus('idle');
      return;
    }

    setHydrateStatus('loading');

    const fetchSeats = () => {
      apiFetchSeats(selectedFlight.flight_id).then(data => {
        if (!data) {
          setHydrateStatus('error');
          return;
        }
        const booked = Array.isArray(data) ? data : [];
        setInitialBookedCodes(booked);
        setHydrateStatus('ok');
      });
    };

    fetchSeats();
    const intervalId = setInterval(fetchSeats, 8000);
    
    return () => clearInterval(intervalId);
  }, [selectedFlight]);

  const openDatePicker = () => {
    document.getElementById('pv-date')?.showPicker?.();
    document.getElementById('pv-date')?.focus();
  };

  // Build flightInfo from the matched scheduled flight
  const src = selectedFlight?.origin || 'Earth';
  const dst = selectedFlight?.destination || 'Mars';
  const flightInfo = selectedFlight ? {
    flightId:        selectedFlight.flight_id || '0',
    origin:          src,
    originCode:      src.slice(0, 3).toUpperCase(),
    destination:     dst,
    destinationCode: dst.slice(0, 3).toUpperCase(),
    departure:       `${formatDate(journeyDate)} · 09:00 UTC`,
    duration:        selectedFlight.duration || '75 days',
    craft:           selectedFlight.craft    || 'Starship Ares IX',
    price:           calculatePrice(src, dst, journeyDate),
  } : null;

  return (
    <div className="passenger-view">

      {/* ── Date picker (always shown first) ── */}
      <section className="passenger-section">
        <div className="passenger-row">
          <div className="passenger-field">
            <label className="passenger-label" htmlFor="pv-passenger-name">Passenger Name</label>
            <input
              id="pv-passenger-name"
              className="passenger-input"
              type="text"
              placeholder="Full name as on your space passport…"
              value={passengerName}
              onChange={e => setPassengerName(e.target.value)}
            />
          </div>
          <div className="passenger-field date-field">
            <label className="passenger-label" htmlFor="pv-date">Journey Date</label>
            <div className="date-input-wrapper">
              <input
                id="pv-date"
                className="passenger-input date-input-hidden"
                type="date"
                min={getTomorrow()}
                value={journeyDate}
                onChange={e => setJourneyDate(e.target.value)}
              />
              <div className="date-display" onClick={openDatePicker}>
                <span className="date-display-text">
                  {journeyDate ? formatDate(journeyDate) : 'Select departure date…'}
                </span>
                <button
                  id="pv-calendar-btn"
                  type="button"
                  className="calendar-btn"
                  onClick={e => { e.stopPropagation(); openDatePicker(); }}
                  aria-label="Open calendar"
                >Pick Date</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── No date selected yet ── */}
      {!journeyDate && (
        <div className="no-flight-card">
          <p className="no-flight-title">Select a departure date</p>
          <p className="no-flight-sub">Choose a date above to see available flights.</p>
        </div>
      )}

      {/* ── Date chosen but no flight scheduled ── */}
      {journeyDate && availableFlights.length === 0 && (
        <div className="no-flight-card no-flight-empty">
          <p className="no-flight-title">No flight scheduled on {formatDate(journeyDate)}</p>
          <p className="no-flight-sub">
            Head to the <strong>Command Center</strong> (Admin tab) and schedule a journey for this date first.
          </p>
        </div>
      )}

      {/* ── Multiple flights available — select one ── */}
      {journeyDate && availableFlights.length > 1 && !selectedFlight && (
        <div className="passenger-flight-selector">
          <h2>Select a Flight for {formatDate(journeyDate)}</h2>
          <div className="flight-list">
            {availableFlights.map(flight => (
              <button 
                key={flight.flight_id} 
                className="flight-list-item"
                onClick={() => setSelectedFlight(flight)}
              >
                <div className="fli-route">{flight.origin} ➔ {flight.destination}</div>
                <div className="fli-crew">Crew: {flight.commander} & {flight.astronaut}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Flight found — show everything ── */}
      {journeyDate && selectedFlight && (
        <>
          {/* Flight Actions */}
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
            <button className="calendar-btn" onClick={() => setSelectedFlight(null)}>
              ← Change Flight
            </button>
          </div>

          {/* Crew Banner */}
          {(selectedFlight.commander || selectedFlight.astronaut) && (
            <div className="crew-banner" role="complementary" aria-label="Flight crew">
              <div className="crew-banner-inner">
                <div className="crew-member">
                  <div>
                    <span className="crew-role">Commander</span>
                    <span className="crew-name">{selectedFlight.commander || '—'}</span>
                  </div>
                </div>
                <div className="crew-divider" aria-hidden="true" />
                <div className="crew-member">
                  <div>
                    <span className="crew-role">Astronaut</span>
                    <span className="crew-name">{selectedFlight.astronaut || '—'}</span>
                  </div>
                </div>
                <div className="crew-divider" aria-hidden="true" />
                <div className="crew-member">
                  <div>
                    <span className="crew-role">Route</span>
                    <span className="crew-name">{src} → {dst}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flight card */}
          <section className="flight-card" aria-label="Flight details">
            <div className="flight-card-inner">
              <div className="flight-route">
                <div className="route-point">
                  <span className="route-code">{flightInfo.originCode}</span>
                  <span className="route-name">{flightInfo.origin}</span>
                  <span className="route-time">{flightInfo.departure}</span>
                </div>
                <div className="route-middle">
                  <div className="route-line">
                    <div className="route-dot" />
                    <div className="route-dashes" />
                    <div className="route-dashes" />
                    <div className="route-dot" />
                  </div>
                  <span className="route-duration">{flightInfo.duration}</span>
                </div>
                <div className="route-point route-right">
                  <span className="route-code red">{flightInfo.destinationCode}</span>
                  <span className="route-name">{flightInfo.destination}</span>
                </div>
              </div>
              <div className="flight-meta">
                <div className="meta-item">
                  <span className="meta-label">Flight</span>
                  <span className="meta-value">{flightInfo.flightId}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Spacecraft</span>
                  <span className="meta-value">{flightInfo.craft}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Ticket Price</span>
                  <span className="meta-value price">₹{flightInfo.price.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Hydration status strip */}
          {hydrateStatus === 'loading' && (
            <div className="hydrate-strip hydrate-loading">
              <span className="hydrate-spinner" aria-hidden="true" />
              Fetching live seat availability from server…
            </div>
          )}
          {hydrateStatus === 'error' && (
            <div className="hydrate-strip hydrate-error">
              [Warning] Could not reach server — showing default seat map.
            </div>
          )}
          {hydrateStatus === 'ok' && initialBookedCodes.length > 0 && (
            <div className="hydrate-strip hydrate-ok">
              [Success] Live data loaded — {initialBookedCodes.length} seat{initialBookedCodes.length !== 1 ? 's' : ''} already booked.
            </div>
          )}
          {hydrateStatus === 'ok' && initialBookedCodes.length === 0 && (
            <div className="hydrate-strip hydrate-ok">
              [Success] All 20 seats available for this journey.
            </div>
          )}

          {/* Seat Map */}
          <SeatMap
            flightInfo={flightInfo}
            passengerName={passengerName}
            journeyDate={journeyDate}
            onNotification={onNotification}
            initialBookedCodes={initialBookedCodes}
          />

          {/* Legend */}
          <section className="legend" aria-label="Seat status legend">
            <div className="legend-item">
              <div className="legend-swatch swatch-available" />
              <div>
                <span className="legend-title">Available</span>
                <span className="legend-sub">No lock · Click to select</span>
              </div>
            </div>
            <div className="legend-item">
              <div className="legend-swatch swatch-selected" />
              <div>
                <span className="legend-title">Selected</span>
                <span className="legend-sub">In cart · Checkout to lock</span>
              </div>
            </div>
            <div className="legend-item">
              <div className="legend-swatch swatch-held" />
              <div>
                <span className="legend-title">Held</span>
                <span className="legend-sub">Redis lock · 5 min TTL</span>
              </div>
            </div>
            <div className="legend-item">
              <div className="legend-swatch swatch-booked" />
              <div>
                <span className="legend-title">Booked</span>
                <span className="legend-sub">Confirmed in PostgreSQL</span>
              </div>
            </div>
          </section>
        </>
      )}

    </div>
  );
}
