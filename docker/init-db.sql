-- Initialize PostgreSQL databases for Backr

-- Create databases for Canton
CREATE DATABASE canton;
CREATE DATABASE canton_sequencer;

-- Create database for Keycloak
CREATE DATABASE keycloak;

-- Grant permissions to backr user
GRANT ALL PRIVILEGES ON DATABASE backr TO backr;
GRANT ALL PRIVILEGES ON DATABASE canton TO backr;
GRANT ALL PRIVILEGES ON DATABASE canton_sequencer TO backr;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO backr;
