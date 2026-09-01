#include <iostream>
#include <string>
#include <amqp.h>
#include <amqp_tcp_socket.h>
#include <drogon/drogon.h>
#include <drogon/HttpResponse.h>
#include <jsoncpp/json/json.h>
#include <sw/redis++/redis++.h>
#include "DatabaseConnection.h"
#include <openssl/hmac.h>
#include <drogon/HttpClient.h>
#include <iomanip>
#include <sstream>

using namespace sw::redis;

#include <fstream>

struct AppConfig {
    std::string rabbitmq_host = "localhost";
    int rabbitmq_port = 5672;
    std::string rabbitmq_user = "guest";
    std::string rabbitmq_pass = "guest";
    std::string redis_connection = "tcp://localhost:6379";
    std::string razorpay_key_id = "";
    std::string razorpay_key_secret = "";
    int port = 8080;
};

AppConfig globalConfig;

void loadConfig() {
    // 1. Load from local JSON (if it exists)
    std::ifstream file("backend_config.json");
    if (file.is_open()) {
        Json::Value config;
        file >> config;
        if (config.isMember("rabbitmq_host")) globalConfig.rabbitmq_host = config["rabbitmq_host"].asString();
        if (config.isMember("rabbitmq_port")) globalConfig.rabbitmq_port = config["rabbitmq_port"].asInt();
        if (config.isMember("rabbitmq_user")) globalConfig.rabbitmq_user = config["rabbitmq_user"].asString();
        if (config.isMember("rabbitmq_pass")) globalConfig.rabbitmq_pass = config["rabbitmq_pass"].asString();
        if (config.isMember("redis_connection")) globalConfig.redis_connection = config["redis_connection"].asString();
        if (config.isMember("razorpay_key_id")) globalConfig.razorpay_key_id = config["razorpay_key_id"].asString();
        if (config.isMember("razorpay_key_secret")) globalConfig.razorpay_key_secret = config["razorpay_key_secret"].asString();
        if (config.isMember("port")) globalConfig.port = config["port"].asInt();
    }

    // 2. Override with Environment Variables (Cloud Native)
    if (std::getenv("RABBITMQ_HOST")) globalConfig.rabbitmq_host = std::getenv("RABBITMQ_HOST");
    if (std::getenv("RABBITMQ_PORT")) globalConfig.rabbitmq_port = std::stoi(std::getenv("RABBITMQ_PORT"));
    if (std::getenv("RABBITMQ_USER")) globalConfig.rabbitmq_user = std::getenv("RABBITMQ_USER");
    if (std::getenv("RABBITMQ_PASS")) globalConfig.rabbitmq_pass = std::getenv("RABBITMQ_PASS");
    if (std::getenv("REDIS_URL")) globalConfig.redis_connection = std::getenv("REDIS_URL");
    if (std::getenv("RAZORPAY_KEY_ID")) globalConfig.razorpay_key_id = std::getenv("RAZORPAY_KEY_ID");
    if (std::getenv("RAZORPAY_KEY_SECRET")) globalConfig.razorpay_key_secret = std::getenv("RAZORPAY_KEY_SECRET");
    if (std::getenv("PORT")) globalConfig.port = std::stoi(std::getenv("PORT"));
}


// RabbitMQ Message Publisher
void publishMessageToQueue(const std::string &message)
{
    std::cout << "[RabbitMQ] Connecting to " << globalConfig.rabbitmq_host << ":" << globalConfig.rabbitmq_port << "..." << std::endl;
    amqp_connection_state_t conn = amqp_new_connection();
    amqp_socket_t *socket = amqp_tcp_socket_new(conn);
    if (!socket) {
        std::cerr << "[RabbitMQ] amqp_tcp_socket_new failed" << std::endl;
        return;
    }
    int status = amqp_socket_open(socket, globalConfig.rabbitmq_host.c_str(), globalConfig.rabbitmq_port);
    if (status != 0) {
        std::cerr << "[RabbitMQ] amqp_socket_open failed: " << status << std::endl;
        return;
    }
    amqp_rpc_reply_t login_reply = amqp_login(conn, "/", 0, 131072, 0, AMQP_SASL_METHOD_PLAIN, globalConfig.rabbitmq_user.c_str(), globalConfig.rabbitmq_pass.c_str());
    if (login_reply.reply_type != AMQP_RESPONSE_NORMAL) {
        std::cerr << "[RabbitMQ] amqp_login failed" << std::endl;
        return;
    }
    amqp_channel_open(conn, 1);
    amqp_rpc_reply_t channel_reply = amqp_get_rpc_reply(conn);
    if (channel_reply.reply_type != AMQP_RESPONSE_NORMAL) {
        std::cerr << "[RabbitMQ] amqp_channel_open failed" << std::endl;
        return;
    }

    amqp_bytes_t message_bytes;
    message_bytes.len = message.length();
    message_bytes.bytes = (void *)message.c_str();

    // Declare queue to ensure it exists before publishing!
    amqp_queue_declare(conn, 1, amqp_cstring_bytes("booking_queue"), 0, 0, 0, 0, amqp_empty_table);

    int pub_status = amqp_basic_publish(conn, 1, amqp_cstring_bytes(""), amqp_cstring_bytes("booking_queue"), 0, 0, NULL, message_bytes);
    if (pub_status != AMQP_STATUS_OK) {
        std::cerr << "[RabbitMQ] amqp_basic_publish failed: " << pub_status << std::endl;
    } else {
        std::cout << "[RabbitMQ] Message successfully published!" << std::endl;
    }

    amqp_channel_close(conn, 1, AMQP_REPLY_SUCCESS);
    amqp_connection_close(conn, AMQP_REPLY_SUCCESS);
    amqp_destroy_connection(conn);
}

// Helper to quickly create OPTIONS handlers for CORS Preflight
void registerOptionsHandler(const std::string &path)
{
    drogon::app().registerHandler(
        path,
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            auto resp = drogon::HttpResponse::newHttpResponse();
            callback(resp);
        },
        {drogon::Options});
}

int main()
{
    loadConfig();
    std::cout << "--- Space Travel Web API Starting ---" << std::endl;

    // ==========================================
    // 1. GLOBAL CORS MIDDLEWARE
    // ==========================================
    drogon::app().registerPostHandlingAdvice(
        [](const drogon::HttpRequestPtr &req, const drogon::HttpResponsePtr &resp)
        {
            resp->addHeader("Access-Control-Allow-Origin", "*");
            resp->addHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST, PUT, DELETE");
            resp->addHeader("Access-Control-Allow-Headers", "Content-Type");
        });

    // Register all CORS Preflight OPTIONS routes cleanly
    registerOptionsHandler("/api/book");
    registerOptionsHandler("/api/payment/verify");
    registerOptionsHandler("/api/seats");
    registerOptionsHandler("/api/booking/status");
    registerOptionsHandler("/api/ticket");
    registerOptionsHandler("/api/journey/schedule");
    registerOptionsHandler("/api/flights");

    // ==========================================
    // 2. GET SEATS (Hydrate by Date)
    // ==========================================
    drogon::app().registerHandler(
        "/api/seats",
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            std::string flightId = req->getParameter("flight_id");
            Json::Value bookedSeats(Json::arrayValue);
            try
            {
                pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
                pqxx::work W(conn);

                // Dynamically filter by flight_id to ensure users only see seats for this specific flight
                std::string query = "SELECT seat_number FROM Tickets WHERE status = 'Booked'";
                if (!flightId.empty())
                {
                    query += " AND flight_id = " + W.quote(flightId);
                }
                query += ";";

                pqxx::result R = W.exec(query);
                for (auto row : R)
                {
                    bookedSeats.append(row[0].c_str());
                }
            }
            catch (const std::exception &e)
            {
                std::cerr << "[DB Error /api/seats] " << e.what() << std::endl;
            }

            auto resp = drogon::HttpResponse::newHttpJsonResponse(bookedSeats);
            callback(resp);
        },
        {drogon::Get});

    // ==========================================
    // 3. POST BOOKING (Redis + PostgreSQL Check)
    // ==========================================
    drogon::app().registerHandler(
        "/api/book",
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            auto jsonReq = req->getJsonObject();

            if (!jsonReq || !jsonReq->isMember("seat_code"))
            {
                Json::Value error;
                error["error"] = "Invalid JSON! Must include seat_code.";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(error);
                resp->setStatusCode(drogon::k400BadRequest);
                callback(resp);
                return;
            }

            std::string seatCode = (*jsonReq)["seat_code"].asString();
            std::string flightId = (*jsonReq).isMember("flight_id") ? (*jsonReq)["flight_id"].asString() : "0";

            // --- DATABASE DOUBLE-BOOKING SHIELD ---
            try
            {
                pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
                pqxx::work W(conn);
                std::string checkQuery = "SELECT ticket_id FROM Tickets WHERE seat_number = " + W.quote(seatCode) + " AND flight_id = " + W.quote(flightId) + ";";
                pqxx::result R = W.exec(checkQuery);

                if (!R.empty())
                {
                    std::cout << "[API] BLOCKED! Seat " << seatCode << " is already permanently booked for flight " << flightId << std::endl;
                    Json::Value error;
                    error["error"] = "Seat is already permanently booked for this flight!";
                    auto resp = drogon::HttpResponse::newHttpJsonResponse(error);
                    resp->setStatusCode(drogon::k409Conflict);
                    callback(resp);
                    return;
                }
            }
            catch (const std::exception &e)
            {
                std::cerr << "[DB Check Error] " << e.what() << std::endl;
            }

            // --- REDIS LOCK (Now includes the flight_id so different flights don't block each other) ---
            std::string lockKey = "lock:flight_id:" + flightId + ":seat_" + seatCode;

            std::cout << "\n[API] Incoming request for Seat " << seatCode << " on flight_id " << flightId << ". Checking Redis..." << std::endl;

            auto redis = sw::redis::Redis(globalConfig.redis_connection);
            bool lockAcquired = redis.set(lockKey, "held", std::chrono::minutes(5), sw::redis::UpdateType::NOT_EXIST);

            if (!lockAcquired)
            {
                std::cout << "[API] BLOCKED! Seat " << seatCode << " is currently held." << std::endl;
                Json::Value error;
                error["error"] = "Seat Temporarily Held by Another Passenger.";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(error);
                resp->setStatusCode(drogon::k409Conflict);
                callback(resp);
                return;
            }

            std::cout << "[API] Redis Lock Acquired! Creating Razorpay Order..." << std::endl;
            
            auto client = drogon::HttpClient::newHttpClient("https://api.razorpay.com");
            auto reqOut = drogon::HttpRequest::newHttpRequest();
            reqOut->setMethod(drogon::Post);
            reqOut->setPath("/v1/orders");
            
            std::string auth = globalConfig.razorpay_key_id + ":" + globalConfig.razorpay_key_secret;
            reqOut->addHeader("Authorization", "Basic " + drogon::utils::base64Encode((const unsigned char*)auth.c_str(), auth.length()));
            reqOut->addHeader("Content-Type", "application/json");
            
            Json::Value rzpPayload;
            rzpPayload["amount"] = 25000000; // 250000 INR in paise
            rzpPayload["currency"] = "INR";
            rzpPayload["receipt"] = "rcptid_" + seatCode;
            
            Json::FastWriter reqWriter;
            reqOut->setBody(reqWriter.write(rzpPayload));
            
            client->sendRequest(reqOut, [callback, jsonReq](drogon::ReqResult result, const drogon::HttpResponsePtr &respOut) {
                if (result == drogon::ReqResult::Ok && respOut->getStatusCode() == 200) {
                    auto rzpResp = respOut->getJsonObject();
                    std::string orderId = (*rzpResp)["id"].asString();
                    
                    // Save booking payload to Redis
                    Json::FastWriter writer;
                    std::string payloadStr = writer.write(*jsonReq);
                    auto redis = sw::redis::Redis(globalConfig.redis_connection);
                    redis.set("booking:order:" + orderId, payloadStr, std::chrono::minutes(5));
                    
                    Json::Value success;
                    success["status"] = "Order Created";
                    success["order_id"] = orderId;
                    auto resp = drogon::HttpResponse::newHttpJsonResponse(success);
                    resp->setStatusCode(drogon::k200OK);
                    callback(resp);
                } else {
                    Json::Value error;
                    error["error"] = "Failed to create Razorpay Order";
                    auto resp = drogon::HttpResponse::newHttpJsonResponse(error);
                    resp->setStatusCode(drogon::k500InternalServerError);
                    callback(resp);
                }
            });
        },
        {drogon::Post});

    // ==========================================
    // 3.5 POST PAYMENT VERIFY
    // ==========================================
    drogon::app().registerHandler(
        "/api/payment/verify",
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            std::cout << "\n[API] /api/payment/verify hit!" << std::endl;
            auto jsonReq = req->getJsonObject();
            if (!jsonReq || !jsonReq->isMember("razorpay_order_id") || !jsonReq->isMember("razorpay_payment_id") || !jsonReq->isMember("razorpay_signature"))
            {
                std::cout << "[API] Missing Razorpay details in payload." << std::endl;
                Json::Value error;
                error["error"] = "Missing Razorpay details";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(error);
                resp->setStatusCode(drogon::k400BadRequest);
                callback(resp);
                return;
            }
            
            std::string order_id = (*jsonReq)["razorpay_order_id"].asString();
            std::string payment_id = (*jsonReq)["razorpay_payment_id"].asString();
            std::string signature = (*jsonReq)["razorpay_signature"].asString();
            
            std::cout << "[API] Verifying payment " << payment_id << " for order " << order_id << std::endl;
            
            std::string payload = order_id + "|" + payment_id;
            std::string secret = globalConfig.razorpay_key_secret;
            
            unsigned char* digest;
            digest = HMAC(EVP_sha256(), secret.c_str(), secret.length(), (unsigned char*)payload.c_str(), payload.length(), NULL, NULL);
            
            std::stringstream ss;
            for(int i = 0; i < 32; i++) {
                ss << std::hex << std::setw(2) << std::setfill('0') << (int)digest[i];
            }
            std::string generated_signature = ss.str();
            
            if (generated_signature != signature) {
                std::cout << "[API] Signature mismatch! Expected: " << generated_signature << " Got: " << signature << std::endl;
                Json::Value error;
                error["error"] = "Invalid Signature";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(error);
                resp->setStatusCode(drogon::k400BadRequest);
                callback(resp);
                return;
            }
            
            std::cout << "[API] Signature matched. Fetching from Redis..." << std::endl;
            
            // Signature valid, retrieve booking details from Redis
            auto redis = sw::redis::Redis(globalConfig.redis_connection);
            auto bookingPayloadStr = redis.get("booking:order:" + order_id);
            if (!bookingPayloadStr) {
                std::cout << "[API] Redis key booking:order:" << order_id << " not found!" << std::endl;
                Json::Value error;
                error["error"] = "Booking session expired or invalid";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(error);
                resp->setStatusCode(drogon::k400BadRequest);
                callback(resp);
                return;
            }
            
            std::cout << "[API] Found payload, publishing to RabbitMQ..." << std::endl;
            
            // Publish to RabbitMQ
            publishMessageToQueue(*bookingPayloadStr);
            
            std::cout << "[API] Successfully queued for processing!" << std::endl;
            
            Json::Value success;
            success["status"] = "Payment Verified and Ticket Booked!";
            auto resp = drogon::HttpResponse::newHttpJsonResponse(success);
            resp->setStatusCode(drogon::k200OK);
            callback(resp);
        },
        {drogon::Post});

    // ==========================================
    // 4. GET BOOKING STATUS (The Polling Route)
    // ==========================================
    drogon::app().registerHandler(
        "/api/booking/status",
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            std::string seatCode = req->getParameter("seat_code");
            Json::Value responseJson;

            try
            {
                pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
                pqxx::work W(conn);

                std::string query = "SELECT status FROM Tickets WHERE seat_number = " + W.quote(seatCode) + ";";
                pqxx::result R = W.exec(query);

                if (!R.empty())
                {
                    responseJson["status"] = "booked";
                }
                else
                {
                    responseJson["status"] = "processing";
                }
            }
            catch (const std::exception &e)
            {
                responseJson["status"] = "error";
            }

            auto resp = drogon::HttpResponse::newHttpJsonResponse(responseJson);
            callback(resp);
        },
        {drogon::Get});

    // ==========================================
    // 5. GET TICKET (The Kiosk Boarding Pass)
    // ==========================================
    drogon::app().registerHandler(
        "/api/ticket",
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            std::string dateParam = req->getParameter("date");
            std::string passengerParam = req->getParameter("passenger");
            Json::Value ticketData;

            if (dateParam.empty() || passengerParam.empty())
            {
                ticketData["status"] = "error";
                ticketData["message"] = "Missing date or passenger name parameters.";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(ticketData);
                callback(resp);
                return;
            }

            try
            {
                pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
                pqxx::work W(conn);

                std::string query = "SELECT t.seat_number, tr.name, p1.name, p2.name, t.date, t.price, f.commander, f.astronaut "
                                    "FROM Tickets t "
                                    "JOIN Travellers tr ON t.traveller_id = tr.id "
                                    "JOIN Planets p1 ON t.source_planet = p1.planet_id "
                                    "JOIN Planets p2 ON t.dest_planet = p2.planet_id "
                                    "LEFT JOIN Flights f ON t.flight_id = f.id "
                                    "WHERE t.date = " + W.quote(dateParam) +
                                    " AND tr.name ILIKE " + W.quote(passengerParam) + 
                                    " ORDER BY t.ticket_id DESC LIMIT 1;"; // Gets the most recent matching booking

                pqxx::result R = W.exec(query);

                if (!R.empty())
                {
                    ticketData["status"] = "found";
                    ticketData["seat_code"] = R[0][0].c_str();
                    ticketData["passenger"] = R[0][1].c_str();
                    ticketData["source"] = R[0][2].c_str();
                    ticketData["dest"] = R[0][3].c_str();
                    ticketData["date"] = R[0][4].c_str();
                    ticketData["commander"] = R[0][6].is_null() ? "" : R[0][6].c_str();
                    ticketData["astronaut"] = R[0][7].is_null() ? "" : R[0][7].c_str();
                }
                else
                {
                    ticketData["status"] = "not_found";
                }
            }
            catch (const std::exception &e)
            {
                ticketData["status"] = "error";
                ticketData["message"] = e.what();
            }

            auto resp = drogon::HttpResponse::newHttpJsonResponse(ticketData);
            callback(resp);
        },
        {drogon::Get});

    // ==========================================
    // 6. POST JOURNEY SCHEDULE (Admin Panel)
    // ==========================================
    drogon::app().registerHandler(
        "/api/journey/schedule",
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            Json::Value response;
            auto jsonReq = req->getJsonObject();
            if (!jsonReq)
            {
                response["error"] = "Invalid JSON Payload";
                auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
                resp->setStatusCode(drogon::k400BadRequest);
                callback(resp);
                return;
            }

            try
            {
                pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
                pqxx::work W(conn);

                std::string journey_date = (*jsonReq)["date"].asString();
                std::string origin = (*jsonReq)["sourcePlanet"].asString();
                std::string destination = (*jsonReq)["destPlanet"].asString();
                std::string commander = (*jsonReq)["commander"].asString();
                std::string astronaut = (*jsonReq)["astronaut"].asString();

                std::string query = "INSERT INTO Flights (journey_date, origin, destination, commander, astronaut) "
                                    "VALUES (" + W.quote(journey_date) + ", " + W.quote(origin) + ", " + W.quote(destination) + ", " + W.quote(commander) + ", " + W.quote(astronaut) + ") RETURNING id;";
                pqxx::result R = W.exec(query);
                W.commit();

                response["status"] = "Flight scheduled successfully on the backend!";
                if (!R.empty()) response["flight_id"] = R[0][0].as<int>();
            }
            catch (const std::exception &e)
            {
                response["error"] = std::string("Database error: ") + e.what();
                auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
                resp->setStatusCode(drogon::k500InternalServerError);
                callback(resp);
                return;
            }

            auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
            resp->setStatusCode(drogon::k200OK);
            callback(resp);
        },
        {drogon::Post});

    // ==========================================
    // 7. GET FLIGHTS (By Date)
    // ==========================================
    drogon::app().registerHandler(
        "/api/flights",
        [](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&callback)
        {
            Json::Value response(Json::arrayValue);
            std::string dateParam = req->getParameter("date");
            
            if (dateParam.empty())
            {
                auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
                callback(resp);
                return;
            }

            try
            {
                pqxx::connection &conn = DatabaseConnection::getInstance().getConnection();
                pqxx::work W(conn);

                std::string query = "SELECT id, journey_date, origin, destination, commander, astronaut FROM Flights WHERE journey_date = " + W.quote(dateParam) + " ORDER BY id ASC;";
                pqxx::result R = W.exec(query);

                for (auto row : R)
                {
                    Json::Value flight;
                    flight["flight_id"] = row[0].as<int>();
                    flight["date"] = row[1].c_str();
                    flight["origin"] = row[2].c_str();
                    flight["destination"] = row[3].c_str();
                    flight["commander"] = row[4].c_str();
                    flight["astronaut"] = row[5].c_str();
                    response.append(flight);
                }
            }
            catch (const std::exception &e)
            {
                std::cerr << "[DB Error /api/flights] " << e.what() << std::endl;
            }

            auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
            callback(resp);
        },
        {drogon::Get});

    std::cout << "Listening for web traffic on http://0.0.0.0:" << globalConfig.port << std::endl;
    drogon::app().addListener("0.0.0.0", globalConfig.port).run();

    return 0;
}