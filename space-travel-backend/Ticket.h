#ifndef TICKET_H
#define TICKET_H

#include <string>

class Ticket
{
public:
    int ticket_id;
    double price;
    std::string date;
    std::string status;

    // Foreign Keys!
    int source_planet_id;
    int dest_planet_id;
    int traveller_id;

    Ticket() {}
    Ticket(double pr, std::string d, int src_id, int dest_id, int trav_id);
};

void saveTicketToDB(Ticket &t);

#endif