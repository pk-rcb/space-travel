# Require a minimum version of CMake
cmake_minimum_required(VERSION 3.10)
project(SpaceTravelSystem)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)
# Name your project
project(SpaceTravelSystem)

# Set the C++ standard to C++17 (Modern C++)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Find the PostgreSQL library on your system
find_package(PostgreSQL REQUIRED)

# Find libpqxx (The C++ wrapper for PostgreSQL)
find_path(PQXX_INCLUDE_DIR pqxx/pqxx)
find_library(PQXX_LIBRARY pqxx)
find_package(Drogon CONFIG REQUIRED)

# Include your source files
# Include your source files
# Include your source files
set(SOURCES 
    main.cpp 
    DatabaseConnection.cpp
    Planet.cpp
    Traveller.cpp
    Ticket.cpp   # <--- Make sure this line is here!
)


# --- Executable 1: The Main Application ---
# Notice this list has main.cpp, but NOT Worker.cpp
set(MAIN_SOURCES main.cpp DatabaseConnection.cpp Planet.cpp Traveller.cpp Ticket.cpp)
add_executable(SpaceTravelSystem ${MAIN_SOURCES})
target_include_directories(SpaceTravelSystem PRIVATE ${PostgreSQL_INCLUDE_DIRS} ${PQXX_INCLUDE_DIR})
target_link_libraries(SpaceTravelSystem ${PostgreSQL_LIBRARIES} ${PQXX_LIBRARY})
# ADD 'rabbitmq' TO THE END OF THIS LINE:
target_link_libraries(SpaceTravelSystem ${PostgreSQL_LIBRARIES} ${PQXX_LIBRARY} rabbitmq)
# <-- ADD drogon::drogon TO THIS LINE:
target_link_libraries(SpaceTravelSystem ${PostgreSQL_LIBRARIES} ${PQXX_LIBRARY} rabbitmq Drogon::Drogon redis++ hiredis)

# --- Executable 2: The Background Worker ---
# Notice this list has Worker.cpp, but NOT main.cpp
set(WORKER_SOURCES Worker.cpp DatabaseConnection.cpp)
add_executable(SpaceTravelWorker ${WORKER_SOURCES})
target_include_directories(SpaceTravelWorker PRIVATE ${PostgreSQL_INCLUDE_DIRS} ${PQXX_INCLUDE_DIR})
target_link_libraries(SpaceTravelWorker ${PostgreSQL_LIBRARIES} ${PQXX_LIBRARY} rabbitmq jsoncpp)