// UsersToProjectModel.ts

import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface UsersToProjectData {
    id: number;
    user_id: string;
    project_id: number;
    role: 'owner' | 'analyst' | 'viewer' | string; // Define valid roles
}

/**
 * UsersToProjectModel: Handles assigning users to projects with specific roles.
 */
export class UsersToProjectModel {
    public id: number | null;
    public userId: string;
    public projectId: number;
    public role: string;

    constructor(data: Partial<UsersToProjectData>) {
        this.id = data.id || null;
        this.userId = data.user_id!;
        this.projectId = data.project_id!;
        this.role = data.role!;
    }



    /**
     * Saves a user-to-project role assignment (will UPSERT if the user/project pair exists).
     */
    public async save(client: any): Promise<number> { // Added client for transaction support
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
        return this.id!;
    }

    /**
     * Deletes all user assignments for a project, excluding a list of users.
     * This handles users that were removed in the frontend UI.
     */
    public static async deleteExcludedUsers(client: any, projectId: number, userIdsToKeep: string[]): Promise<number> {
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
     */
    public static async findProjectsByUserId(userId: string): Promise<UsersToProjectModel[]> {
        const query = `SELECT * FROM users_to_project WHERE user_id = $1;`;
        const result = await db.query<UsersToProjectData>(query, [userId]);
        
        return result.rows.map(row => new UsersToProjectModel(row));
    }
    
    /**
     * Deletes a user-to-project assignment.
     */
    public static async delete(userId: string, projectId: number): Promise<boolean> {
        const query = `DELETE FROM users_to_project WHERE user_id = $1 AND project_id = $2;`;
        const result = await db.query(query, [userId, projectId]);
        return result.rowCount > 0;
    }
}