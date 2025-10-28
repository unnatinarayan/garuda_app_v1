// backend/src/models/UserModel.ts

import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface UserData {
    user_id: string;
    username: string | null;
    password_hash: string | null;
}

/**
 * UserModel: Handles persistence logic for the 'users' table.
 */
export class UserModel {
    public userId: string;
    public username: string | null;
    public passwordHash: string | null;

    constructor(data: UserData) {
        this.userId = data.user_id;
        this.username = data.username || data.user_id;
        // In a real app, the hash should be stored/validated securely
        this.passwordHash = data.password_hash || null; 
    }

    /**
     * Finds a user by their unique user_id.
     */
    public static async findById(userId: string): Promise<UserModel | null> {
        const query = `SELECT user_id, username, password_hash FROM users WHERE user_id = $1;`;
        const result = await db.query<UserData>(query, [userId]);
        
        if (result.rows.length === 0) return null;
        return new UserModel(result.rows[0]);
    }

    /**
     * Inserts a new user into the database (Sign Up).
     */
    public async save(): Promise<UserModel> {
        const query = `
            INSERT INTO users (user_id, username, password_hash)
            VALUES ($1, $2, $3)
            RETURNING user_id, username;
        `;
        // NOTE: We use userId as the user_id for simplicity, and passwordHash is used for the plain text password check for now.
        const values = [this.userId, this.username, this.passwordHash];
        
        const result = await db.query(query, values);
        return new UserModel(result.rows[0]);
    }
}