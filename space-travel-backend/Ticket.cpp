#include "Ticket.h"
#include "DatabaseConnection.h"
#include <iostream>

Ticket::Ticket(double pr, std::string d, int src_id, int dest_id, int trav_id)
{
    price = pr;
    date = d;
    status = "Booked"; // Default status
    source_planet_id = src_id;
    dest_planet_id = dest_id;
    traveller_id = trav_id;
    ticket_id = -1;
}

void saveTicketToDB(Ticket &t)
{
    try
    {
        pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
        pqxx::work W(conn);

        // Insert into Tickets with all Foreign Keys and RETURN the new ticket_id
        std::string query = "INSERT INTO Tickets (price, date, status, source_planet, dest_planet, traveller_id) VALUES (" +
                            W.quote(t.price) + ", " +
                            W.quote(t.date) + ", " +
                            W.quote(t.status) + ", " +
                            W.quote(t.source_planet_id) + ", " +
                            W.quote(t.dest_planet_id) + ", " +
                            W.quote(t.traveller_id) + ") RETURNING ticket_id;";

        pqxx::result R = W.exec(query);
        W.commit();

        t.ticket_id = R[0][0].as<int>();

        std::cout << "SUCCESS! Ticket booked permanently. Ticket DB ID: " << t.ticket_id << std::endl;
    }
    catch (const std::exception &e)
    {
        std::cerr << "Failed to book ticket: " << e.what() << std::endl;
    }
}