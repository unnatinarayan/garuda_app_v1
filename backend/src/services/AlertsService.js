// AlertsService.js

import { AlertModel } from '../models/AlertModel.js';

/**
 * Defines the simplified payload structure from the API now using mapping_id.
 * @typedef {object} NewAlertPayload
 * @property {number} mapping_id - FK to aoi_algorithm_mapping.id
 * @property {object} message - The alert message JSONB.
 */


/**
 * AlertsService: Manages business logic related to alerts.
 */
export class AlertsService {

    /**
     * Records a new alert using the data provided in the API request body.
     * @param {object} payload - The alert data from the incoming API request.
     * @returns {Promise<AlertModel>} The newly created AlertModel instance.
     */
    async recordNewAlert(payload) {

        // Input validation (basic check)
        if (!payload.mapping_id || !payload.message) {
            throw new Error("Missing required fields for alert: mapping_id or message.");
        }

        // Create an instance of the model
        const newAlert = new AlertModel({
            mapping_id: payload.mapping_id,
            message: payload.message,
        });

        // Save the alert to the database
        await newAlert.save();

        // Return the complete model instance with the generated ID and timestamp
        return newAlert;
    }
}
