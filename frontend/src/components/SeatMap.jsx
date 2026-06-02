import React, { useState, useCallback, useEffect } from 'react';
import './SeatMap.css';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const TOTAL_SEATS = 20;
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const HOLD_TTL_MINUTES = 5;

// Initialize 20 seats as "available"
function initSeats() {
  return Array.from({ length: TOTAL_SEATS }, (_, i) => ({
    id: i + 1,
    seatCode: `${String.fromCharCode(65 + Math.floor(i / 4))}${(i % 4) + 1}`, // A1…E4
    status: 'available', // 'available' | 'selected' | 'held' | 'booked'
  }));
}

// ─────────────────────────────────────────────────────────────────
// API helpers  (placeholder fetch() calls — wire to Drogon)
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/book
 * Sends booking request to the Drogon C++ API.
 * Drogon will:
 *   1. Try Redis SETNX lock on the seat
 *   2. On success, push JSON to RabbitMQ → Worker → PostgreSQL
 * Returns { ok: boolean, status: number, data: object }
 */
async function apiBookSeat({ seatCode, passengerName, sourcePlanet, destPlanet, price, journeyDate, flightId }) {
  try {
    const response = await fetch(`${API_BASE}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seat_code: seatCode,
        passenger: passengerName || 'Anonymous Traveller',
        source_planet: sourcePlanet,
        dest_planet: destPlanet,
        price: price,
        journey_date: journeyDate,
        flight_id: flightId,
      }),
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    // Network error — backend not reachable
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

/**
 * GET /api/seats
 * Fetches current seat statuses from the backend (optional, for hydration).
 * Stub implementation — expand when backend exposes this endpoint.
 */
async function apiFetchSeats(flightId) {  // eslint-disable-line no-unused-vars
  try {
    const response = await fetch(`${API_BASE}/api/seats?flight=${flightId}`);
    if (response.ok) return await response.json();
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// SeatMap Component
// ─────────────────────────────────────────────────────────────────
export default function SeatMap({ flightInfo, passengerName, journeyDate, onNotification, initialBookedCodes = [] }) {
  const [seats, setSeats] = useState(initSeats);
  const [checkingOut, setCheckingOut] = useState(false); // true while checkout API calls are in-flight
  const [counters, setCounters] = useState({}); // { seatId: secondsLeft }

  // Hydration: apply server-reported booked seats when initialBookedCodes arrives
  useEffect(() => {
    if (!initialBookedCodes.length) return;
    setSeats(prev => prev.map(s =>
      initialBookedCodes.includes(s.seatCode) && s.status === 'available'
        ? { ...s, status: 'booked' }
        : s
    ));
  }, [initialBookedCodes]);

  // Tick countdown for a held seat
  const startCountdown = useCallback((seatId) => {
    const totalSeconds = HOLD_TTL_MINUTES * 60;
    setCounters(prev => ({ ...prev, [seatId]: totalSeconds }));

    const interval = setInterval(() => {
      setCounters(prev => {
        const next = (prev[seatId] ?? 1) - 1;
        if (next <= 0) {
          clearInterval(interval);
          // Release the hold if it was never confirmed (simulated expiry)
          setSeats(s => s.map(seat =>
            seat.id === seatId && seat.status === 'held'
              ? { ...seat, status: 'available' }
              : seat
          ));
          const { [seatId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [seatId]: next };
      });
    }, 1000);
  }, []);

  // Clicking a seat just toggles its "selected" state — no API call yet
  const handleSeatClick = useCallback((seat) => {
    if (seat.status === 'held' || seat.status === 'booked') return;
    if (checkingOut) return;
    setSeats(prev =>
      prev.map(s => {
        if (s.id !== seat.id) return s;
        if (s.status === 'available') return { ...s, status: 'selected' };
        if (s.status === 'selected')  return { ...s, status: 'available' };
        return s;
      })
    );
  }, [checkingOut]);

  // Poll GET /api/booking/status until the server confirms the PostgreSQL write.
  // Only transitions to 'booked' on a real server response — never faked.
  const pollForConfirmation = useCallback((seat) => {
    const POLL_INTERVAL_MS = 3000;
    const MAX_ATTEMPTS = 20; // 20 × 3 s = 60 s max
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const resp = await fetch(
          `${API_BASE}/api/booking/status?seat_code=${encodeURIComponent(seat.seatCode)}`
        );
        if (resp.ok) {
          const data = await resp.json();
          // Server returns { status: "booked" } once the C++ worker commits to PostgreSQL
          if (data.status === 'booked') {
            clearInterval(interval);
            setSeats(prev =>
              prev.map(s =>
                s.id === seat.id && s.status === 'held' ? { ...s, status: 'booked' } : s
              )
            );
            setCounters(prev => { const { [seat.id]: _, ...rest } = prev; return rest; });
            onNotification('success', `Seat ${seat.seatCode} permanently booked in PostgreSQL!`);
          }
          // If server says "held" / "processing" — keep polling silently
        }
      } catch {
        // Network hiccup — keep polling until maxAttempts
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        onNotification('conflict',
          `Seat ${seat.seatCode} is queued but confirmation is taking longer than expected. Please refresh to re-check.`);
      }
    }, POLL_INTERVAL_MS);
  }, [onNotification]);

  // Process a single seat through the booking API pipeline
  const processSeat = useCallback(async (seat) => {
    const result = await apiBookSeat({
      seatCode: seat.seatCode,
      passengerName,
      sourcePlanet: flightInfo.origin,
      destPlanet: flightInfo.destination,
      price: flightInfo.price,
      journeyDate,
      flightId: flightInfo.flightId,
    });

    if (result.ok || result.status === 202) {
      // 202 Accepted — Redis lock acquired, message queued in RabbitMQ.
      // Seat stays HELD (yellow) until the server confirms the PostgreSQL write.
      setSeats(prev =>
        prev.map(s => s.id === seat.id ? { ...s, status: 'held' } : s)
      );
      onNotification('success',
        `Seat ${seat.seatCode} locked! Waiting for server confirmation…`);
      startCountdown(seat.id);
      pollForConfirmation(seat); // polls every 3 s — no fake timer

    } else if (result.status === 409) {
      // 409 Conflict — Redis lock already held by another user
      setSeats(prev =>
        prev.map(s => s.id === seat.id ? { ...s, status: 'available' } : s)
      );
      onNotification('conflict',
        `Seat ${seat.seatCode} is temporarily held by another passenger. Try again in ${HOLD_TTL_MINUTES} min.`);

    } else if (result.status === 0) {
      // Network error — backend unreachable. Do NOT fake a booked state.
      onNotification('error',
        `Cannot reach server. Seat ${seat.seatCode} was NOT locked. Start the Drogon backend and try again.`);

    } else {
      // Generic server error — revert to available
      setSeats(prev =>
        prev.map(s => s.id === seat.id ? { ...s, status: 'available' } : s)
      );
      onNotification('error',
        result.data?.error ?? `Booking failed for seat ${seat.seatCode}. Please try again.`);
    }
  }, [passengerName, flightInfo, journeyDate, onNotification, startCountdown, pollForConfirmation]);

  // Checkout: fire all selected seats through the pipeline sequentially
  const handleCheckout = useCallback(async () => {
    const selected = seats.filter(s => s.status === 'selected');
    if (selected.length === 0) return;

    setCheckingOut(true);
    for (const seat of selected) {
      await processSeat(seat);
    }
    setCheckingOut(false);
  }, [seats, processSeat]);

  // Group seats into rows of 4
  const rows = [];
  for (let i = 0; i < seats.length; i += 4) {
    rows.push(seats.slice(i, i + 4));
  }

  const selectedSeats = seats.filter(s => s.status === 'selected');
  const bookedCount   = seats.filter(s => s.status === 'booked').length;
  const heldCount     = seats.filter(s => s.status === 'held').length;
  const availableCount = seats.filter(s => s.status === 'available').length;
  const totalPrice    = selectedSeats.length * flightInfo.price;

  return (
    <section className="seatmap-section" aria-label="Interactive seat selection">
      <div className="seatmap-container">
        {/* Header */}
        <div className="seatmap-header">
          <div className="seatmap-title-group">
            <h1 className="seatmap-title">Select Your Seat</h1>
            <p className="seatmap-subtitle">
              {flightInfo.origin} → {flightInfo.destination} · {flightInfo.craft}
            </p>
          </div>
          <div className="seatmap-stats">
            <div className="stat-pill stat-available">{availableCount} Available</div>
            <div className="stat-pill stat-selected">{selectedSeats.length} Selected</div>
            <div className="stat-pill stat-held">{heldCount} Held</div>
            <div className="stat-pill stat-booked">{bookedCount} Booked</div>
          </div>
        </div>

        <div className="rocket-vessel">
          {/* Spacecraft nose graphic */}
          <div className="craft-nose" aria-hidden="true">
            <div className="nose-cone"></div>
            <p className="nose-label">FRONT · COCKPIT</p>
          </div>

          {/* Seat grid inside rectangular body */}
          <div className="rocket-body">
            <div className="seatmap-grid" role="list" aria-label="Seat selection grid">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="seat-row" role="group" aria-label={`Row ${row[0].seatCode[0]}`}>
                  <span className="row-label">{row[0].seatCode[0]}</span>

                  {/* Left 2 seats */}
                  <div className="seat-pair">
                    {row.slice(0, 2).map(seat => (
                      <SeatButton
                        key={seat.id}
                        seat={seat}
                        countdown={counters[seat.id]}
                        onClick={handleSeatClick}
                        disabled={checkingOut}
                        price={flightInfo.price}
                      />
                    ))}
                  </div>

                  {/* Aisle */}
                  <div className="seat-aisle" aria-hidden="true">
                    <div className="aisle-line" />
                  </div>

                  {/* Right 2 seats */}
                  <div className="seat-pair">
                    {row.slice(2, 4).map(seat => (
                      <SeatButton
                        key={seat.id}
                        seat={seat}
                        countdown={counters[seat.id]}
                        onClick={handleSeatClick}
                        disabled={checkingOut}
                        price={flightInfo.price}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rear section label */}
          <div className="craft-rear" aria-hidden="true">
            <p className="nose-label">REAR · ENGINE BAY</p>
            <div className="engines">
              <div className="engine">
                <div className="engine-glow"></div>
              </div>
              <div className="engine">
                <div className="engine-glow"></div>
              </div>
              <div className="engine">
                <div className="engine-glow"></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Checkout Panel (slides in when seats are selected) ── */}
        <div className={`checkout-panel ${selectedSeats.length > 0 ? 'checkout-visible' : ''}`}>
          <div className="checkout-summary">
            <div className="checkout-seats">
              {selectedSeats.map(s => (
                <span key={s.id} className="checkout-seat-tag">{s.seatCode}</span>
              ))}
            </div>
            <div className="checkout-total">
              <span className="checkout-total-label">Total</span>
              <span className="checkout-total-price">${totalPrice.toLocaleString()}</span>
            </div>
          </div>
          <button
            id="checkout-btn"
            className={`checkout-btn ${checkingOut ? 'checkout-btn-loading' : ''}`}
            onClick={handleCheckout}
            disabled={checkingOut || selectedSeats.length === 0}
            aria-label="Checkout and book selected seats"
          >
            {checkingOut ? (
              <>
                <span className="checkout-spinner" />
                Acquiring Locks & Queuing…
              </>
            ) : (
              <>
                Checkout · {selectedSeats.length} Seat{selectedSeats.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
          <p className="checkout-hint">
            Clicking Checkout acquires a Redis lock, queues your booking in RabbitMQ, and the C++ worker commits it to PostgreSQL.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Seat Button sub-component
// ─────────────────────────────────────────────────────────────────
function SeatButton({ seat, countdown, onClick, disabled, price }) {
  const statusClass = {
    available: 'seat-available',
    selected:  'seat-selected',
    held:      'seat-held',
    booked:    'seat-booked',
  }[seat.status];

  const isDisabled = seat.status === 'held' || seat.status === 'booked' || disabled;

  const formatCountdown = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const formatPrice = (p) => {
    if (!p) return '$250K';
    if (p >= 1000) return `$${(p / 1000).toFixed(0)}K`;
    return `$${p}`;
  };

  return (
    <button
      id={`seat-${seat.seatCode}`}
      className={`seat-btn ${statusClass}`}
      onClick={() => onClick(seat)}
      disabled={isDisabled}
      aria-label={`Seat ${seat.seatCode} — ${seat.status}`}
      title={
        seat.status === 'booked'   ? `Seat ${seat.seatCode}: Permanently booked` :
        seat.status === 'held'     ? `Seat ${seat.seatCode}: Held — expires in ${formatCountdown(countdown)}` :
        seat.status === 'selected' ? `Seat ${seat.seatCode}: Selected — click to deselect` :
        `Seat ${seat.seatCode}: Click to select`
      }
      role="listitem"
    >
      <span className="seat-icon">
        {seat.status === 'booked'   ? 'X' :
         seat.status === 'held'     ? 'H' :
         seat.status === 'selected' ? '✦'  :
         ''}
      </span>
      <span className="seat-code">{seat.seatCode}</span>
      {seat.status === 'held' && countdown && (
        <span className="seat-timer">{formatCountdown(countdown)}</span>
      )}
      {seat.status === 'available' && (
        <span className="seat-price">{formatPrice(price)}</span>
      )}
      {seat.status === 'selected' && (
        <span className="seat-price selected-price">Selected</span>
      )}
      {seat.status === 'booked' && (
        <span className="seat-confirmed">✓ BOOKED</span>
      )}
    </button>
  );
}

