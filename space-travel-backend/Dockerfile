FROM drogonframework/drogon:latest AS builder

# Install necessary libraries for PostgreSQL and RabbitMQ
RUN apt-get update && apt-get install -y \
    libpqxx-dev \
    librabbitmq-dev \
    libjsoncpp-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Build the C++ applications
RUN mkdir build && cd build && \
    cmake .. && \
    make

# --- Final lightweight stage ---
FROM drogonframework/drogon:latest

# We need the shared libraries in the final image too
RUN apt-get update && apt-get install -y \
    libpqxx-dev \
    librabbitmq-dev \
    libjsoncpp-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled executables
COPY --from=builder /app/build/SpaceTravelSystem .
COPY --from=builder /app/build/SpaceTravelWorker .

# Create a startup script that runs BOTH the Worker and the API
RUN echo '#!/bin/bash\n\
echo "Starting SpaceTravelWorker in background..."\n\
./SpaceTravelWorker &\n\
echo "Starting SpaceTravelSystem API..."\n\
./SpaceTravelSystem\n\
' > start.sh && chmod +x start.sh

CMD ["./start.sh"]
