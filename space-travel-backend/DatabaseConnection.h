#ifndef DATABASE_CONNECTION_H
#define DATABASE_CONNECTION_H

#include <iostream>
#include <pqxx/pqxx>
#include <string>
#include <memory>

class DatabaseConnection
{
private:
    std::unique_ptr<pqxx::connection> conn;
    DatabaseConnection(); // Private constructor

public:
    // Delete copy constructor and assignment operator for Singleton
    DatabaseConnection(const DatabaseConnection &) = delete;
    void operator=(const DatabaseConnection &) = delete;

    static DatabaseConnection &getInstance();
    pqxx::connection &getConnection();
};

#endif