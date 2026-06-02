#include "Planet.h"
#include "DatabaseConnection.h"
#include <iostream>

// Constructor simply assigns values. It NO LONGER saves to a static memory map!
Planet::Planet(std::string n, double x1, double y1, double z1)
{
    name = n;
    x = x1;
    y = y1;
    z = z1;
}



// --- REPOSITORY / CRUD FUNCTIONS ---

// Function to save a planet directly to PostgreSQL
void savePlanetToDB(const Planet &p)
{
    try
    {
        // Get the single active database connection
        pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();

        // Create a transactional work object
        pqxx::work W(conn);

        // Construct the SQL INSERT query safely using libpqxx prepared statements
        std::string query = "INSERT INTO Planets (name, x, y, z) VALUES (" +
                            W.quote(p.name) + ", " +
                            W.quote(p.x) + ", " +
                            W.quote(p.y) + ", " +
                            W.quote(p.z) + ") " +
                            "ON CONFLICT (name) DO NOTHING;"; // Prevents crashing if planet already exists

        // Execute the query
        W.exec(query);

        // Commit the transaction to the hard drive
        W.commit();
        std::cout << "Successfully saved planet " << p.name << " to the database!" << std::endl;
    }
    catch (const std::exception &e)
    {
        std::cerr << "Failed to save planet: " << e.what() << std::endl;
    }
}

// The "Read" operation: Fetching an existing planet from the database
Planet getPlanetByName(std::string planetName)
{
    Planet p;
    try
    {
        pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
        pqxx::work W(conn);

        // Execute a SELECT query
        std::string query = "SELECT planet_id, name, x, y, z FROM Planets WHERE name = " + W.quote(planetName) + ";";
        pqxx::result R = W.exec(query);

        if (!R.empty())
        {
            p.id = R[0][0].as<int>();
            p.name = R[0][1].c_str();
            p.x = R[0][2].as<double>();
            p.y = R[0][3].as<double>();
            p.z = R[0][4].as<double>();
        }
        else
        {
            std::cerr << "Planet " << planetName << " not found in database!" << std::endl;
        }
    }
    catch (const std::exception &e)
    {
        std::cerr << "Database fetch error: " << e.what() << std::endl;
    }
    return p;
}