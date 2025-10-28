
// backend/src/db/DBClient.ts

import { Pool } from 'pg';
import type { QueryResult } from 'pg';

import * as dotenv from 'dotenv';

dotenv.config();

// Singleton class for managing the PostgreSQL connection pool
export class DBClient {
    private static instance: DBClient;
    // CRITICAL: Make the pool public so ProjectService can manage transactions
    public pool: Pool; 

    private constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Non-transactional queries might fail, but let's not exit the process for a single error
            // process.exit(-1); // Removed to keep the server running unless fatal
        });
        console.log('Database Pool Initialized.');
    }

    public static getInstance(): DBClient {
        if (!DBClient.instance) {
            DBClient.instance = new DBClient();
        }
        return DBClient.instance;
    }

    // Generic method to execute SQL queries (used outside of transactions)
    public async query<T>(text: string, params: any[] = []): Promise<QueryResult<T>> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}


