# Space Travel Platform

A full-stack web application designed to schedule, manage, and book interplanetary space flights. The project features a resilient architecture tailored for high concurrency, ensuring that double-booking of seats does not occur even under heavy load.

## Architecture & Tech Stack

The platform is divided into a modern frontend client and a high-performance C++ backend. 

**Frontend**
* **React & Vite:** Provides a fast, responsive user interface.
* **Vanilla CSS:** Custom styling for a dynamic, space-themed aesthetic (rocket ship seat maps, interactive dashboards).
* **Context API:** Manages global state such as flight schedules and real-time updates.

**Backend**
* **Drogon (C++):** An incredibly fast C++ web framework used to handle API requests with minimal overhead.
* **PostgreSQL:** The primary relational database for persistent storage of flights, tickets, and passenger data.
* **Redis:** Used as a distributed lock mechanism. When a user selects a seat, Redis places a temporary 5-minute hold on it to prevent concurrent users from attempting to book the same seat.
* **RabbitMQ:** An asynchronous message broker. Once a seat is locked in Redis, the booking payload is published to a RabbitMQ queue for processing, preventing backend bottlenecks during traffic spikes.

**Core Workflow:**
1. Admin schedules a flight in the Command Center (stored in PostgreSQL).
2. Passenger selects a seat on the booking interface.
3. Backend checks PostgreSQL to ensure it's not permanently booked, then requests a lock in Redis.
4. If the lock is acquired, the booking request is pushed to RabbitMQ.
5. A background worker (or consumer) eventually dequeues the message and finalizes the booking in PostgreSQL.

## Local Setup

### 1. Prerequisites
Ensure you have the following installed on your system:
* Node.js (v18+)
* PostgreSQL
* Redis Server
* RabbitMQ Server
* C++ Build Tools (CMake, GCC/Clang or MSVC)
* Drogon dependencies: `jsoncpp`, `libpqxx`, `rabbitmq-c`, `redis++`

### 2. Backend Configuration
1. Navigate to the `space-travel-backend` directory.
2. Create a file named `backend_config.json` in the root of the backend folder:
   ```json
   {
     "db_connection": "dbname=space_travel user=postgres password=YOUR_PASSWORD host=localhost port=5432",
     "redis_connection": "tcp://127.0.0.1:6379",
     "rabbitmq_host": "localhost",
     "rabbitmq_port": 5672,
     "rabbitmq_user": "guest",
     "rabbitmq_pass": "guest"
   }
   ```
3. Initialize the database schema in PostgreSQL (tables: Flights, Tickets, Travellers, Planets).
4. Compile the application using CMake:
   ```bash
   mkdir build && cd build
   cmake ..
   make
   ```
5. Run the generated executable. It will listen on `http://0.0.0.0:8080`.

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
