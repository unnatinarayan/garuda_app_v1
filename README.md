# 🛰️ Gadura V1: Geospatial Project Manager (Class-Oriented Full Stack)

Gadura V1 is a **full-stack, class-oriented application** built with Vue 3 (Frontend) and Node/TypeScript (Backend) that allows users to define geospatial projects, manage Areas of Interest (AOIs) using PostGIS, and delivers **real-time alerts** via Change Data Capture (CDC).

This document details the project architecture, prerequisites, setup, and execution steps for the **complete CDC pipeline**.

---

## 🏛️ 1. Architecture Overview (CDC Pipeline)

The project utilizes a five-layer real-time data pipeline. It specifically captures **inserts** into the `alerts` table and pushes them directly to the logged-in user's browser for instant notification.

| Layer | Technology | Key Role |
| :--- | :--- | :--- |
| **Database** | PostgreSQL + PostGIS | Canonical data storage. The **`alerts` table** is the data source. |
| **CDC Connector** | **Debezium (Postgres Connector)** | Captures changes from PostgreSQL's WAL and publishes events to Kafka. |
| **Message Broker** | **Apache Kafka (KRaft)** | Highly available message queue for the CDC stream (`dbserver1.public.alerts` topic). |
| **Alert Service** | **Node.js/KafkaJS/Redis** | Consumes the Kafka stream, fetches recipient user IDs, saves missed alerts to **Redis**, and streams live alerts via Server-Sent Events (SSE). |
| **Frontend** | Vue 3 + SSE | Establishes an SSE connection to the Node.js backend for instant, real-time user notification. |

---

## ⚙️ 2. Prerequisites & Installation

The setup requires five core infrastructure components. All commands provided are for a Unix-like environment (Linux/Mac with Homebrew).

### A. Core System Dependencies

Ensure the following dependencies are installed before proceeding with the CDC pipeline setup.

| Dependency | Purpose | Installation Command (Linux/Mac) |
| :--- | :--- | :--- |
| **JDK 21** | Required for Kafka and Debezium. | `sudo apt install -y openjdk-21-jdk` **OR** `brew install openjdk@21` |
| **Node.js & npm** | Required for Backend/Frontend. | `nvm install --lts` (or standard installation) |
| **PostgreSQL & PostGIS** | Geospatial data storage and CDC source. | `sudo apt install postgresql postgresql-contrib postgis` |
| **Redis Server** | Cache for user alerts when offline. | `sudo apt install redis-server` **OR** `brew install redis` |

> **Verification:** Ensure Node, Java, and Postgres are correctly installed and available in your environment's PATH.

### B. Database Setup (Schema & Logical Replication)

This section covers setting up the database and preparing it for Change Data Capture using PostgreSQL's **Logical Replication**. The process uses a **database schema dump file** for quick setup.

1.  **Create Database Schema**
    *The `garuda_v1_schema_dump.sql` file must be available in the root folder of your project.*

    ```bash
    # 1. Create the database user and database
    sudo -i -u postgres
    createuser --interactive # Use: garuda_user, password: Minar@123
    createdb -O garuda_user garuda_v1_db
    \q
    exit

    # 2. Enable PostGIS
    psql -U garuda_user -d garuda_v1_db -h localhost
    CREATE EXTENSION postgis;
    \q

    # 3. Restore the schema structure from the dump file
    psql -U garuda_user -d garuda_v1_db -h localhost < garuda_v1_schema_dump.sql



    ```


```.env bash 
# Server Configuration
PORT=3000

# Database Configuration
DB_USER=gadura_user
DB_HOST=localhost
DB_DATABASE=gadura_v1_db
DB_PASSWORD=your_strong_password
DB_PORT=5432
```


2.  **Enable Logical Replication (CDC Configuration)**

    Edit the PostgreSQL configuration file (e.g., `/etc/postgresql/16/main/postgresql.conf`) and ensure these settings are active:

    ```ini
    wal_level = logical
    max_replication_slots = 10
    max_wal_senders = 10
    listen_addresses = '*'
    ```

3.  **Apply REPLICA IDENTITY and Publication**

    These steps are crucial for Debezium to correctly capture changes from the `alerts` table. Connect to your DB and run:

    ```sql
    psql -U garuda_user -d garuda_v1_db -h localhost
    ALTER TABLE alerts REPLICA IDENTITY FULL;
    CREATE PUBLICATION debezium_pub1 FOR TABLE alerts;
    \q
    ```

4.  **Restart PostgreSQL:**
    ```bash
    sudo systemctl restart postgresql
    # OR (for Homebrew on Mac)
    # brew services restart postgresql@16
    ```

### C. Kafka and Debezium Setup

We will use **Kafka in KRaft mode** for simplicity and performance.

1.  **Install Kafka (KRaft Mode)**

    ```bash
    cd ~
    # Using Kafka version 4.1.0 (compatible with the project setup)
    wget [https://archive.apache.org/dist/kafka/4.1.0/kafka_2.13-4.1.0.tgz](https://archive.apache.org/dist/kafka/4.1.0/kafka_2.13-4.1.0.tgz)
    tar -xvzf kafka_2.13-4.1.0.tgz
    mv kafka_2.13-4.1.0 kafka
    mkdir -p ~/kafka/plugins 
    ```

2.  **Format KRaft Storage**

    ```bash
    rm -rf /tmp/kraft-combined-logs
    KAFKA_CLUSTER_ID="$(~/kafka/bin/kafka-storage.sh random-uuid)"
    ~/kafka/bin/kafka-storage.sh format -t $KAFKA_CLUSTER_ID -c ~/kafka/config/kraft-broker.properties
    ```

3.  **Install Debezium Connector (Postgres)**

    ```bash
    cd ~
    # Using Debezium version 2.6.1.Final
    wget [https://repo1.maven.org/maven2/io/debezium/debezium-connector-postgres/2.6.1.Final/debezium-connector-postgres-2.6.1.Final-plugin.tar.gz](https://repo1.maven.org/maven2/io/debezium/debezium-connector-postgres/2.6.1.Final/debezium-connector-postgres-2.6.1.Final-plugin.tar.gz)
    tar -xvzf debezium-connector-postgres-2.6.1.Final-plugin.tar.gz
    # Move the extracted connector plugin into Kafka's plugins folder
    mv debezium-connector-postgres ~/kafka/plugins/
    rm debezium-connector-postgres-2.6.1.Final-plugin.tar.gz
    ```

4.  **Configure Connector Files**

    Create the following two configuration files inside `~/kafka/config/`:

    **a) `connect-standalone.properties`**
    
    ```ini
    bootstrap.servers=localhost:9092
    key.converter=org.apache.kafka.connect.json.JsonConverter
    value.converter=org.apache.kafka.connect.json.JsonConverter
    key.converter.schemas.enable=false
    value.converter.schemas.enable=false
    offset.storage.file.filename=/tmp/connect.offsets
    offset.flush.interval.ms=10000
    # IMPORTANT: Update this path to your absolute home directory path!
    plugin.path=/home/YOUR_USER_NAME/kafka/plugins 
    ```

    **b) `register-postgres.properties` (Debezium Connector Configuration)**

    ```ini
    name=garuda-alerts-connector
    connector.class=io.debezium.connector.postgresql.PostgresConnector
    plugin.name=pgoutput
    database.hostname=localhost
    database.port=5432
    database.user=garuda_user
    database.password=Minar@123
    database.dbname=garuda_v1_db
    database.server.name=dbserver1
    topic.prefix=dbserver1
    slot.name=debezium_slot1
    publication.name=debezium_pub1
    snapshot.mode=initial
    table.include.list=public.alerts
    key.converter=org.apache.kafka.connect.json.JsonConverter
    value.converter=org.apache.kafka.connect.json.JsonConverter
    tombstones.on.delete=false
    ```

### D. Project Setup & Vite Proxy

1.  **Install Dependencies:**

    ```bash
    cd garuda_app_v1/backend && npm install
    cd ../frontend && npm install
    ```

2.  **Frontend Proxy (For Local Development)**
    Ensure your frontend's `vite.config.ts` includes the necessary proxy to route API calls to the Node.js backend:

    ```typescript
    // garuda_app_v1/frontend/vite.config.ts
    // ...
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        }
    }
    // ...
    ```

---

## 🚀 3. Running the Complete CDC Pipeline

The complete application requires **five** separate terminals running concurrently to establish the real-time pipeline.

| Terminal | Component | Directory | Command | Status Check (Success) |
| :--- | :--- | :--- | :--- | :--- |
| **T1** | **Kafka Broker** | `~/kafka` | `bin/kafka-server-start.sh config/kraft-broker.properties` | `Kafka Server started` |
| **T2** | **Debezium Connect** | `~/kafka` | `bin/connect-standalone.sh config/connect-standalone.properties config/register-postgres.properties` | `Worker is now up and running` |
| **T3** | **Redis** | N/A | `sudo systemctl start redis-server` | (Check with `redis-cli ping` -> `PONG`) |
| **T4** | **Node.js Backend** | `garuda_app_v1/backend` | `npm run start` | `Garuda V1 Server running... Kafka consumer is running.` |
| **T5** | **Vue Frontend** | `garuda_app_v1/frontend` | `npm run dev` | `Local: http://localhost:5173/` |

> **Execution Order:** Start **T1 (Kafka)**, **T3 (Redis)**, **T2 (Debezium)**, **T4 (Backend)**, and finally **T5 (Frontend)**.

---

## 🗄️ 4. Database Schema Dump File

The `garuda_v1_schema_dump.sql` file contains the complete schema structure, including all tables, Foreign Keys (FKs), unique constraints, and the crucial PostGIS geometry type.

### Creating the Dump File

The dump file is created using the following command:

```bash
pg_dump -U garuda_user -h localhost -p 5432 -s -O -d garuda_v1_db -F p > garuda_v1_schema_dump.sql

```


### Initial Seed Data (Algorithms)

To ensure successful project creation, the garuda_v1_schema_dump.sql file must be appended with the following seed data to populate the algorithm_catalogue table:

```bash
INSERT INTO algorithm_catalogue (algo_id, args, description, category) VALUES
('Sentinel1_Change', '{"threshold": 0.5, "bands": ["VV", "VH"]}', 'Detects significant land cover changes using Sentinel-1 SAR data.', 'Change Detection'),
('Sentinel2_NDVI_Monitor', '{"min_ndvi": 0.3, "period": "weekly"}', 'Monitors vegetation health using Normalized Difference Vegetation Index (NDVI) from Sentinel-2.', 'Vegetation Health'),
('Land_Cover_Classifier', '{"model_version": "v3.1", "confidence_level": 0.8}', 'Classifies land cover types (e.g., water, forest, urban) within the AOI.', 'Classification'),
('Cloud_Cover_Filter', '{"max_cloud": 0.1, "sensor": "S2"}', 'Utility algorithm to filter satellite imagery based on cloud percentage.', 'Utility');

```


### chcek node tsc

node --version
10.9.3
nvm list
22.20.0
nvm use v____
tsc --init
npx tsc --init
sudp apy install node-typescript

change to workspace version

tsc && node src/server.ts


nvm install --lts
nvm use --lts
nvm alias default lts
node -v


###

npm i -D ts-node

ts-node src...

node --require ts-node/register src/server.ts


### egma script modules

type: mpdule
moduke: node16

ts-node-esm src/...


### nei
nvm list
nvm use v20..

node --loader ts-node/esm src/main.ts


### check

npx ts-node --version



### install tsx

npx i -D tsx

tsx src/server.ts




### Test CDC:

```bash
INSERT INTO alerts (project_id, aoi_fk_id, algo_fk_id, message) VALUES (37, 17, 2, '{"type": "New Project Update", "detail": "Project 1 just processed a new geospatial result.", "severity": "Medium"}');

<<<<<<< HEAD
INSERT INTO alerts (project_id, aoi_fk_id, algo_fk_id, message) VALUES (38, 18, 3, '{"type": "New Project Update", "detail": "Project 1 just processed a new geospatial result.", "severity": "Medium"}');



```

https://docs.google.com/document/d/1l-ZPJcTxA3AQtHbtxo4dWeC2cAn43YtrqvzBWx5-wlQ/edit?usp=sharing

https://docs.google.com/document/d/1r9Mm2we47yvmU7ruuzOqMgFe-dshgLGXAzVmrRvLl5s/edit?usp=sharing



### Final Docs
https://docs.google.com/document/d/1NbK7AfTEfV0zuK0rDt07MbnihCiph7KsW7wDKaRrbRw/edit?usp=sharing

https://docs.google.com/document/d/1q8o2brW7Hcq3vvnDQseXc6PMot492g0M/edit?usp=sharing&ouid=113621658258964798384&rtpof=true&sd=true