// ProjectModel.ts

import { DBClient } from '../db/DBClient.ts';
import { AreaOfInterestModel } from './AreaOfInterestModel.ts';

const db = DBClient.getInstance();

export interface ProjectData {
    id: number;
    project_name: string;
    description: string | null;
    creation_date: Date;
    last_modified_date: Date | null;
    created_by_userid: string;
    auxdata: Record<string, any> | null; // For JSONB
}

/**
 * ProjectModel: Handles persistence logic for the 'project' table.
 */
export class ProjectModel {
    // Properties matching the database columns
    public id: number | null;
    public projectName: string;
    public description: string | null;
    public createdByUserId: string;
    public auxData: Record<string, any> | null;
    public creationDate: Date | null;
    public lastModifiedDate: Date | null;

    // Transient data for the 4-step process (Frontend uses a separate form class, 
    // but the backend model can hold related data for transaction processing)
    public aois: AreaOfInterestModel[] = []; 

    constructor(data: Partial<ProjectData>) {
        this.id = data.id || null;
        this.projectName = data.project_name || '';
        this.description = data.description || null;
        this.createdByUserId = data.created_by_userid || '';
        this.auxData = data.auxdata || null;
        this.creationDate = data.creation_date || null;
        this.lastModifiedDate = data.last_modified_date || null;
    }

    /**
     * Saves a new project to the database.
     * @returns The newly created project ID.
     */
    public async save(userId: string): Promise<number> {
        const query = `
            INSERT INTO project 
            (project_name, description, created_by_userid, auxdata)
            VALUES ($1, $2, $3, $4)
            RETURNING id, creation_date;
        `;
        const values = [
            this.projectName, 
            this.description, 
            userId, 
            this.auxData
        ];
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        this.creationDate = result.rows[0].creation_date;
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
                project_name = $1, 
                description = $2, 
                auxdata = $3,
                last_modified_date = NOW() -- Set update timestamp
            WHERE id = $4
            RETURNING last_modified_date;
        `;
        const values = [
            this.projectName, 
            this.description, 
            this.auxData, 
            this.id
        ];
        
        // Use the passed client (from ProjectService's transaction)
        const result = await client.query(query, values); 
        this.lastModifiedDate = result.rows[0].last_modified_date;
    }


    /**
     * Fetches a project by its ID.
     */
    public static async findById(id: number): Promise<ProjectModel | null> {
        const query = `SELECT * FROM project WHERE id = $1;`;
        const result = await db.query<ProjectData>(query, [id]);
        
        if (result.rows.length === 0) return null;
        
        // Map the database row to a ProjectModel instance
        return new ProjectModel(result.rows[0]);
    }

    // Add update, delete, and other core methods here...
}