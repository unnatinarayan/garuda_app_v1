import { DBClient } from '../db/DBClient.js';

const db = DBClient.getInstance();

/**
 * UsersToProjectModel: Handles assigning users to projects with specific roles.
 */
export class UsersToProjectModel {
    id = null;
    userId;
    projectId;
    role;

    /**
     * @param {Object} data
     */
    constructor(data) {
        this.id = data.id || null;
        this.userId = data.user_id;
        this.projectId = data.project_id;
        this.role = data.role;
    }


    /**
     * Saves a user-to-project role assignment (will UPSERT if the user/project pair exists).
     * @param {any} client
     * @returns {Promise<number>}
     */
    async save(client) { // Added client for transaction support
        const query = `
            INSERT INTO users_to_project
            (user_id, project_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, project_id)
            DO UPDATE SET role = EXCLUDED.role
            RETURNING id;
        `;
        const values = [this.userId, this.projectId, this.role];
        
        // Use the passed client for transaction context
        const result = await client.query(query, values);
        this.id = result.rows[0].id;
        return this.id;
    }

    /**
     * Deletes all user assignments for a project, excluding a list of users.
     * @param {any} client
     * @param {number} projectId
     * @param {string[]} userIdsToKeep
     * @returns {Promise<number>}
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

    /**
     * Fetches all projects a user is assigned to.
     * @param {string} userId
     * @returns {Promise<UsersToProjectModel[]>}
     */
    static async findProjectsByUserId(userId) {
        const query = `SELECT * FROM users_to_project WHERE user_id = $1;`;
        const result = await db.query(query, [userId]);
        
        return result.rows.map(row => new UsersToProjectModel(row));
    }
    
    /**
     * Deletes a user-to-project assignment.
     * @param {string} userId
     * @param {number} projectId
     * @returns {Promise<boolean>}
     */
    static async delete(userId, projectId) {
        const query = `DELETE FROM users_to_project WHERE user_id = $1 AND project_id = $2;`;
        const result = await db.query(query, [userId, projectId]);
        return result.rowCount > 0;
    }
}
