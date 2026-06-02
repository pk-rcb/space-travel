CREATE TABLE Planets (
    planet_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    z FLOAT NOT NULL
);
CREATE TABLE Travellers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('Passenger', 'Astronaut', 'Commander'))
);
CREATE TABLE Tickets (
    ticket_id SERIAL PRIMARY KEY,
    price FLOAT NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,

    source_planet INT NOT NULL,
    dest_planet INT NOT NULL,
    traveller_id INT NOT NULL,

    FOREIGN KEY (source_planet)
        REFERENCES Planets(planet_id),

    FOREIGN KEY (dest_planet)
        REFERENCES Planets(planet_id),

    FOREIGN KEY (traveller_id)
        REFERENCES Travellers(id)
);
CREATE TABLE SpaceTravels (
    travel_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,

    source_planet INT NOT NULL,
    dest_planet INT NOT NULL,

    astro_id INT NOT NULL,
    commander_id INT NOT NULL,

    FOREIGN KEY (source_planet)
        REFERENCES Planets(planet_id),

    FOREIGN KEY (dest_planet)
        REFERENCES Planets(planet_id),

    FOREIGN KEY (astro_id)
        REFERENCES Travellers(id),

    FOREIGN KEY (commander_id)
        REFERENCES Travellers(id)
);

CREATE TABLE Travel_Manifest (
    id SERIAL PRIMARY KEY,

    travel_id INT NOT NULL,
    ticket_id INT NOT NULL,

    FOREIGN KEY (travel_id)
        REFERENCES SpaceTravels(travel_id),

    FOREIGN KEY (ticket_id)
        REFERENCES Tickets(ticket_id)
);