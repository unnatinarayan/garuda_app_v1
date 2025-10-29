// AlertModel.ts

import { DBClient } from '../db/DBClient.ts';
import type { QueryResult } from 'pg';

const db = DBClient.getInstance();

/**
 * Interface representing the structure of a row in the 'alerts' database table.
 */
export interface AlertData {
    id: number;
    project_id: number;
    aoi_id: string; // FK to area_of_interest.id
    algo_id: number; // FK to algorithm_catalogue.id
    message: Record<string, any>;
    alert_timestamp: Date;
}

/**
 * AlertModel: Handles persistence and retrieval logic for the 'alerts' table.
 */
export class AlertModel {
    public id: number | null;
    public projectId: number;
    public aoiId: string;
    public algoId: number;
    public message: Record<string, any>;
    public alertTimestamp: Date | null;

    /**
     * Initializes a new AlertModel instance.
     * @param data - Partial data to initialize the model.
     */
    constructor(data: Partial<AlertData>) {
        this.id = data.id || null;
        this.projectId = data.project_id!;
        this.aoiId = data.aoi_id!;
        this.algoId = data.algo_id!;
        this.message = data.message || {};
        this.alertTimestamp = data.alert_timestamp || null;
    }

    /**
     * Records a new alert in the database.
     * @returns The ID of the newly created alert.
     */
    public async save(): Promise<number> {
        if (!this.projectId || !this.aoiId || !this.algoId) {
            throw new Error("Alert must reference a Project, AOI, and Algorithm.");
        }

        const query = `
            INSERT INTO alerts 
            (project_id, aoi_id, algo_id, message)
            VALUES ($1, $2, $3, $4)
            RETURNING id, alert_timestamp;
        `;
        const values = [
            this.projectId,
            this.aoiId,
            this.algoId,
            this.message
        ];
        
        const result: QueryResult<AlertData> = await db.query(query, values);
        this.id = result.rows[0].id;
        this.alertTimestamp = result.rows[0].alert_timestamp;
        return this.id!;
    }

    /**
     * Fetches all alerts associated with a specific project.
     * @param projectId - The ID of the project.
     * @returns An array of AlertModel instances.
     */
    public static async findByProjectId(projectId: number): Promise<AlertModel[]> {
        const query = `SELECT * FROM alerts WHERE project_id = $1 ORDER BY alert_timestamp DESC;`;
        const result: QueryResult<AlertData> = await db.query(query, [projectId]);

        return result.rows.map(row => new AlertModel(row));
    }
    
    /**
     * Counts the total number of alerts for a given user across all their projects.
     * @param userId - The ID of the user.
     * @returns The total count of alerts.
     */
    public static async countAlertsByUserId(userId: string): Promise<number> {
        const query = `
            SELECT COUNT(a.id)
            FROM alerts a
            JOIN users_to_project up ON a.project_id = up.project_id
            WHERE up.user_id = $1;
        `;
        const result: QueryResult<{ count: string }> = await db.query(query, [userId]);
        
        return parseInt(result.rows[0].count, 10);
    }
}