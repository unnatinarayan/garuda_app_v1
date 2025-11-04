import { Router } from 'express';

import { AlertsService } from '../services/AlertsService.js';

/**
 * AlertsController: Manages all API endpoints related to alerts.
 */
export class AlertsController {
    router;
    alertsService;

    constructor() {
        this.router = Router();
        this.alertsService = new AlertsService();
        this.initializeRoutes();
    }

    initializeRoutes() {
        // POST /api/alerts - Endpoint to insert a new alert
        this.router.post('/', this.recordAlert);

        // You would add GET/DELETE/etc. routes here later
    }

    /**
     * Express handler to record a new alert based on the request body.
     */
    recordAlert = async (req, res, next) => {
        try {
            // No need for TypeScript casting
            const payload = req.body;

            // Assuming the project_id, aoi_id, and algo_id are valid FKs
            // This relies on the database to throw an error if the FKs are invalid.

            const newAlert = await this.alertsService.recordNewAlert(payload);

            // Respond with the newly created alert details (including the generated ID and timestamp)
            res.status(201).json({
                message: 'Alert successfully recorded.',
                alert: {
                    id: newAlert.id,
                    project_id: newAlert.projectId,
                    aoi_id: newAlert.aoiId, // <-- Use new property name
                    algo_id: newAlert.algoId, // <-- Use new property name
                    message: newAlert.message,
                    alert_timestamp: newAlert.alertTimestamp
                }
            });

        } catch (error) {
            // Pass the error to the Express error handler middleware
            console.error('Error in recordAlert:', error);
            const errorMessage = (error).message;
            // Use 400 for bad data (missing fields, invalid FKs)
            res.status(400).json({ error: errorMessage });
        }
    };
}
