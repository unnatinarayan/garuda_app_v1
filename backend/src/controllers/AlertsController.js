// AlertsController.js

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

    }

    /**
     * Express handler to record a new alert based on the request body.
     * Expects: { mapping_id: number, message: object }
     */
    recordAlert = async (req, res, next) => {
        try {
            const payload = req.body;
            // Payload should now only contain mapping_id and message
            if (!payload.mapping_id || !payload.message) {
                 return res.status(400).json({ error: 'Missing required fields: mapping_id or message.' });
            }

            const newAlert = await this.alertsService.recordNewAlert(payload);

            res.status(201).json({
                message: 'Alert successfully recorded.',
                alert: {
                    id: newAlert.id,
                    mapping_id: newAlert.mappingId,
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
