// AlertModel.js

import { DBClient } from '../db/DBClient.js';

const db = DBClient.getInstance();

/**
 * AlertModel: Handles persistence and retrieval logic for the 'alerts' table.
 * Now links directly to aoi_algorithm_mapping via mapping_id.
 */
export class AlertModel {
    id = null;
    message = {};
    alertTimestamp = null;
    mappingId = null; // NEW: FK to aoi_algorithm_mapping.id

    /**
     * Initializes a new AlertModel instance.
     * @param {object} data - Data to initialize the model.
     */
    constructor(data) {
        this.id = data.id || null;
        this.message = data.message || {};
        this.alertTimestamp = data.alert_timestamp || null;
        this.mappingId = data.mapping_id || null; // NEW
    }

    /**
     * Records a new alert in the database.
     * @returns {Promise<number>} The ID of the newly created alert.
     */
    async save() {
        if (!this.mappingId || !this.message) {
            throw new Error("Alert must reference a Mapping ID and contain a message.");
        }

        const query = `
            INSERT INTO alerts 
            (mapping_id, message, alert_timestamp) 
            VALUES ($1, $2, NOW())
            RETURNING id, alert_timestamp;
        `;
        const values = [
            this.mappingId,
            this.message
        ];
        
        const result = await db.query(query, values);
        this.id = result.rows[0].id;
        this.alertTimestamp = result.rows[0].alert_timestamp;
        return this.id;
    }

    /**
     * Counts the total number of alerts for a given user across all their projects.
     * Requires joining users_to_project -> aoi_algorithm_mapping -> alerts.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<number>} The total count of alerts.
     */
    static async countAlertsByUserId(userId) {
        const query = `
            SELECT COUNT(a.id)
            FROM alerts a
            JOIN aoi_algorithm_mapping aam ON a.mapping_id = aam.id
            JOIN users_to_project up ON aam.project_id = up.project_id
            WHERE up.user_id = $1;
        `;
        const result = await db.query(query, [userId]);
        
        return parseInt(result.rows[0].count, 10);
    }
}
