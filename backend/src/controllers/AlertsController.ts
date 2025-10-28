// backend/src/controllers/AlertsController.ts

import { Router } from 'express'; 

// which handles the difference between CommonJS and ES Modules better.
import type { Request, Response, NextFunction } from 'express'; 

import { AlertsService } from '../services/AlertsService.ts';
import type { NewAlertPayload } from '../services/AlertsService.ts';

/**
 * AlertsController: Manages all API endpoints related to alerts.
 */
export class AlertsController {
    public router: Router;
    private alertsService: AlertsService;

    constructor() {
        this.router = Router();
        this.alertsService = new AlertsService();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // POST /api/alerts - Endpoint to insert a new alert
        this.router.post('/', this.recordAlert);
        
        // You would add GET/DELETE/etc. routes here later
    }

    /**
     * Express handler to record a new alert based on the request body.
     */
    private recordAlert = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // TypeScript casting for clarity, matching the service interface
            const payload: NewAlertPayload = req.body; 

            // Assuming the project_id, aoi_fk_id, and algo_fk_id are valid FKs 
            // This relies on the database to throw an error if the FKs are invalid.

            const newAlert = await this.alertsService.recordNewAlert(payload);

            // Respond with the newly created alert details (including the generated ID and timestamp)
            res.status(201).json({ 
                message: 'Alert successfully recorded.',
                alert: {
                    id: newAlert.id,
                    project_id: newAlert.projectId,
                    aoi_fk_id: newAlert.aoiFkId,
                    algo_fk_id: newAlert.algoFkId,
                    message: newAlert.message,
                    alert_timestamp: newAlert.alertTimestamp
                }
            });

        } catch (error) {
            // Pass the error to the Express error handler middleware
            console.error('Error in recordAlert:', error);
            const errorMessage = (error as Error).message;
            // Use 400 for bad data (missing fields, invalid FKs)
            res.status(400).json({ error: errorMessage });
        }
    };
}