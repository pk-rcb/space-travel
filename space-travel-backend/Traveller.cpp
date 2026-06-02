#include "Traveller.h"
#include "DatabaseConnection.h"
#include <iostream>

// Constructor initializes the object and sets ID to -1 (meaning "not saved yet")
Traveller::Traveller(std::string n, std::string r)
{
    name = n;
    role = r;
    id = -1;
}

// Function to save a traveller directly to PostgreSQL
void saveTravellerToDB(Traveller &t)
{
    try
    {
        pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
        pqxx::work W(conn);

        // Notice the "RETURNING id" at the end!
        std::string query = "INSERT INTO Travellers (name, role) VALUES (" +
                            W.quote(t.name) + ", " +
                            W.quote(t.role) + ") RETURNING id;";

        // Execute the query and capture the result
        pqxx::result R = W.exec(query);
        W.commit();

        // Extract the generated ID from the database response and update the C++ object
        t.id = R[0][0].as<int>();

        std::cout << "Successfully saved " << t.role << " '" << t.name
                  << "' to database! Assigned DB ID: " << t.id << std::endl;
    }
    catch (const std::exception &e)
    {
        std::cerr << "Failed to save traveller: " << e.what() << std::endl;
    }
}