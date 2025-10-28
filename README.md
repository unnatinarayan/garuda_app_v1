🛰️ Gadura V1: Geospatial Project Manager (Class-Oriented Full Stack)

Gadura V1 is a full-stack, class-oriented application built with Vue 3 (Frontend) and Node/TypeScript (Backend) that allows users to define geospatial projects, manage Areas of Interest (AOIs) using PostGIS, configure surveillance algorithms, and manage project collaborators.

This document details the project architecture, prerequisites, setup, and database schema.

🏛️ 1. Architecture Overview (Class-Oriented)

The project is built on a strict Object-Oriented paradigm across the stack, leveraging dedicated classes for data modeling, service logic, and UI state management.

Layer

Technology

Key Classes & Role

Database

PostgreSQL + PostGIS

Canonical data storage for complex geospatial types.

Backend (API)

Node.js + Express (TypeScript)

App, DBClient (Singleton), AuthController, ProjectController (Routing), ProjectService (Transactional Logic).

Backend Models

TypeScript Classes

ProjectModel, AreaOfInterestModel, AlgorithmCatalogueModel, etc. (Handle DB CRUD).

Frontend (UI)

Vue 3 + Pinia (TypeScript)

Vue Components act as UI Classes (HomeViewUI, ConfigureProjectUI).

Frontend Classes

TypeScript Classes

UserSession (Login state), ApiClient (Singleton), ProjectFormData (4-step form object), AreaOfInterestDraft (AOI creation manager).

⚙️ 2. Prerequisites & Installation

A. System Prerequisites (Ubuntu)

Node.js & npm: (Use nvm recommended)

nvm install --lts
nvm use --lts


PostgreSQL & PostGIS: (Essential for geospatial data)

sudo apt update
sudo apt install postgresql postgresql-contrib postgis


B. Database Setup

Create the database and user, and enable the PostGIS extension.

Create User & Database:

sudo -i -u postgres
# Create the user (replace with a strong password)
createuser --interactive
# (Enter gadura_user, say NO to superuser, YES to createdb)
psql
ALTER USER garuda_user WITH ENCRYPTED PASSWORD 'your_strong_password';
\q
# Create the database owned by the new user
createdb -O garuda_user garuda_v1_db
exit


Enable PostGIS Extension:

psql -U gadura_user -d gadura_v1_db
gadura_v1_db=> CREATE EXTENSION postgis;
gadura_v1_db=> \q


C. Project Setup

Project Structure: Assume the repository contains two root folders: backend/ and frontend/.

Backend Setup (backend/):

cd backend
npm install
# Create .env file with DB credentials (see Section 3.1)


Frontend Setup (frontend/):

cd frontend
npm install


3. 🚀 Running the Application

3.1 Backend Configuration (backend/.env)

Create this file in the backend/ root directory:

# Server Configuration
PORT=3000

# Database Configuration
DB_USER=gadura_user
DB_HOST=localhost
DB_DATABASE=gadura_v1_db
DB_PASSWORD=your_strong_password
DB_PORT=5432


3.2 Start Servers

Start Backend (Terminal 1):

cd backend
npm run start
# Should show: ⚡️ Gadura V1 Server running on http://localhost:3000


Start Frontend (Terminal 2):

cd frontend
npm run dev
# Should open the application in your browser (e.g., http://localhost:5173)


Login Credentials (Mock): Username: testuser | Password: pass

🗄️ 4. Database Schema (PSQL Dump Equivalent)

The tables below define the structure of the gadura_v1_db and include foreign keys (FK) and the critical PostGIS geometry type (GEOMETRY(POLYGON, 4326)).

A. Schema Definition

-- 1. Project Table (Parent Table)
CREATE TABLE project (
    id SERIAL NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified_date TIMESTAMP WITH TIME ZONE,
    created_by_userid TEXT NOT NULL,
    auxdata JSONB, -- Custom key-value pairs
    CONSTRAINT pkey_project PRIMARY KEY (id)
);

-- 2. Algorithm Catalogue (Read-Only)
CREATE TABLE algorithm_catalogue (
    id SERIAL NOT NULL,
    algo_id TEXT UNIQUE NOT NULL, -- Human-readable unique ID (e.g., 'Sentinel1_Change')
    args JSONB,
    description TEXT,
    category TEXT,
    CONSTRAINT pkey_algo PRIMARY KEY (id)
);

-- 3. Area of Interest (Geospatial Data)
CREATE TABLE area_of_interest (
    id SERIAL NOT NULL,
    project_id INTEGER NOT NULL,
    aoi_id TEXT NOT NULL,
    name TEXT NOT NULL,
    geom GEOMETRY(POLYGON, 4326) NOT NULL, -- PostGIS Geometry (WGS84)
    auxdata JSONB,
    publish_flag BOOLEAN NOT NULL DEFAULT true,
    geom_properties JSONB,
    CONSTRAINT pkey_aoi PRIMARY KEY (id),
    CONSTRAINT unique_aoi_in_project UNIQUE (project_id, aoi_id),
    CONSTRAINT fkey_aoi_project_id FOREIGN KEY (project_id)
        REFERENCES public.project (id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 4. AOI to Algorithm Mapping (Many-to-Many Junction Table)
CREATE TABLE aoi_algorithm_mapping (
    id SERIAL NOT NULL,
    aoi_id INTEGER NOT NULL, -- FK to area_of_interest.id
    algo_id INTEGER NOT NULL, -- FK to algorithm_catalogue.id
    config_args JSONB, -- Specific run parameters for this pair
    CONSTRAINT pkey_aoi_algo_map PRIMARY KEY (id),
    CONSTRAINT unique_aoi_algo UNIQUE (aoi_id, algo_id),
    CONSTRAINT fkey_mapping_aoi FOREIGN KEY (aoi_id)
        REFERENCES public.area_of_interest (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fkey_mapping_algo FOREIGN KEY (algo_id)
        REFERENCES public.algorithm_catalogue (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 5. Users to Project (Project Roles)
CREATE TABLE users_to_project (
    id SERIAL NOT NULL,
    user_id TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    CONSTRAINT pkey_users_to_project PRIMARY KEY (id),
    CONSTRAINT unique_user_project UNIQUE (user_id, project_id),
    CONSTRAINT fkey_user_project_id FOREIGN KEY (project_id)
        REFERENCES public.project (id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 6. Alerts Log
CREATE TABLE alerts (
    id SERIAL NOT NULL,
    project_id INTEGER NOT NULL,
    aoi_fk_id INTEGER NOT NULL, -- FK to area_of_interest.id
    algo_fk_id INTEGER NOT NULL, -- FK to algorithm_catalogue.id
    message JSONB NOT NULL,
    alert_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pkey_alerts PRIMARY KEY (id),
    CONSTRAINT fkey_alert_project_id FOREIGN KEY (project_id)
        REFERENCES public.project (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fkey_alert_aoi FOREIGN KEY (aoi_fk_id)
        REFERENCES public.area_of_interest (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fkey_alert_algo FOREIGN KEY (algo_fk_id)
        REFERENCES public.algorithm_catalogue (id) ON UPDATE CASCADE ON DELETE RESTRICT
);


7. CREATE TABLE IF NOT EXISTS users (
    user_id TEXT NOT NULL UNIQUE, -- Primary identifier (e.g., email or unique string)
    username TEXT,
    password_hash TEXT,
    CONSTRAINT pkey_user PRIMARY KEY (user_id)
);


B. Initial Seed Data (Algorithms)

To test Step 3 of the project creation wizard:

INSERT INTO algorithm_catalogue (algo_id, args, description, category) VALUES
('Sentinel1_Change', '{"threshold": 0.5, "bands": ["VV", "VH"]}', 'Detects significant land cover changes using Sentinel-1 SAR data.', 'Change Detection'),
('Sentinel2_NDVI_Monitor', '{"min_ndvi": 0.3, "period": "weekly"}', 'Monitors vegetation health using Normalized Difference Vegetation Index (NDVI) from Sentinel-2.', 'Vegetation Health'),
('Land_Cover_Classifier', '{"model_version": "v3.1", "confidence_level": 0.8}', 'Classifies land cover types (e.g., water, forest, urban) within the AOI.', 'Classification'),
('Cloud_Cover_Filter', '{"max_cloud": 0.1, "sensor": "S2"}', 'Utility algorithm to filter satellite imagery based on cloud percentage.', 'Utility');


This README.md provides a comprehensive guide for anyone setting up or working on the Gadura V1 project.