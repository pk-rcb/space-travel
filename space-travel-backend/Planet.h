#ifndef PLANET_H
#define PLANET_H

#include <string>

class Planet
{
public:
    int id; // Added to hold the database planet_id
    std::string name;
    double x;
    double y;
    double z;

    Planet() {}
    Planet(std::string name, double x, double y, double z);
};

// Declare the SELECT function
Planet getPlanetByName(std::string planetName);
void savePlanetToDB(Planet &p);

#endif