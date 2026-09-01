#include <iostream>
#include <string>
#include <amqp.h>
#include <amqp_tcp_socket.h>
#include <jsoncpp/json/json.h>
#include "DatabaseConnection.h"
// Function to process the RabbitMQ message and save to PostgreSQL
// Function to process the RabbitMQ message and save to PostgreSQL
// Function to process the RabbitMQ message and save to PostgreSQL
void processBooking(const std::string &message)
{
    std::cout << "\n[Worker] 1. Received RabbitMQ payload: " << message << std::endl;

    try
    {
        Json::Value root;
        Json::Reader reader;

        if (!reader.parse(message, root))
        {
            std::cerr << "[Worker] ERROR: Failed to parse JSON." << std::endl;
            return;
        }

        std::cout << "[Worker] 2. JSON Parsed Successfully." << std::endl;

        // Safely extract data with fallbacks so the JSON parser NEVER crashes
        std::string seat = root.isMember("seat_code") ? root["seat_code"].asString() : "UNKNOWN";
        std::string sourceName = root.isMember("source_planet") ? root["source_planet"].asString() : "Earth";
        std::string destName = root.isMember("dest_planet") ? root["dest_planet"].asString() : "Mars";
        std::string passengerName = root.isMember("passenger") ? root["passenger"].asString() : "Anonymous Traveller";
        std::string journeyDate = root.isMember("journey_date") ? root["journey_date"].asString() : "2026-10-15";
        std::string flightId = root.isMember("flight_id") ? root["flight_id"].asString() : "0";

        if (journeyDate.empty())
        {
            journeyDate = "2026-10-15"; // Fallback for the empty string coming from React
        }

        std::cout << "[Worker] 3. Data Extracted. Connecting to PostgreSQL..." << std::endl;

        pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
        pqxx::work W(conn);

        std::cout << "[Worker] 4. Connected! Looking up Planet IDs..." << std::endl;

        std::string qSource = "SELECT planet_id FROM Planets WHERE name = " + W.quote(sourceName) + ";";
        pqxx::result rSource = W.exec(qSource);
        if (rSource.empty())
            throw std::runtime_error("Source planet not found in DB: " + sourceName);
        int sourceId = rSource[0][0].as<int>();

        std::string qDest = "SELECT planet_id FROM Planets WHERE name = " + W.quote(destName) + ";";
        pqxx::result rDest = W.exec(qDest);
        if (rDest.empty())
            throw std::runtime_error("Destination planet not found in DB: " + destName);
        int destId = rDest[0][0].as<int>();

        std::cout << "[Worker] 5. Creating Traveller..." << std::endl;

        std::string qTraveller = "INSERT INTO Travellers (name, role) VALUES (" +
                                 W.quote(passengerName) + ", 'Passenger') RETURNING id;";
        pqxx::result rTraveller = W.exec(qTraveller);
        int travellerId = rTraveller[0][0].as<int>();

        std::cout << "[Worker] 6. Saving Final Ticket..." << std::endl;

        std::string query = "INSERT INTO Tickets (price, date, status, source_planet, dest_planet, traveller_id, seat_number, flight_id) "
                            "VALUES (250000.0, " +
                            W.quote(journeyDate) + ", 'Booked', " +
                            std::to_string(sourceId) + ", " +
                            std::to_string(destId) + ", " +
                            std::to_string(travellerId) + ", " +
                            W.quote(seat) + ", " + W.quote(flightId) + ");";

        W.exec(query);
        W.commit();

        std::cout << "[Worker] 7. SUCCESS! Seat " << seat << " permanently saved to PostgreSQL." << std::endl;
    }
    catch (const std::exception &e)
    {
        // THIS will catch the silent crash and print exactly why it failed!
        std::cerr << "\n[Worker CRASH/ERROR] " << e.what() << std::endl;
    }
    catch (...)
    {
        std::cerr << "\n[Worker CRASH/ERROR] An unknown fatal error occurred!" << std::endl;
    }
}
int main()
{
    std::cout << "--- Space Travel Background Worker Started ---" << std::endl;
    std::cout << "Listening for messages on RabbitMQ 'booking_queue'..." << std::endl;

    // Load Environment Variables for Cloud Deployment
    std::string rmq_host = std::getenv("RABBITMQ_HOST") ? std::getenv("RABBITMQ_HOST") : "localhost";
    int rmq_port = std::getenv("RABBITMQ_PORT") ? std::stoi(std::getenv("RABBITMQ_PORT")) : 5672;
    std::string rmq_user = std::getenv("RABBITMQ_USER") ? std::getenv("RABBITMQ_USER") : "guest";
    std::string rmq_pass = std::getenv("RABBITMQ_PASS") ? std::getenv("RABBITMQ_PASS") : "guest";

    std::cout << "[Worker] Connecting to RabbitMQ at " << rmq_host << ":" << rmq_port << std::endl;

    // 1. Connect to RabbitMQ
    amqp_connection_state_t conn = amqp_new_connection();
    amqp_socket_t *socket = amqp_tcp_socket_new(conn);
    amqp_socket_open(socket, rmq_host.c_str(), rmq_port);
    amqp_login(conn, "/", 0, 131072, 0, AMQP_SASL_METHOD_PLAIN, rmq_user.c_str(), rmq_pass.c_str());
    amqp_channel_open(conn, 1);

    // 2. Ensure the queue exists
    amqp_queue_declare(conn, 1, amqp_cstring_bytes("booking_queue"), 0, 0, 0, 0, amqp_empty_table);
    amqp_basic_consume(conn, 1, amqp_cstring_bytes("booking_queue"), amqp_empty_bytes, 0, 1, 0, amqp_empty_table);

    // 3. Infinite loop to process messages 24/7
    while (true)
    {
        amqp_rpc_reply_t res;
        amqp_envelope_t envelope;

        amqp_maybe_release_buffers(conn);
        res = amqp_consume_message(conn, &envelope, NULL, 0);

        if (res.reply_type == AMQP_RESPONSE_NORMAL)
        {
            std::string messageBody((char *)envelope.message.body.bytes, envelope.message.body.len);

            // Process the message and save to DB
            processBooking(messageBody);

            amqp_destroy_envelope(&envelope);
        }
    }

    amqp_channel_close(conn, 1, AMQP_REPLY_SUCCESS);
    amqp_connection_close(conn, AMQP_REPLY_SUCCESS);
    amqp_destroy_connection(conn);

    return 0;
}