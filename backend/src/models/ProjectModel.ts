// ProjectModel.ts

import { DBClient } from '../db/DBClient.ts';
import { AreaOfInterestModel } from './AreaOfInterestModel.ts';

const db = DBClient.getInstance();

export interface ProjectData {
    id: number;
    name: string;
    description: string | null;
    creation_timestamp: Date;
    last_modified_timestamp: Date | null; // <-- RENAMED from last_modified_date    
    created_by_userid: string;
    auxdata: Record<string, any> | null; // For JSONB
}

/**
 * ProjectModel: Handles persistence logic for the 'project' table.
 */
export class ProjectModel {
    // Properties matching the database columns
    public id: number | null;
    public projectName: string; // Use internal name that matches the frontend/service DTO
    public description: string | null;
    public createdByUserId: string;
    public auxData: Record<string, any> | null;
    public creationDate: Date | null;
    public lastModifiedDate: Date | null;

    // Transient data for the 4-step process
    public aois: AreaOfInterestModel[] = [];

    constructor(data: Partial<ProjectData>) {
        this.id = data.id || null;
        this.projectName = data.name || ''; // <-- Use 'name' from DB
        this.description = data.description || null;
        this.createdByUserId = data.created_by_userid || '';
        this.auxData = data.auxdata || null;
        this.creationDate = data.creation_timestamp || null; // <-- Use 'creation_timestamp'
        this.lastModifiedDate = data.last_modified_timestamp || null; // <-- Use 'last_modified_timestamp'
    }

    /**
     * Saves a new project to the database.
     * @returns The newly created project ID.
     */
    public async save(userId: string): Promise<number> {
        const query = `
            INSERT INTO project
            (name, description, created_by_userid, auxdata)
            VALUES ($1, $2, $3, $4)
            RETURNING id, creation_timestamp; -- <-- Update column name
        `;
        const values = [
            this.projectName,
            this.description,
            userId,
            this.auxData
        ];

        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        this.creationDate = result.rows[0].creation_timestamp; // <-- Update column name
        return this.id!;
    }


    /**
     * Updates an existing project's basic information.
     * Requires the transaction client for context.
     */
    public async update(client: any): Promise<void> {
        if (!this.id) throw new Error("Cannot update project: ID is missing.");

        const query = `
            UPDATE project
            SET
                name = $1, -- <-- Update column name
                description = $2,
                auxdata = $3,
                last_modified_timestamp = NOW() -- <-- Update column name
            WHERE id = $4
            RETURNING last_modified_timestamp; -- <-- Update column name
        `;
        const values = [
            this.projectName,
            this.description,
            this.auxData,
            this.id
        ];

        // Use the passed client (from ProjectService's transaction)
        const result = await client.query(query, values);
        this.lastModifiedDate = result.rows[0].last_modified_timestamp; // <-- Update column name
    }


    /**
     * Fetches a project by its ID.
     */
    public static async findById(id: number): Promise<ProjectModel | null> {
        const query = `SELECT * FROM project WHERE id = $1;`;
        const result = await db.query<ProjectData>(query, [id]);

        if (result.rows.length === 0) return null;

        // Map the database row to a ProjectModel instance (uses constructor logic)
        return new ProjectModel(result.rows[0]);
    }

    // Add update, delete, and other core methods here...
}