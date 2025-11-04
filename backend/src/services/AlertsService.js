import { AlertModel } from '../models/AlertModel.js';

/**
 * AlertsService: Manages business logic related to alerts.
 */
export class AlertsService {

    /**
     * Records a new alert using the data provided in the API request body.
     * @param {Object} payload - The alert data from the incoming API request.
     * @returns {Promise<AlertModel>} The newly created AlertModel instance.
     */
    async recordNewAlert(payload) {

        // Input validation (basic check)
        if (!payload.project_id || !payload.aoi_id || !payload.algo_id || !payload.message) {
            throw new Error("Missing required fields for alert: project_id, aoi_id, algo_id, or message.");
        }

        // Create an instance of the model
        const newAlert = new AlertModel({
            project_id: payload.project_id,
            aoi_id: payload.aoi_id, // <-- Use new name
            algo_id: payload.algo_id, // <-- Use new name
            message: payload.message,
            // 'id' and 'alert_timestamp' are intentionally left out, to be set by .save()
        });

        // Save the alert to the database
        await newAlert.save();

        // Return the complete model instance with the generated ID and timestamp
        return newAlert;
    }
}
