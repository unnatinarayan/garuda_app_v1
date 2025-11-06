// UsersToProjectModel.js

import { DBClient } from '../db/DBClient.js';

const db = DBClient.getInstance();

/**
 * UsersToProjectModel: Handles assigning users to projects with specific roles.
 */
export class UsersToProjectModel {
    id = null;
    userId = null;
    projectId = null;
    userRole = null; // CRITICAL CHANGE: Renamed from 'role' to 'userRole'

    constructor(data) {
        this.id = data.id || null;
        this.userId = data.user_id;
        this.projectId = data.project_id;
        this.userRole = data.user_role; // CRITICAL CHANGE: Uses 'user_role' from DB
    }


    /**
     * Saves a user-to-project role assignment (will UPSERT if the user/project pair exists).
     * @param {object} client - PG client for transaction support.
     */
    async save(client) {
        const query = `
            INSERT INTO users_to_project 
            (user_id, project_id, user_role) -- CRITICAL: Use 'user_role'
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, project_id) 
            DO UPDATE SET user_role = EXCLUDED.user_role -- CRITICAL: Use 'user_role'
            RETURNING id;
        `;
        const values = [this.userId, this.projectId, this.userRole];
        
        const result = await client.query(query, values);
        this.id = result.rows[0].id;
        return this.id;
    }

    /**
     * Deletes all user assignments for a project, excluding a list of users.
     * This handles users that were removed in the frontend UI.
     */
    static async deleteExcludedUsers(client, projectId, userIdsToKeep) {
        const query = `
            DELETE FROM users_to_project 
            WHERE project_id = $1 
            AND user_id NOT IN (SELECT unnest($2::text[]));
        `;
        const result = await client.query(query, [projectId, userIdsToKeep]);
        return result.rowCount;
    }

    

    static async findProjectsByUserId(userId) {
        const query = `SELECT id, user_id, project_id, user_role FROM users_to_project WHERE user_id = $1;`; 
        const result = await db.query(query, [userId]);
        
        return result.rows.map(row => new UsersToProjectModel(row)); // Constructor handles mapping user_role
    }
    
    /**
     * Deletes a user-to-project assignment.
     */
    static async delete(userId, projectId) {
        const query = `DELETE FROM users_to_project WHERE user_id = $1 AND project_id = $2;`;
        const result = await db.query(query, [userId, projectId]);
        return result.rowCount > 0;
    }
}
