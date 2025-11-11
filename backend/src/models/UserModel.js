// UserModel.js

import { DBClient } from '../db/DBClient.js';

const db = DBClient.getInstance();

/**
 * UserModel: Handles persistence logic for the 'users' table.
 */
export class UserModel {
    userId = null;
    username = null;
    passwordHash = null;
    contactNo = null; // NEW
    email = null;     // NEW

    constructor(data) {
        this.userId = data.user_id;
        this.username = data.username || data.user_id;
        this.passwordHash = data.password_hash || null;
        this.contactNo = data.contactno || null; // NEW
        this.email = data.email || null;         // NEW
    }

    /**
     * Finds a user by their unique user_id.
     */
    static async findById(userId) {
        const query = `SELECT * FROM users WHERE user_id = $1;`;
        const result = await db.query(query, [userId]);
        
        if (result.rows.length === 0) return null;
        return new UserModel(result.rows[0]);
    }

    /**
     * Inserts a new user into the database (Sign Up).
     */
    async save() {
        const query = `
            INSERT INTO users (user_id, username, password_hash, contactno, email)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING user_id, username;
        `;
        const values = [this.userId, this.username, this.passwordHash, this.contactNo, this.email];
        
        const result = await db.query(query, values);
        return new UserModel(result.rows[0]);
    }

    /**
     * Fetches user profile with project statistics.
     * Returns user details along with counts of projects by role.
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    static async getUserProfileWithStats(userId) {
        // Query 1: Get user basic information
        const userQuery = `
            SELECT user_id, username, email, contactno 
            FROM users 
            WHERE user_id = $1;
        `;
        const userResult = await db.query(userQuery, [userId]);

        if (userResult.rows.length === 0) {
            return null;
        }

        const userData = userResult.rows[0];

        // Query 2: Get project statistics grouped by role
        const statsQuery = `
            SELECT 
                user_role,
                COUNT(*) as count
            FROM users_to_project
            WHERE user_id = $1
            GROUP BY user_role;
        `;
        const statsResult = await db.query(statsQuery, [userId]);

        // Process statistics
        const projectStats = {
            total: 0,
            owned: 0,
            analyst: 0,
            viewer: 0
        };

        statsResult.rows.forEach(row => {
            const role = row.user_role.toLowerCase();
            const count = parseInt(row.count, 10);
            
            projectStats.total += count;
            
            if (role === 'owner') {
                projectStats.owned = count;
            } else if (role === 'analyst') {
                projectStats.analyst = count;
            } else if (role === 'viewer') {
                projectStats.viewer = count;
            }
        });

        return {
            user_id: userData.user_id,
            username: userData.username,
            email: userData.email,
            contactno: userData.contactno,
            project_stats: projectStats
        };
    }
}
