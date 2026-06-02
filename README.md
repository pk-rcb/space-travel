# StarRoute: Distributed Space Travel Platform

StarRoute is a full-stack, distributed web application originally conceived as an advanced Object-Oriented Programming (OOP) assignment and subsequently scaled into a highly concurrent, production-ready system. It handles the scheduling, booking, and management of commercial interplanetary flights.

The core challenge this platform solves is the **"Thundering Herd"** problem in seat reservations. By leveraging a distributed lock mechanism and asynchronous message queues, the system ensures that high-traffic events (e.g., a flash sale on tickets to Mars) do not result in double-booking or backend server crashes.

## System Architecture & Phased Implementation

The platform was built following a strict five-phase distributed systems approach, decoupling the data layer, the business logic, and the web interface.

### Phase 1: The Foundation (Data Layer & Core OOP)
The original in-memory C++ static vectors were completely stripped out and replaced with a robust relational database.
* **PostgreSQL:** Acts as the single source of truth for all `Planets`, `Travellers`, `Tickets`, and `Flights`.
* **libpqxx & DAOs:** Data Access Objects in C++ handle all SQL transactions, allowing the original OOP classes (`Traveller`, `Astronaut`, `Commander`, `Planet`, `Ticket`) to seamlessly hydrate their state from persistent storage.

### Phase 2 & 3: API Gateway, Caching, and Asynchronous Processing
To protect the database from race conditions and handle massive concurrency, the backend was decoupled into an API Gateway and an asynchronous processing engine.
* **Drogon (C++):** An ultra-fast C++ web framework acts as the HTTP API Gateway, providing REST endpoints for the frontend.
* **Redis Distributed Locking:** When a user clicks to book a seat, Drogon immediately issues a `SETNX` (Set if Not Exists) command in Redis with a 5-minute TTL. This instantly locks the seat. If 100 users click the same seat at the same millisecond, Redis blocks 99 of them, returning an HTTP 409 Conflict.
* **RabbitMQ:** The single successful booking request is pushed to a RabbitMQ message exchange, allowing the Drogon API to immediately return a 202 Accepted response. 
* **Background Worker:** A standalone C++ worker process continuously consumes messages from RabbitMQ, validates the pricing math (`Price = (Distance * K) / Days_Remaining`), and safely commits the final transaction to PostgreSQL without blocking the main web threads.

### Phase 4: Frontend Web Interface
* **React & Vite:** A fast, responsive Single Page Application (SPA).
* **Vanilla CSS:** Features a custom, dynamic space-themed aesthetic. The interface includes interactive, rocket-shaped seat maps, dynamic pricing calculations, and real-time visual feedback for seat statuses (Available, Selected, Held in Redis, Permanently Booked).

## Original OOP Domain Logic (CS253)
The core domain logic adheres to the original CS253 specifications:
* **Travellers:** Implements an inheritance hierarchy (`Traveller` -> `Passenger`, `Astronaut`, `Commander`).
* **Crew Requirements:** Each space travel mission strictly requires one assigned Astronaut and one assigned Commander.
* **Pricing Engine:** Ticket prices are calculated dynamically based on the Euclidean distance between the source and destination planets, divided by the days remaining until departure.

---

## Local Setup & Installation

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
3. Initialize the database schema in PostgreSQL (Tables: `Flights`, `Tickets`, `Travellers`, `Planets`).
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
