import React, { createContext, useContext, useState, useEffect } from 'react';

const FlightContext = createContext(null);

// Default flight — shown before admin configures anything
const DEFAULT_FLIGHT = {
  date: '',
  sourcePlanet: 'Earth',
  destPlanet: 'Mars',
  commander: '',
  astronaut: '',
  flightId: 'ST-2026-EM-001',
  price: 250000,
  craft: 'Starship Ares IX',
  duration: '75 days',
};

export function FlightProvider({ children }) {
  const [activeFlight, setActiveFlight] = useState(DEFAULT_FLIGHT);
  const [scheduledFlights, setScheduledFlights] = useState([]);

  // Called by AdminView when a journey is submitted
  const scheduleJourney = (flightData) => {
    const flight = { ...DEFAULT_FLIGHT, ...flightData };
    setActiveFlight(flight);
    setScheduledFlights(prev => [flight, ...prev]);
  };

  return (
    <FlightContext.Provider value={{ activeFlight, scheduleJourney, scheduledFlights }}>
      {children}
    </FlightContext.Provider>
  );
}

export function useFlight() {
  const ctx = useContext(FlightContext);
  if (!ctx) throw new Error('useFlight must be used inside <FlightProvider>');
  return ctx;
}
