FROM drogonframework/drogon:latest AS builder

# Install necessary libraries for PostgreSQL and RabbitMQ
RUN apt-get update && apt-get install -y \
    libpqxx-dev \
    librabbitmq-dev \
    libjsoncpp-dev \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install hiredis from source with SSL support
RUN git clone https://github.com/redis/hiredis.git /tmp/hiredis && \
    cd /tmp/hiredis && \
    make USE_SSL=1 && \
    make PREFIX=/usr/local install && \
    ldconfig

# Install redis-plus-plus from source with TLS enabled (Needed for Upstash)
RUN git clone https://github.com/sewenew/redis-plus-plus.git /tmp/redis-plus-plus && \
    cd /tmp/redis-plus-plus && \
    mkdir build && cd build && \
    cmake -DREDIS_PLUS_PLUS_CXX_STANDARD=17 -DREDIS_PLUS_PLUS_USE_TLS=ON .. && \
    make && \
    make install && \
    ldconfig

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
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled executables
COPY --from=builder /app/build/SpaceTravelSystem .
COPY --from=builder /app/build/SpaceTravelWorker .

# Copy redis-plus-plus and hiredis libraries from builder stage
COPY --from=builder /usr/local/lib/libredis++.so* /usr/local/lib/
COPY --from=builder /usr/local/lib/libhiredis*.so* /usr/local/lib/
RUN ldconfig

# Create a startup script that runs BOTH the Worker and the API
RUN echo '#!/bin/bash\n\
echo "Starting SpaceTravelWorker in background..."\n\
./SpaceTravelWorker &\n\
echo "Starting SpaceTravelSystem API..."\n\
./SpaceTravelSystem\n\
' > start.sh && chmod +x start.sh

CMD ["./start.sh"]

