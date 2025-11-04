import { DBClient } from '../db/DBClient.js';
// REMOVED: import type { QueryResult } from 'pg';

const db = DBClient.getInstance();

/**
 * AlertModel: Handles persistence and retrieval logic for the 'alerts' table.
 */
export class AlertModel {
    id = null;
    projectId;
    aoiId;
    algoId;
    message = {};
    alertTimestamp = null;

    /**
     * Initializes a new AlertModel instance.
     * @param {Object} data - Partial data to initialize the model.
     */
    constructor(data) {
        this.id = data.id || null;
        this.projectId = data.project_id;
        this.aoiId = data.aoi_id;
        this.algoId = data.algo_id;
        this.message = data.message || {};
        this.alertTimestamp = data.alert_timestamp || null;
    }

    /**
     * Records a new alert in the database.
     * @returns {Promise<number>} The ID of the newly created alert.
     */
    async save() {
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
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        this.alertTimestamp = result.rows[0].alert_timestamp;
        return this.id;
    }

    /**
     * Fetches all alerts associated with a specific project.
     * @param {number} projectId - The ID of the project.
     * @returns {Promise<AlertModel[]>} An array of AlertModel instances.
     */
    static async findByProjectId(projectId) {
        const query = `SELECT * FROM alerts WHERE project_id = $1 ORDER BY alert_timestamp DESC;`;
        const result = await db.query(query, [projectId]);

        return result.rows.map(row => new AlertModel(row));
    }
    
    /**
     * Counts the total number of alerts for a given user across all their projects.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<number>} The total count of alerts.
     */
    static async countAlertsByUserId(userId) {
        const query = `
            SELECT COUNT(a.id)
            FROM alerts a
            JOIN users_to_project up ON a.project_id = up.project_id
            WHERE up.user_id = $1;
        `;
        const result = await db.query(query, [userId]);
        
        return parseInt(result.rows[0].count, 10);
    }
}
