# StarRoute: Distributed Space Travel Platform

StarRoute is a full-stack, distributed web application originally conceived as an advanced Object-Oriented Programming (OOP) assignment and subsequently scaled into a highly concurrent, production-ready system. It handles the scheduling, booking, and management of commercial interplanetary flights.

The core challenge this platform solves is the **"Thundering Herd"** problem in seat reservations. By leveraging a distributed lock mechanism and asynchronous message queues, the system ensures that high-traffic events (e.g., a flash sale on tickets to Mars) do not result in double-booking or backend server crashes.

---

## 📁 Project Architecture

```text
space-travel/
├── space-travel-backend/     # Drogon C++ REST API & Workers
│   ├── CMakeLists.txt        # Build system configurations
│   ├── backend_config.json   # Secure DB, Redis, and RabbitMQ configs
│   ├── DatabaseConnection.h  # Singleton PostgreSQL connection manager
│   ├── main.cpp              # API Gateway & Route Definitions
│   ├── Planet.cpp            # OOP Model for Planets 
│   ├── Traveller.cpp         # OOP Hierarchy (Passenger/Astronaut/Commander)
│   ├── Ticket.cpp            # Pricing math & Ticket state management
│   ├── Worker.cpp            # Standalone RabbitMQ background consumer
│   └── .gitignore            # Security configuration for backend secrets
├── frontend/                 # React + Vite Client
│   ├── src/
│   │   ├── assets/           # Images and SVG icons
│   │   ├── components/       # UI Views (AdminView, PassengerView, SeatMap, Kiosk)
│   │   ├── context/          # React Context for Global Flight States
│   │   ├── App.jsx           # Main navigation and app shell
│   │   └── index.css         # Custom space-themed UI styles
│   ├── .env                  # API Base URL configuration
│   └── .gitignore            # Security configuration for frontend secrets
└── README.md                 # Project documentation
```

---

## 🌐 API Gateway & Backend Routes

The Drogon C++ backend exposes a highly optimized REST API. Each endpoint is designed for minimal latency:

* `POST /api/journey/schedule`
  * **Role:** Admin Command Center route. 
  * **Action:** Inserts a new interplanetary flight into PostgreSQL, defining the source, destination, assigned Commander, and Astronaut.
* `GET /api/flights?date=YYYY-MM-DD`
  * **Role:** Flight discovery.
  * **Action:** Queries PostgreSQL to return all available flights for a user's selected departure date.
* `GET /api/seats?flight_id=<ID>`
  * **Role:** Seat hydration.
  * **Action:** Returns an array of seats that have already been permanently booked for a specific flight, preventing the frontend from allowing clicks on unavailable seats.
* `POST /api/book`
  * **Role:** The core transactional route.
  * **Action:** 
    1. Checks PostgreSQL for double-bookings.
    2. Issues a `SETNX` lock in **Redis** with a 5-minute TTL. (Rejects with `409 Conflict` if the seat is held by another user).
    3. Publishes the booking payload to **RabbitMQ**.
    4. Returns a fast `202 Accepted` to the client.
* `GET /api/booking/status?seat_code=<CODE>`
  * **Role:** Polling mechanism.
  * **Action:** The frontend polls this endpoint while the RabbitMQ worker processes the ticket. Returns `processing` or `booked`.
* `GET /api/ticket?date=<DATE>&passenger=<NAME>`
  * **Role:** Digital Kiosk Boarding Pass retrieval.
  * **Action:** Executes a complex `JOIN` across `Tickets`, `Travellers`, `Planets`, and `Flights` to fetch the finalized boarding pass.

---

## 🧩 Core Object-Oriented Programming (OOP) Concepts

The backend domain logic is deeply rooted in C++ Object-Oriented paradigms (originating from an IIT Kanpur CS253 assignment):

1. **Inheritance & Polymorphism:** 
   The system utilizes a class hierarchy where a base `Traveller` class is inherited by specialized `Passenger`, `Astronaut`, and `Commander` subclasses. This allows for role-specific attributes (e.g., an Astronaut's "Years of Experience" or a Commander's "Authority Level") while allowing the system to process them polymorphically as generic `Travellers` during booking.
2. **Encapsulation:** 
   Attributes such as a Planet's 3D spatial coordinates (`x`, `y`, `z`) and a Ticket's pricing calculations are hidden within private members. The mathematical logic (`Price = K * EuclideanDistance / DaysRemaining`) is safely encapsulated inside the `Ticket` class methods.
3. **Singleton Pattern:** 
   The `DatabaseConnection` class is implemented as a Singleton. This ensures that the application maintains a single, thread-safe connection pool to PostgreSQL across all asynchronous HTTP requests, preventing connection exhaustion.

---

## 🚀 System Architecture & Phased Implementation

The platform was built following a strict distributed systems approach, decoupling the data layer, the business logic, and the web interface.

### Phase 1: The Foundation (Data Layer)
The original in-memory C++ static vectors were completely stripped out and replaced with a robust relational database.
* **PostgreSQL:** Acts as the single source of truth.
* **libpqxx & DAOs:** Data Access Objects in C++ handle all SQL transactions, allowing the OOP classes to seamlessly hydrate their state from persistent storage.

### Phase 2 & 3: Asynchronous Engine & API Gateway
To protect the database from race conditions and handle massive concurrency:
* **Drogon (C++):** Acts as the HTTP API Gateway.
* **Redis Distributed Locking:** Used immediately on booking intent to block concurrent requests.
* **RabbitMQ & Background Worker:** A standalone C++ worker process continuously consumes messages from RabbitMQ, validates the pricing math, and safely commits the final transaction to PostgreSQL without blocking the main web threads.

### Phase 4: Frontend Web Interface
* **React & Vite:** A fast, responsive SPA.
* **Vanilla CSS:** Features a custom, dynamic space-themed aesthetic with interactive, rocket-shaped seat maps.

---

## 💻 Local Setup & Installation

### 1. Prerequisites
Ensure you have the following installed and running on your system:
* Node.js (v18+)
* PostgreSQL
* Redis Server
* RabbitMQ Server
* C++ Build Tools (CMake, GCC/Clang or MSVC)
* Drogon dependencies: `jsoncpp`, `libpqxx`, `rabbitmq-c`, `redis++`

### 2. Backend Configuration
1. Navigate to the `space-travel-backend` directory.
2. Create a configuration file named `backend_config.json` in the root of the backend folder to securely store your credentials (this file is git-ignored):
   ```json
   {
     "db_connection": "dbname=space_travel user=postgres password=YOUR_PASSWORD host=localhost port=5432",
     "redis_connection": "tcp://localhost:6379",
     "rabbitmq_host": "localhost",
     "rabbitmq_port": 5672,
     "rabbitmq_user": "guest",
     "rabbitmq_pass": "guest"
   }
   ```
3. Initialize the database schema in PostgreSQL.
4. Compile the application using CMake:
   ```bash
   mkdir build && cd build
   cmake ..
   make
   ```
5. Run the generated executable. The API will listen on `http://0.0.0.0:8080`.

### 3. Frontend Configuration
1. Navigate to the `frontend` directory.
2. Create a `.env` file in the root of the frontend folder:
   ```env
   VITE_API_BASE=http://localhost:8080
   ```
3. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
4. Access the web interface at the local URL provided by Vite.

## License
MIT
