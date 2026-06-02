#include "DatabaseConnection.h"
#include <iostream>
#include <stdexcept>
#include <memory> // CRITICAL: This is required for std::make_unique to work!

#include <fstream>
#include <jsoncpp/json/json.h>

DatabaseConnection::DatabaseConnection()
{
    try
    {
        std::ifstream file("backend_config.json");
        std::string connStr = "dbname=space_travel user=postgres host=localhost port=5432"; // Safe fallback
        if (file.is_open()) {
            Json::Value config;
            file >> config;
            if (config.isMember("db_connection")) {
                connStr = config["db_connection"].asString();
            }
        } else {
            std::cerr << "Warning: backend_config.json not found!" << std::endl;
        }

        // FIX: Using std::make_unique because 'conn' is a smart pointer!
        conn = std::make_unique<pqxx::connection>(connStr);

        if (conn->is_open())
        {
            std::cout << "Successfully connected to the Space Travel Database!" << std::endl;
        }
        else
        {
            std::cerr << "Failed to open the database connection." << std::endl;
            conn = nullptr;
        }
    }
    catch (const std::exception &e)
    {
        std::cerr << "Database Connection Error: " << e.what() << std::endl;
        conn = nullptr;
    }
}

DatabaseConnection &DatabaseConnection::getInstance()
{
    static DatabaseConnection instance;
    return instance;
}

pqxx::connection &DatabaseConnection::getConnection()
{
    // The Segmentation Fault Shield
    if (conn == nullptr || !conn->is_open())
    {
        throw std::runtime_error("FATAL: Database pointer is null! Your Windows IP address likely changed again.");
    }

    return *conn;
}