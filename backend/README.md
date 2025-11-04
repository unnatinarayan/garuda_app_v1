"@swc/core": "^1.13.5",
    "@swc/helpers": "^0.5.17",
    "@types/express": "^5.0.3",
    "@types/node": "^24.8.1",
    "@types/pg": "^8.15.5",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"

    


I have a project named, garuda_app_v1 with two directories backend and frontend. The backend is in typescript and frontend is in vue.js with typescript all in node.js env. now i am facing many issues while setting this project in other systems so i have decided to change the typecript to javascript and vue.js will remain as it it. this project is operational with database configuaration so just help me to reconfigure this without any change in flow or operation. below is the project structure and the codes of files. if you will notice that if changed then whole project may break then inform me. 
garuda_app_v1
└── 📁frontend
    └── 📁.vscode
        ├── extensions.json
    └── 📁public
        ├── garuda.png
    └── 📁src
        └── 📁api
            ├── ApiClient.ts
        └── 📁assets
            ├── garuda.png
        └── 📁classes
            ├── AreaOfInterestDraft.ts
            ├── ProjectFormData.ts
            ├── UserSession.ts
        └── 📁components
            └── 📁auth
                ├── LoginForm.vue
            └── 📁common
                ├── NotificationDropdown.vue
            └── 📁map
                ├── MapVisualization.vue
            └── 📁steps
                ├── Step1BasicInfo.vue
                ├── Step2DefineAOI.vue
                ├── Step3AlgoMapping.vue
                ├── Step4AddUsers.vue
        └── 📁router
            ├── index.ts
        └── 📁stores
            ├── ProjectStore.ts
        └── 📁types
            ├── ProjectTypes.ts
        └── 📁views
            ├── ConfigureProjectUI.vue
            ├── DisplayProjectUI.vue
            ├── HomeViewUI.vue
            ├── MonitorMapView.vue
        ├── App.vue
        ├── main.ts
        ├── style.css
    ├── .gitignore
    ├── index.html
    ├── package.json
    ├── tsconfig.app.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    └── vite.config.ts
└── 📁backend
    └── 📁src
        └── 📁controllers
            ├── AlertsController.ts
            ├── AuthController.ts
            ├── ProjectController.ts
        └── 📁db
            ├── DBClient.ts
        └── 📁models
            ├── AlertModel.ts
            ├── AlgorithmCatalogueModel.ts
            ├── AoiAlgorithmMappingModel.ts
            ├── AreaOfInterestModel.ts
            ├── ProjectModel.ts
            ├── UserModel.ts
            ├── UsersToProjectModel.ts
        └── 📁services
            ├── AlertsService.ts
            ├── AlertsSSEService.ts
            ├── ProjectService.ts
        └── 📁types
            ├── GeoJson.ts
        ├── App.ts
        ├── server.ts
    ├── .env
    ├── package.json
    └── tsconfig.json

below are the backend files

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
            const errorMessage = (error as Error).message;
            // Use 400 for bad data (missing fields, invalid FKs)
            res.status(400).json({ error: errorMessage });
        }
    };
}





// ProjectController.ts
import { Router } from 'express';

import type { Request, Response, NextFunction } from 'express';

import { ProjectService } from '../services/ProjectService.ts';
import type { ProjectCreationBundle } from '../services/ProjectService.ts';
/**
 * ProjectController: Handles routing and HTTP request/response logic for projects.
 */
export class ProjectController {
    public router: Router;
    private projectService: ProjectService;

    constructor() {
        this.router = Router();
        this.projectService = new ProjectService();
        this.initializeRoutes();
    }

    private initializeRoutes() {
    this.router.post('/', this.createProject);          // POST /api/projects
    this.router.get('/', this.getProjectsByUser);       // GET /api/projects
    this.router.get('/algorithms', this.getAlgorithmCatalogue); // GET /api/projects/algorithms
    this.router.get('/:id', this.getProjectDetails);    // GET /api/projects/:id
    this.router.put('/:id', this.updateProject);         // PUT /api/projects/:id (Update)
    this.router.delete('/:id', this.deleteProject);     // DELETE /api/projects/:id
};

    /**
     * POST /api/projects
     * Handles the final submission of the 4-step project creation form.
     */
    public createProject = async (req: Request, res: Response): Promise<Response> => {
        // NOTE: In this single-user simulation, we hardcode the userId from the simple login
        const currentUserId = req.header('X-User-ID') || 'user123'; // Assume header is set after login

        const projectBundle: ProjectCreationBundle = req.body;

        try {
            // Service handles the transaction logic
            const newProject = await this.projectService.createProject(projectBundle, currentUserId);

            return res.status(201).json({
                message: 'Project created successfully across all tables.',
                project: newProject
            });
        } catch (error) {
            console.error('Controller Error during project creation:', error);
            // Send a generic error response to the client
            return res.status(500).json({
                error: 'Failed to create project.',
                details: (error as Error).message
            });
        }
    }
    /**
     * GET /api/projects
     * Fetches all projects the current user is involved in (for HomeViewUI: Manage/Monitor)
     */
    public getProjectsByUser = async (req: Request, res: Response): Promise<Response> => {
        const currentUserId = req.header('X-User-ID') || 'user123';

        try {
            const projects = await this.projectService.getUserProjects(currentUserId);
            return res.status(200).json(projects);
        } catch (error) {
            console.error('Controller Error fetching projects:', error);
            return res.status(500).json({ error: 'Failed to fetch user projects.' });
        }
    }
 
    public getProjectDetails = async (req: Request, res: Response): Promise<Response> => {
        const projectIdParam = req.params.id;
        const projectId = parseInt(projectIdParam);

        // CRITICAL FIX: Validate that projectId is a number before passing it to the service
        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Invalid Project ID format.' });
        }
        try {
            const details = await this.projectService.getProjectDetails(projectId);

            if (!details) {
                return res.status(404).json({ message: 'Project not found.' });
            }
            // Check if user has permission (can be added here using a lookup in UsersToProjectModel)

            return res.status(200).json(details);
        } catch (error) {
            console.error('Controller Error fetching project details:', error);
            return res.status(500).json({ error: 'Failed to fetch project details.' });
        }
    }

    /**
     * DELETE /api/projects/:id
     * Deletes a project and all associated data.
     */
    public deleteProject = async (req: Request, res: Response): Promise<Response> => {
        const projectId = parseInt(req.params.id);
        // Note: A security check should be added here to ensure the user is the 'owner'

        try {
            const success = await this.projectService.deleteProject(projectId);

            if (success) {
                return res.status(204).send(); // 204 No Content is standard for successful deletion
            } else {
                return res.status(404).json({ message: 'Project not found or already deleted.' });
            }
        } catch (error) {
            console.error('Controller Error deleting project:', error);
            return res.status(500).json({ error: 'Failed to delete project.' });
        }
    }

    public getAlgorithmCatalogue = async (req: Request, res: Response): Promise<Response> => {
        try {
            const algorithms = await this.projectService.getAlgorithmCatalogue();
            return res.status(200).json(algorithms);
        } catch (error) {
            console.error('Controller Error fetching algorithms:', error);
            return res.status(500).json({ error: 'Failed to fetch algorithm catalogue.' });
        }
    }

    /**
     * PUT /api/projects/:id
     * Handles the final submission of the 4-step project update form.
     */
    public updateProject = async (req: Request, res: Response): Promise<Response> => {
        const projectIdParam = req.params.id;
        const projectId = parseInt(projectIdParam);
        const currentUserId = req.header('X-User-ID') || 'user123'; 

        if (isNaN(projectId)) {
             return res.status(400).json({ message: 'Invalid Project ID format.' });
        }
        
        const projectBundle: ProjectCreationBundle = req.body;

        try {
            const updatedProject = await this.projectService.updateProject(
                projectId, 
                projectBundle, 
                currentUserId
            );

            return res.status(200).json({
                message: 'Project updated successfully across all tables.',
                project: updatedProject
            });
        } catch (error) {
            console.error('Controller Error during project update:', error);
            // Use 404 for not found, 400 for bad requests, 500 for generic server errors
            const statusCode = (error as Error).message.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                error: 'Failed to update project.',
                details: (error as Error).message
            });
        }
    }
}




// AuthController.ts

import { Router } from 'express';
import type { Request, Response } from 'express';
import { UserModel } from '../models/UserModel.ts'; // <-- NEW IMPORT
/**
 * AuthController: Handles user login and signup using the database.
 */
export class AuthController {
    public router: Router;

    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post('/login', this.login); 
        this.router.post('/signup', this.signup); // <-- NEW SIGNUP ROUTE
    }

    /**
     * POST /api/auth/login - Checks credentials against the users table.
     */
    public login = async (req: Request, res: Response): Promise<Response> => {
        const { username, password } = req.body;
        const userId = username; // Assume userId is the same as the username/email for login

        try {
            const user = await UserModel.findById(userId);

            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid credentials or user not found.' });
            }

            // CRITICAL: Simple plain text password check (replace with bcrypt in production)
            if (user.passwordHash !== password) {
                return res.status(401).json({ success: false, message: 'Invalid credentials.' });
            }

            return res.status(200).json({ 
                success: true, 
                userId: user.userId,
                username: user.username,
                message: 'Login successful'
            });
        } catch (error) {
            console.error('Login Error:', error);
            return res.status(500).json({ success: false, message: 'Server error during login.' });
        }
    }

    /**
     * POST /api/auth/signup - Creates a new user in the users table.
     */
    public signup = async (req: Request, res: Response): Promise<Response> => {
        const { username, password } = req.body;
        const userId = username; // Use username as the unique user_id for simplicity

        // Simple validation
        if (!username || !password || username.length < 3 || password.length < 3) {
            return res.status(400).json({ success: false, message: 'Username and password must be at least 3 characters long.' });
        }

        try {
            // Check if user already exists
            const existingUser = await UserModel.findById(userId);
            if (existingUser) {
                return res.status(409).json({ success: false, message: 'User already exists.' });
            }

            // Create new user (password is stored as plain text for now)
            const newUser = new UserModel({
                user_id: userId,
                username: username,
                password_hash: password // Plain text password for mock hash
            });
            await newUser.save();

            return res.status(201).json({ 
                success: true, 
                userId: newUser.userId,
                username: newUser.username,
                message: 'Signup successful. Please log in.'
            });
        } catch (error) {
            console.error('Signup Error:', error);
            if (error.code === '23505') {
                 return res.status(409).json({ success: false, message: 'User already exists (unique constraint violation).' });
            }
            return res.status(500).json({ success: false, message: 'Server error during signup.' });
        }
    }
}




// backend/src/db/DBClient.ts

import { Pool } from 'pg';
import type { QueryResult } from 'pg';

import * as dotenv from 'dotenv';

dotenv.config();

// Singleton class for managing the PostgreSQL connection pool
export class DBClient {
    private static instance: DBClient;
    // CRITICAL: Make the pool public so ProjectService can manage transactions
    public pool: Pool; 

    private constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Non-transactional queries might fail, but let's not exit the process for a single error
            // process.exit(-1); // Removed to keep the server running unless fatal
        });
        console.log('Database Pool Initialized.');
    }

    public static getInstance(): DBClient {
        if (!DBClient.instance) {
            DBClient.instance = new DBClient();
        }
        return DBClient.instance;
    }

    // Generic method to execute SQL queries (used outside of transactions)
    public async query<T>(text: string, params: any[] = []): Promise<QueryResult<T>> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}




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




// AlgorithmCatalogueModel.ts
import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface AlgorithmCatalogueData {
    id: number;
    algo_id: string;
    args: Record<string, any> | null;
    description: string | null;
    category: string | null;
}

/**
 * AlgorithmCatalogueModel: Provides read-only access to the available algorithms.
 */
export class AlgorithmCatalogueModel {
    public id: number | null;
    public algoId: string;
    public defaultArgs: Record<string, any> | null;
    public description: string | null;
    public category: string | null;

    constructor(data: Partial<AlgorithmCatalogueData>) {
        this.id = data.id || null;
        this.algoId = data.algo_id || '';
        this.defaultArgs = data.args ?? null; 
        this.description = data.description ?? null;
        this.category = data.category ?? null;
    }

    /**
     * Fetches all algorithms from the catalogue.
     */
    public static async findAll(): Promise<AlgorithmCatalogueModel[]> {
        const query = `SELECT * FROM algorithm_catalogue ORDER BY category, algo_id;`;
        // Check 1: Ensure DB is connected and this query runs without error in your PG console.
        const result = await db.query<AlgorithmCatalogueData>(query);

        return result.rows.map(row => new AlgorithmCatalogueModel(row));
    }

    /**
     * Fetches a single algorithm by its unique string ID.
     */
    public static async findByAlgoId(algoId: string): Promise<AlgorithmCatalogueModel | null> {
        const query = `SELECT * FROM algorithm_catalogue WHERE algo_id = $1;`;
        const result = await db.query<AlgorithmCatalogueData>(query, [algoId]);

        if (result.rows.length === 0) return null;
        return new AlgorithmCatalogueModel(result.rows[0]);
    }
}



// AoiAlgorithmMappingModel


import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface AoiAlgorithmMappingData {
    id: number;
    project_id: number; // <-- NEW
    aoi_id: string; // <-- Changed type from number (AOI PK) to string (AOI ID)
    change_algo_id: string; // <-- Changed from number (Algo PK) to string (Algo ID)
    change_algo_configured_args: Record<string, any> | null; // <-- Renamed
}

/**
 * AoiAlgorithmMappingModel: Handles the mapping between AOI and Algorithm, 
 * including configuration arguments.
 */
export class AoiAlgorithmMappingModel {
    public id: number | null;
    public projectId: number; // <-- NEW
    public aoiId: string; // FK to area_of_interest.aoi_id (string)
    public algoId: string; // FK to algorithm_catalogue.algo_id (string)
    public configArgs: Record<string, any> | null;

    constructor(data: Partial<AoiAlgorithmMappingData>) {
        this.id = data.id || null;
        this.projectId = data.project_id!; // <-- NEW
        this.aoiId = data.aoi_id!;
        this.algoId = data.change_algo_id!;
        this.configArgs = data.change_algo_configured_args || null; // <-- Renamed property
    }


    /**
     * Deletes all mappings associated with a project's AOIs.
     * This is no longer necessary since we use CASCADE DELETE on the project table,
     * but the old logic is kept for reference or if the schema changes.
     */
    public static async deleteByProjectId(client: any, projectId: number): Promise<number> {
        const query = `
             DELETE FROM aoi_algorithm_mapping
             WHERE project_id = $1; -- Use project_id directly
        `;
        const result = await client.query(query, [projectId]);
        return result.rowCount;
    }

    /**
     * Saves a single AOI-Algorithm mapping.
     */
    public async save(): Promise<number> {
        // NOTE: The separate save method for AoiAlgorithmMappingModel might be redundant
        // if the insertion logic is done directly in ProjectService, which is preferred
        // for transaction safety. This method is kept as a minimal implementation
        // but it's not currently used in the main ProjectService flow.

        const query = `
            INSERT INTO aoi_algorithm_mapping
            (project_id, aoi_id, change_algo_id, change_algo_configured_args) -- <-- New column names
            VALUES ($1, $2, $3, $4)
            -- You would need a unique constraint on (project_id, aoi_id, change_algo_id) for ON CONFLICT
            -- Assuming the unique constraint is set up in the ProjectService transaction instead.
            RETURNING id;
        `;
        const values = [
            this.projectId,
            this.aoiId,
            this.algoId,
            this.configArgs
        ];

        const result = await db.query(query, values); // Note: This should ideally use a client
        this.id = result.rows[0].id;
        return this.id!;
    }

    // Add static methods for fetching mappings by aoiId or algoId...
}






//AreaOfInterestModel.ts

import { DBClient } from '../db/DBClient.ts';
import type { GeoJsonPolygon } from '../types/GeoJson.ts'; // We will define this type below

const db = DBClient.getInstance();

export interface AreaOfInterestData {
    id: number;
    project_id: number;
    aoi_id: string;
    name: string;
    geom: string; // Stored as GEOMETRY in DB, handled as GeoJSON string/object here
    auxdata: Record<string, any> | null; // <-- Removed publish_flag
    geom_properties: Record<string, any> | null;
}

/**
 * AreaOfInterestModel: Handles persistence logic for the 'area_of_interest' table.
 */
export class AreaOfInterestModel {
    public id: number | null;
    public projectId: number;
    public aoiId: string;
    public name: string;
    public geomGeoJson: GeoJsonPolygon; // Frontend will pass GeoJSON Polygon object
    public auxData: Record<string, any> | null;
    public geomProperties: Record<string, any> | null; // <-- Removed publishFlag

    constructor(data: Partial<AreaOfInterestData> & { geomGeoJson?: GeoJsonPolygon, projectId: number }) {
        this.id = data.id || null;
        this.projectId = data.project_id || data.projectId;
        this.aoiId = data.aoi_id || '';
        this.name = data.name || '';
        // NOTE: In a full app, you'd convert DB string representation back to GeoJSON object
        this.geomGeoJson = data.geomGeoJson as GeoJsonPolygon;
        this.auxData = data.auxdata || null;
        this.geomProperties = data.geom_properties || null;
    }


    /**
     * Saves a single AOI to the database (for NEW projects).
     * The geometry is converted from GeoJSON string to PostGIS GEOMETRY.
     */
    public async save(client: any): Promise<number> {
        if (!this.projectId) throw new Error("AOI must be tied to an existing Project.");

        const query = `
            INSERT INTO area_of_interest
            (project_id, aoi_id, name, geom, auxdata, geom_properties) -- <-- Removed publish_flag
            VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6)
            RETURNING id;
        `;
        const geomString = JSON.stringify(this.geomGeoJson);

        const values = [
            this.projectId,
            this.aoiId,
            this.name,
            geomString,
            this.auxData,
            this.geomProperties
        ];

        // Use the passed client for transaction context
        const result = await client.query(query, values);
        this.id = result.rows[0].id;
        return this.id!;
    }

    /**
     * Deletes all AOIs associated with a project ID.
     * This is used during an UPDATE to clear existing AOIs before re-inserting the new list.
     * @returns The number of rows deleted.
     */
    public static async deleteByProjectId(client: any, projectId: number): Promise<number> {
        const query = `DELETE FROM area_of_interest WHERE project_id = $1;`;
        const result = await client.query(query, [projectId]);
        return result.rowCount;
    }


    /**
     * Fetches all AOIs for a specific project.
     */
    public static async findByProjectId(projectId: number): Promise<AreaOfInterestModel[]> {
        // NOTE: We use ST_AsGeoJSON to retrieve the geometry in a usable format for the frontend
        const query = `
            SELECT
                id, project_id, aoi_id, name, auxdata, geom_properties, -- <-- Removed publish_flag
                ST_AsGeoJSON(geom) AS geom_geojson_string
            FROM area_of_interest
            WHERE project_id = $1;
        `;
        const result = await db.query(query, [projectId]);

        return result.rows.map(row => new AreaOfInterestModel({
            ...row,
            geomGeoJson: JSON.parse(row.geom_geojson_string), // Parse the GeoJSON string back to object
            project_id: row.project_id // Ensure projectId is passed
        }));
    }

    /**
     * Fetches all mapped algorithms and their configurations for this AOI.
     */
    public async getMappedAlgorithms(client: any): Promise<any[]> {
        // CRITICAL: Now joins using the aoi_id (text) and project_id (int) as join keys.
        // Also joins to algorithm_catalogue using algo_id (text) instead of id (int).
        const query = `
            SELECT
                aam.id as mapping_id,
                aam.change_algo_configured_args as config_args, -- <-- Corrected column name
                ac.algo_id,
                ac.description,
                ac.category,
                ac.id as algo_pk_id -- Included the PK 'id' for frontend convenience
            FROM aoi_algorithm_mapping aam
            -- Join condition: aoi_algorithm_mapping uses project_id and aoi_id for linkage
            JOIN area_of_interest aoi ON aam.project_id = aoi.project_id AND aam.aoi_id = aoi.aoi_id
            -- Join to algorithm catalogue using the algo_id (text)
            JOIN algorithm_catalogue ac ON aam.change_algo_id = ac.algo_id
            -- Filter by the current AOI's aoi_id and project_id for specificity
            WHERE aam.project_id = $1 AND aam.aoi_id = $2;
        `;
        // Use the passed client for transaction context (important for reuse)
        const result = await client.query(query, [this.projectId, this.aoiId]); // Use projectId and aoiId (string)
        return result.rows;
    }

    // Add update, delete, and other core methods here... to be completed
}



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




// backend/src/models/UserModel.ts

import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface UserData {
    user_id: string;
    username: string | null;
    password_hash: string | null;
}

/**
 * UserModel: Handles persistence logic for the 'users' table.
 */
export class UserModel {
    public userId: string;
    public username: string | null;
    public passwordHash: string | null;

    constructor(data: UserData) {
        this.userId = data.user_id;
        this.username = data.username || data.user_id;
        // In a real app, the hash should be stored/validated securely
        this.passwordHash = data.password_hash || null; 
    }

    /**
     * Finds a user by their unique user_id.
     */
    public static async findById(userId: string): Promise<UserModel | null> {
        const query = `SELECT user_id, username, password_hash FROM users WHERE user_id = $1;`;
        const result = await db.query<UserData>(query, [userId]);
        
        if (result.rows.length === 0) return null;
        return new UserModel(result.rows[0]);
    }

    /**
     * Inserts a new user into the database (Sign Up).
     */
    public async save(): Promise<UserModel> {
        const query = `
            INSERT INTO users (user_id, username, password_hash)
            VALUES ($1, $2, $3)
            RETURNING user_id, username;
        `;
        // NOTE: We use userId as the user_id for simplicity, and passwordHash is used for the plain text password check for now.
        const values = [this.userId, this.username, this.passwordHash];
        
        const result = await db.query(query, values);
        return new UserModel(result.rows[0]);
    }
}




// UsersToProjectModel.ts

import { DBClient } from '../db/DBClient.ts';

const db = DBClient.getInstance();

export interface UsersToProjectData {
    id: number;
    user_id: string;
    project_id: number;
    role: 'owner' | 'analyst' | 'viewer' | string; // Define valid roles
}

/**
 * UsersToProjectModel: Handles assigning users to projects with specific roles.
 */
export class UsersToProjectModel {
    public id: number | null;
    public userId: string;
    public projectId: number;
    public role: string;

    constructor(data: Partial<UsersToProjectData>) {
        this.id = data.id || null;
        this.userId = data.user_id!;
        this.projectId = data.project_id!;
        this.role = data.role!;
    }



    /**
     * Saves a user-to-project role assignment (will UPSERT if the user/project pair exists).
     */
    public async save(client: any): Promise<number> { // Added client for transaction support
        const query = `
            INSERT INTO users_to_project 
            (user_id, project_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, project_id) 
            DO UPDATE SET role = EXCLUDED.role 
            RETURNING id;
        `;
        const values = [this.userId, this.projectId, this.role];
        
        // Use the passed client for transaction context
        const result = await client.query(query, values);
        this.id = result.rows[0].id;
        return this.id!;
    }

    /**
     * Deletes all user assignments for a project, excluding a list of users.
     * This handles users that were removed in the frontend UI.
     */
    public static async deleteExcludedUsers(client: any, projectId: number, userIdsToKeep: string[]): Promise<number> {
        const query = `
            DELETE FROM users_to_project 
            WHERE project_id = $1 
            AND user_id NOT IN (SELECT unnest($2::text[]));
        `;
        const result = await client.query(query, [projectId, userIdsToKeep]);
        return result.rowCount;
    }

    /**
     * Fetches all projects a user is assigned to.
     */
    public static async findProjectsByUserId(userId: string): Promise<UsersToProjectModel[]> {
        const query = `SELECT * FROM users_to_project WHERE user_id = $1;`;
        const result = await db.query<UsersToProjectData>(query, [userId]);
        
        return result.rows.map(row => new UsersToProjectModel(row));
    }
    
    /**
     * Deletes a user-to-project assignment.
     */
    public static async delete(userId: string, projectId: number): Promise<boolean> {
        const query = `DELETE FROM users_to_project WHERE user_id = $1 AND project_id = $2;`;
        const result = await db.query(query, [userId, projectId]);
        return result.rowCount > 0;
    }
}





// backend/src/services/AlertsService.ts



// backend/src/services/AlertsService.ts

import { AlertModel } from '../models/AlertModel.ts';
import type { AlertData } from '../models/AlertModel.ts';


export interface NewAlertPayload {
    project_id: number;
    aoi_id: string; // <-- RENAMED
    algo_id: number; // <-- RENAMED (PK 'id' from algorithm_catalogue)
    message: Record<string, any>;
}


/**
 * AlertsService: Manages business logic related to alerts.
 */
export class AlertsService {

    /**
     * Records a new alert using the data provided in the API request body.
     * @param payload - The alert data from the incoming API request.
     * @returns The newly created AlertModel instance.
     */
    public async recordNewAlert(payload: NewAlertPayload): Promise<AlertModel> {

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



// backend/src/services/AlertsSSEService.ts

import type { Express, Request, Response } from 'express';
import { Kafka } from 'kafkajs';
import { createClient } from '@redis/client';
import { DBClient } from '../db/DBClient.ts'; // Used to look up which users are assigned to a project

// --- CONFIGURATION ---
// The Kafka topic name where PostgreSQL (via Debezium/CDC) publishes new 'alerts' records.
const KAFKA_TOPIC = 'dbserver1.public.alerts';
// Group ID for the Kafka consumer, ensures messages aren't processed by other instances.
const KAFKA_GROUP_ID = 'garuda-alerts-group';
// Connection URL for Redis (used for alert caching/history).
const REDIS_URL = 'redis://localhost:6379';
// List of Kafka broker addresses.
const KAFKA_BROKERS = ['localhost:9092'];
// ---

// Map to hold **active HTTP connections** (Server-Sent Events) for each logged-in user.
// Key: userId, Value: Array of Express Response objects (one for each open browser tab).
type SSEClientMap = { [userId: string]: Response[] };
let sseClients: SSEClientMap = {};

// Initialize the Redis client.
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Initialize the Kafka client and configure retries for robustness.
const kafka = new Kafka({
    clientId: 'garuda-alert-consumer',
    brokers: KAFKA_BROKERS,
    retry: {
        initialRetryTime: 1000,
        retries: 50, // Keep trying to connect to the Kafka broker
    }
});
// Create the Kafka consumer instance that belongs to a group.
const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
const db = DBClient.getInstance(); // Get the single database connection pool instance

/**
 * Sends a notification object instantly to any client (browser tab) currently connected 
 * via the SSE stream for a specific user.
 */
function sendToSSEClient(userId: string, notification: Record<string, any>): void {
    const clients = sseClients[userId];
    // Format the message according to the Server-Sent Events specification: 'data: {payload}\n\n'
    const notifString = `data: ${JSON.stringify(notification)}\n\n`;

    if (clients && clients.length > 0) {
        console.log(`SSE: Sending alert to ${clients.length} clients for user ${userId}`);
        clients.forEach(client => {
            client.write(notifString); // Push data instantly to the browser
        });
    } else {
        // If the user is offline, the alert is only saved in Redis (Step 4)
        console.log(`SSE: User ${userId} is offline. Alert stored in Redis.`);
    }
}

/**
 * Kafka consumer logic. This is the heart of the real-time system.
 * It constantly pulls new alert messages from the Kafka topic, identifies recipients,
 * caches the alert in Redis, and pushes it via SSE.
 */
async function runKafkaConsumer(): Promise<void> {
    try {
        await redisClient.connect(); // Connect to Redis database

        await consumer.connect();
        // Subscribe to the alerts topic, start from where we left off (not from the beginning)
        await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });

        await consumer.run({
            // Function executed for every new message received from Kafka
            eachMessage: async ({ topic, partition, message }) => {
                const messageValue = message.value?.toString();
                if (!messageValue) return;

                try {
                    const data = JSON.parse(messageValue);
                    // Debezium wraps the new row data in 'payload.after' for an INSERT operation (op='c')
                    const payload = data?.payload?.after; 
                    if (!payload || data.payload.op !== 'c') {
                        console.log(`CDC: Skipping message (op: ${data?.payload?.op})`);
                        return; // Only process new inserts/creations
                    }
                    
                    // --- CORE LOGIC: Find all users assigned to the project that triggered the alert ---
                    const projectId = payload.project_id;
                    const usersResult = await db.query(
                        'SELECT user_id FROM users_to_project WHERE project_id = $1',
                        [projectId]
                    );

                    // Extract all user IDs who are linked to this project
                    const recipientUserIds: string[] = usersResult.rows.map(row => row.user_id);

                    if (recipientUserIds.length === 0) {
                        console.log(`CDC: No users found for project ${projectId}. Skipping alert.`);
                        return;
                    }

                    // Structure the alert data for the frontend notification dropdown
                    const notification = {
                        id: payload.id, // Primary key of the 'alerts' table row
                        message: payload.message,
                        projectId: projectId,
                        aoiId: payload.aoi_fk_id,
                        timestamp: payload.alert_timestamp,
                        title: `Project Alert: ${projectId}`,
                    };
                    
                    // Process the alert for each recipient user
                    for (const userId of recipientUserIds) {
                        const notifString = JSON.stringify(notification);
                        
                        // 1. **REDIS Caching (Persistence for Offline Users)**
                        // lPush adds the new alert to the *head* (left side) of the list.
                        await redisClient.lPush(`alerts:${userId}`, notifString);
                        // lTrim keeps the list size manageable (e.g., last 50 alerts)
                        await redisClient.lTrim(`alerts:${userId}`, 0, 49); 

                        // 2. **SSE Delivery (Real-time Push)**
                        sendToSSEClient(userId, notification);
                    }

                } catch (err) {
                    console.error('Error processing Kafka message:', err);
                }
            },
        });
        console.log('⚡️ AlertsSSEService: Kafka consumer is running.');
    } catch (error) {
        console.error('🚨 AlertsSSEService: Kafka or Redis connection failed:', error);
    }
}

/**
 * Initializes the entire real-time alert system by setting up 
 * the SSE HTTP endpoint and starting the Kafka consumer worker.
 */
export function initAlertsSSE(app: Express): void {
    // 1. SSE Endpoint for Client Connection (The browser connects here to listen)
    app.get('/api/alerts/events/:userId', async (req: Request, res: Response) => {
        const { userId } = req.params;

        // Set mandatory headers for Server-Sent Events stream
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Send headers immediately

        // Register the active HTTP response object in the map
        if (!sseClients[userId]) sseClients[userId] = [];
        sseClients[userId].push(res);

        // **REDIS: Send Historical/Missed Notifications on Connect**
        try {
            // lRange retrieves the stored list of alerts (newest first)
            const notifs = await redisClient.lRange(`alerts:${userId}`, 0, -1);
            // Send each cached alert immediately to the newly connected client
            notifs.forEach(msg => res.write(`data: ${msg}\n\n`)); 
        } catch (err) {
            console.error('Redis historical fetch error:', err);
        }

        // Remove the connection from the map when the client closes the stream
        req.on('close', () => {
            sseClients[userId] = sseClients[userId].filter(client => client !== res);
        });
    });

    // 2. Mark as Read API (Allows the client to clear an alert from their Redis history)
    app.post('/api/alerts/mark-read', async (req: Request, res: Response) => {
        const { userId, notificationId } = req.body;
        
        try {
            // Fetches the current list of alert JSON strings from Redis
            const notifs = await redisClient.lRange(`alerts:${userId}`, 0, -1);
            
            let countBefore = notifs.length;
            // Filter out the alert with the matching ID
            const filtered = notifs.filter(nn => {
                try {
                    return JSON.parse(nn).id != notificationId;
                } catch {
                    return true; // Keep malformed items just in case
                }
            });

            if (filtered.length !== countBefore) {
                // Completely replace the old Redis list with the filtered, new list
                await redisClient.del(`alerts:${userId}`);
                if (filtered.length > 0) {
                    await redisClient.rPush(`alerts:${userId}`, filtered); 
                }
            }

            res.json({ success: true, removed: countBefore - filtered.length });
        } catch (err) {
            console.error('Error marking alert as read:', err);
            res.status(500).json({ error: 'Failed to mark as read' });
        }
    });

    // 3. Start the Kafka Consumer worker process
    runKafkaConsumer();
}



// ProjectService.ts


import { DBClient } from '../db/DBClient.ts';

import { ProjectModel } from '../models/ProjectModel.ts';
import type { ProjectData } from '../models/ProjectModel.ts';

import { AreaOfInterestModel } from '../models/AreaOfInterestModel.ts';
import type { AreaOfInterestData } from '../models/AreaOfInterestModel.ts';

import type { GeoJsonPolygon } from '../types/GeoJson.ts';

import { AoiAlgorithmMappingModel } from '../models/AoiAlgorithmMappingModel.ts';
import { UsersToProjectModel } from '../models/UsersToProjectModel.ts';
import type { UsersToProjectData } from '../models/UsersToProjectModel.ts';
import { AlgorithmCatalogueModel } from '../models/AlgorithmCatalogueModel.ts';
import type { AlgorithmCatalogueData } from '../models/AlgorithmCatalogueModel.ts';

const db = DBClient.getInstance();

// Define a structure for the complete data bundle coming from the frontend's 4-step process
export interface ProjectCreationBundle {
    projectBasicInfo: {
        projectName: string;
        description: string | null;
        auxData: Record<string, any> | null;
    };
    aoiData: {
        aoiId: string;
        name: string;
        geomGeoJson: GeoJsonPolygon;
        geomProperties: Record<string, any> | null;
        mappedAlgorithms: { algoId: string; configArgs: Record<string, any> }[]; // Note: algoId is now the STRING algo_id
    }[];
    userData: { userId: string; role: string }[];
}

/**
 * ProjectService: Manages complex business logic and database transactions 
 * across multiple models for Project management.
 */
export class ProjectService {

    /**
     */

    public async createProject(
        bundle: ProjectCreationBundle,
        currentUserId: string
    ): Promise<ProjectModel> {
        // Start a database client connection to manage the transaction
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');


            const { projectName, description, auxData } = bundle.projectBasicInfo;

            // 1. Create the Project record
            const projectResult = await client.query(`
                INSERT INTO project
                (name, description, created_by_userid, auxdata) -- <-- Updated column name
                VALUES ($1, $2, $3, $4)
                RETURNING id, creation_timestamp; -- <-- Updated column name
            `, [
                projectName,           // $1: name (User Input)
                description,           // $2: description (User Input)
                currentUserId,         // $3: created_by_userid (Server Determined)
                auxData                // $4: auxdata (User Input JSONB)
            ]);

            const projectId = projectResult.rows[0].id;

            // Correctly instantiate the model with all the new data
            const newProject = new ProjectModel({
                id: projectId,
                name: projectName, // <-- Use 'name' for model constructor
                description: description,
                created_by_userid: currentUserId,
                auxdata: auxData,
                creation_timestamp: projectResult.rows[0].creation_timestamp // <-- Use DB-generated date column name
            });


            // --- Step 2 & 3: Define AOI and Configure AOI Watch ---
            for (const aoiItem of bundle.aoiData) {

                // --- GEOMETRY PROCESSING LOGIC ---
                const geomString = JSON.stringify(aoiItem.geomGeoJson);
                const buffer = Number(aoiItem.geomProperties?.buffer) || 0;

                // Check for valid GeoJSON before proceeding
                if (!geomString || geomString.length < 10) {
                    throw new Error("Invalid GeoJSON geometry provided for AOI: " + aoiItem.name);
                }

                const aoiQuery = `
    WITH original_geom AS (
        SELECT ST_GeomFromGeoJSON($4) AS geom -- $4 is GeoJSON string
    )
    INSERT INTO area_of_interest
    (project_id, aoi_id, name, geom, geom_properties) -- <-- Removed 'publish_flag' and 'auxdata' used differently
    SELECT
        $1, $2, $3,
        CASE
            -- Check if the geometry type is Point (ST_Point) or Line (ST_LineString)
            -- If it is, we MUST buffer it to comply with the table's Polygon constraint.
            WHEN ST_GeometryType(geom) IN ('ST_Point', 'ST_LineString') THEN
                -- Use a minimum buffer of 0.0001 meters if buffer is 0, to force a Polygon output.
                ST_Transform(
                    ST_Buffer(
                        ST_Transform(geom, 3857),
                        CASE WHEN $5 > 0 THEN $5 ELSE 0.0001 END
                    ),
                    4326
                )
            -- If it's already a Polygon, use the geometry as-is.
            ELSE
                geom
        END,
        $6
    FROM original_geom
    RETURNING id; -- We still return the PK ID for internal tracking, but the lookup is by aoi_id
`;

                const aoiResult = await client.query(aoiQuery, [
                    projectId,             // $1
                    aoiItem.aoiId,         // $2 (The Unique String ID)
                    aoiItem.name,          // $3
                    geomString,            // $4 (GeoJSON String)
                    buffer,                // $5 (Buffer Distance - used in CASE)
                    aoiItem.geomProperties, // $6 (JSONB)
                ]);


                // const aoiPkId = aoiResult.rows[0].id; // Not strictly needed, we use project_id + aoi_id

                // 2. Insert AOI-Algorithm Mappings (Uses aoi_id and algo_id string)
                for (const algo of aoiItem.mappedAlgorithms) {
                    const mappingQuery = `
                        INSERT INTO aoi_algorithm_mapping (project_id, aoi_id, change_algo_id, change_algo_configured_args)
                        VALUES ($1, $2, $3, $4);
                    `;
                    await client.query(mappingQuery, [
                        projectId,            // $1
                        aoiItem.aoiId,        // $2 (The Unique String ID)
                        algo.algoId,          // $3 (The Algorithm STRING ID)
                        algo.configArgs       // $4
                    ]);
                }


            }

            // --- Step 4: Add Users (Unchanged, uses PKs and user_id string) ---
            // Ensure the creator is the owner (if not already included)
            const creatorIncluded = bundle.userData.some(u => u.userId === currentUserId);
            if (!creatorIncluded) {
                // The frontend sets a placeholder 'current_user_id', replace it with the real one
                const creatorPlaceholderIndex = bundle.userData.findIndex(u => u.userId === 'current_user_id');
                if (creatorPlaceholderIndex !== -1) {
                    // Replace the placeholder user entry with the actual user ID from the header
                    bundle.userData[creatorPlaceholderIndex].userId = currentUserId;
                } else {
                    // If no placeholder, explicitly add the owner
                    bundle.userData.push({ userId: currentUserId, role: 'owner' });
                }
            }


            for (const user of bundle.userData) {
                const userQuery = `
                    INSERT INTO users_to_project (user_id, project_id, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, project_id) DO UPDATE SET role = EXCLUDED.role;
                `;
                await client.query(userQuery, [user.userId, projectId, user.role]);
            }

            // Finalize the transaction
            await client.query('COMMIT');
            return newProject;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Project creation failed, transaction rolled back:', error);
            // Re-throw with more specific error for debugging
            throw new Error(`Transaction failed. Details: ${(error as any).detail || (error as Error).message}`);
        } finally {
            client.release();
        }
    }

    /**
     * Executes a complete transaction to update an existing project, 
     * including project info, AOIs, Algo Mappings, and User Assignments.
     */
    public async updateProject(
        projectId: number,
        bundle: ProjectCreationBundle,
        currentUserId: string
    ): Promise<ProjectModel> {
        // 1. Start a database client connection to manage the transaction
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // --------------------- Step 1: Update Project Basic Info ---------------------
            const projectModel = await ProjectModel.findById(projectId);
            if (!projectModel) {
                throw new Error(`Project with ID ${projectId} not found.`);
            }

            // Update model properties
            projectModel.projectName = bundle.projectBasicInfo.projectName;
            projectModel.description = bundle.projectBasicInfo.description;
            projectModel.auxData = bundle.projectBasicInfo.auxData;
            projectModel.createdByUserId = currentUserId; // Owner info usually doesn't change on update

            // Execute the UPDATE query for the project table
            await projectModel.update(client);

            // --------------------- Step 2 & 3: AOI and Algo Mapping Update ---------------------
            // AOI/Mapping Update Strategy: Delete all existing AOIs/Mappings and re-insert the new list
            // NOTE: Due to CASCADE DELETE from project table on aoi_algorithm_mapping, deleting AOI is enough.

            // A. Clean up old AOIs (which also cascades to aoi_algorithm_mapping)
            const deletedAoiCount = await AreaOfInterestModel.deleteByProjectId(client, projectId);
            console.log(`[Update] Deleted ${deletedAoiCount} old AOIs for Project ${projectId}.`);

            // B. Insert the new list of AOIs and their Mappings (reusing the create logic)
            for (const aoiItem of bundle.aoiData) {
                // --- GEOMETRY PROCESSING LOGIC (SAME AS CREATE) ---
                const geomString = JSON.stringify(aoiItem.geomGeoJson);
                const buffer = Number(aoiItem.geomProperties?.buffer) || 0;


                const aoiQuery = `
    WITH original_geom AS (
        SELECT ST_GeomFromGeoJSON($4) AS geom -- $4 is GeoJSON string
    )
    INSERT INTO area_of_interest
    (project_id, aoi_id, name, geom, geom_properties)
    SELECT
        $1, $2, $3,
        CASE
            -- Check if the geometry type is Point (ST_Point) or Line (ST_LineString)
            -- If it is, we MUST buffer it to comply with the table's Polygon constraint.
            WHEN ST_GeometryType(geom) IN ('ST_Point', 'ST_LineString') THEN
                -- Use a minimum buffer of 0.0001 meters if buffer is 0, to force a Polygon output.
                ST_Transform(
                    ST_Buffer(
                        ST_Transform(geom, 3857),
                        CASE WHEN $5 > 0 THEN $5 ELSE 0.0001 END
                    ),
                    4326
                )
            -- If it's already a Polygon, use the geometry as-is.
            ELSE
                geom
        END,
        $6
    FROM original_geom
    RETURNING id;
`;

                const aoiResult = await client.query(aoiQuery, [
                    projectId,             // $1
                    aoiItem.aoiId,         // $2
                    aoiItem.name,          // $3
                    geomString,            // $4 (GeoJSON String)
                    buffer,                // $5 (Buffer Distance - used in CASE)
                    aoiItem.geomProperties, // $6 (JSONB)
                ]);
                // const aoiPkId = aoiResult.rows[0].id; // Not strictly needed

                // Insert new AOI-Algorithm Mappings
                for (const algo of aoiItem.mappedAlgorithms) {
                    const mappingQuery = `
                        INSERT INTO aoi_algorithm_mapping (project_id, aoi_id, change_algo_id, change_algo_configured_args)
                        VALUES ($1, $2, $3, $4);
                    `;
                    await client.query(mappingQuery, [
                        projectId,            // $1
                        aoiItem.aoiId,        // $2
                        algo.algoId,          // $3 (The Algorithm STRING ID)
                        algo.configArgs       // $4
                    ]);
                }
            }


            // --------------------- Step 4: Update Users (No change) ---------------------
            const usersToKeep = bundle.userData.map(u => u.userId);

            // A. Delete users that were REMOVED in the frontend UI
            await UsersToProjectModel.deleteExcludedUsers(client, projectId, usersToKeep);

            // B. Upsert (Insert or Update Role) for the remaining/new users
            for (const user of bundle.userData) {
                const userQuery = `
                    INSERT INTO users_to_project (user_id, project_id, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, project_id) DO UPDATE SET role = EXCLUDED.role;
                `;
                await client.query(userQuery, [user.userId, projectId, user.role]);
            }

            // Finalize the transaction
            await client.query('COMMIT');
            return projectModel;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Project update failed, transaction rolled back:', error);
            throw new Error(`Transaction failed. Details: ${(error as any).detail || (error as Error).message}`);
        } finally {
            client.release();
        }
    }


    /**
     * Fetches all projects associated with a given user ID, 
     * using the users_to_project table.
     */
    public async getUserProjects(userId: string): Promise<ProjectData[]> {
        const query = `
            SELECT
                p.id, p.name as project_name, p.description, p.creation_timestamp, p.last_modified_timestamp, p.created_by_userid, p.auxdata, -- <-- Updated column names
                up.role
            FROM project p
            JOIN users_to_project up ON p.id = up.project_id
            WHERE up.user_id = $1
            ORDER BY p.last_modified_timestamp DESC; -- <-- Updated column name
        `;
        // Note: ProjectData interface is now updated in ProjectModel.ts
        const result = await db.query<ProjectData & { project_name: string, role: string }>(query, [userId]);

        // Return projects with the user's role included (for display purposes)
        return result.rows.map(row => ({
            ...row,
            role: row.role
        }));
    }

    /**
     * Fetches a single project and all its associated data (AOIs, Mappings, Users).
     */
    public async getProjectDetails(projectId: number): Promise<any> {
        const client = await db.pool.connect();
        try {
            // 1. Fetch Project Details
            const projectResult = await client.query(`
                SELECT id, name as project_name, description, creation_timestamp, last_modified_timestamp, created_by_userid, auxdata FROM project WHERE id = $1; -- <-- Updated column names
            `, [projectId]);
            if (projectResult.rows.length === 0) return null;
            const project = projectResult.rows[0];

            // 2. Fetch Users (Unchanged)
            const userResult = await client.query(`
                SELECT user_id, role FROM users_to_project WHERE project_id = $1;
            `, [projectId]);

            // 3. Fetch AOIs and 4. Fetch Mapped Algorithms for each AOI
            // Re-use the logic from AreaOfInterestModel.findByProjectId and getMappedAlgorithms
            const aois = await AreaOfInterestModel.findByProjectId(projectId);

            const aoisWithAlgos = [];
            for (const aoiInstance of aois) {
                // The getMappedAlgorithms logic in AreaOfInterestModel.ts is updated
                const algorithms = await aoiInstance.getMappedAlgorithms(client);

                aoisWithAlgos.push({
                    // Flatten AOI properties
                    id: aoiInstance.id,
                    project_id: aoiInstance.projectId,
                    aoi_id: aoiInstance.aoiId,
                    name: aoiInstance.name,
                    auxdata: aoiInstance.auxData,
                    geom_properties: aoiInstance.geomProperties,
                    geomGeoJson: aoiInstance.geomGeoJson,
                    // Add algorithms
                    mappedAlgorithms: algorithms,
                });
            }

            return {
                ...project,
                users: userResult.rows,
                aois: aoisWithAlgos,
            };
        } catch (error) {
            console.error('Error fetching project details:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Deletes a project and all related records (cascade deletes handle most).
     */
    public async deleteProject(projectId: number): Promise<boolean> {
        // Due to CASCADE DELETE constraints, deleting from the parent (project) table
        // will automatically clean up records in: area_of_interest, users_to_project, aoi_algorithm_mapping, alerts.

        const query = `DELETE FROM project WHERE id = $1;`;
        const result = await db.query(query, [projectId]);

        return result.rowCount > 0;
    }


    /**
     * Fetches the entire algorithm catalogue.
     */


    public async getAlgorithmCatalogue(): Promise<AlgorithmCatalogueData[]> {
        const algorithmModels = await AlgorithmCatalogueModel.findAll();


        return algorithmModels.map(algo => ({
            id: algo.id!,
            algo_id: algo.algoId,
            args: algo.defaultArgs,
            description: algo.description,
            category: algo.category,
        }));
    }


    // Add methods for updateProject, deleteProject, etc. here...
}



// backend/src/types/GeoJson.ts

/**
 * Defines the GeoJSON Polygon geometry type for use in backend models.
 * Coordinates are [longitude, latitude].
 */
export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
    // Optional additional GeoJSON properties could be added here
}

/**
 * A simplified interface for a GeoJSON Feature object.
 */
export interface GeoJsonFeature {
    type: 'Feature';
    geometry: GeoJsonPolygon;
    properties: Record<string, any>;
}




// App.ts

import express from 'express';
import type { Application, Router } from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';

import { AuthController } from './controllers/AuthController.ts';
import { ProjectController } from './controllers/ProjectController.ts'; // Assuming ProjectController is updated to export a class

import { AlertsController } from './controllers/AlertsController.ts';
import { initAlertsSSE } from './services/AlertsSSEService.ts'; // <<< NEW IMPORT

/**
 * App Class: The primary object-oriented wrapper for the Express server.
 * Initializes all controllers and middleware.
 */
export class App {
    private app: Application;
    private port: number;

    constructor() {
        dotenv.config();
        this.app = express();
        this.port = parseInt(process.env.PORT || '3000');
        
        this.initializeMiddleware();
        this.initializeControllers();
    }

    private initializeMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        // Basic check to ensure user ID is present for authorized routes (mock check)
        this.app.use('/api', (req, res, next) => {
             if (req.url !== '/auth/login' && !req.header('X-User-ID')) {
                 // Simulate user authentication by checking a header after login
                 // In a real app, this would be a JWT middleware check
             }
             next();
        });
    }

    private initializeControllers() {
        this.app.get('/api/status', (req, res) => {
            res.json({ message: 'Garuda V1 API is online.' });
        });
        
        // Register Controllers as the official API endpoints
        this.app.use('/api/auth', new AuthController().router);
        this.app.use('/api/projects', new ProjectController().router);
        this.app.use('/api/alerts', new AlertsController().router);

        initAlertsSSE(this.app); // <<< NEW INIT CALL
    }

    public start() {
        this.app.listen(this.port, () => {
            console.log(`⚡️ Garuda V1 Server running on http://localhost:${this.port}`);
        });
    }
}





// backend/src/server.ts
import { App } from './App.ts';

// Create and start the main application object
const application = new App();
application.start();






{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "ts-node src/server.ts",
    "dev": "ts-node src/server.ts",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@redis/client": "^5.9.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "kafkajs": "^2.2.4",
    "leaflet": "^1.9.4",
    "leaflet-draw": "^1.0.4",
    "leaflet-geometryutil": "^0.10.3",
    "leaflet.gridlayer.googlemutant": "^0.15.0",
    "pg": "^8.16.3"
  },
  "devDependencies": {
    "@swc/core": "^1.13.5",
    "@swc/helpers": "^0.5.17",
    "@types/express": "^5.0.3",
    "@types/node": "^24.8.1",
    "@types/pg": "^8.15.5",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}



ts-config.json:
{
  // Visit https://aka.ms/tsconfig to read more about this file
  "compilerOptions": {
    // File Layout
    // "rootDir": "./src",
    // "outDir": "./dist",

    // Environment Settings
    // See also https://aka.ms/tsconfig/module
    "module": "nodenext",
    "target": "esnext",
    "types": [],
    "paths": {
      "@/*": ["./src/*"]
    },
  
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    // "noUnusedLocals": true,

    // Stricter Typechecking Options
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "NodeNext",
  
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,

 

    // Recommended Options
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true,
  }
}




frontend:

// ApiClient.ts

import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { ProjectCreationBundle } from '../types/ProjectTypes';
/**
 * ApiClient: Manages all API calls, including setting headers for authentication.
 */
export class ApiClient {
    private client: AxiosInstance;
    private static instance: ApiClient;
    private userId: string | null = null;
    
    private constructor() {
        this.client = axios.create({
            baseURL: 'http://localhost:3000/api', // Backend base URL
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    public static getInstance(): ApiClient {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    public setUserId(userId: string): void {
        this.userId = userId;
        this.client.defaults.headers['X-User-ID'] = userId;
    }

    public getUserId(): string | null {
        return this.userId;
    }
    
    // --- Auth Endpoints ---
    public async login(username: string, password: string): Promise<{ userId: string, username: string }> { 
        const response = await this.client.post('/auth/login', { username, password });
        const { userId, username: returnedUsername } = response.data; // Destructure username
        this.setUserId(userId);
        // CRITICAL: Return username to be stored in UserSession
        return { userId, username: returnedUsername }; 
    }

    public async signup(username: string, password: string): Promise<{ userId: string, username: string }> {
        const response = await this.client.post('/auth/signup', { username, password });
        const { userId, username: returnedUsername } = response.data;
        return { userId, username: returnedUsername };
    }

    // --- Project Endpoints ---
    

    public async createProject(bundle: ProjectCreationBundle): Promise<any> {
        return this.client.post('/projects', bundle);
    }

    // NEW: Update existing project
    public async updateProject(projectId: number, bundle: ProjectCreationBundle): Promise<any> {
        return this.client.put(`/projects/${projectId}`, bundle);
    }

    // NEW: Fetch algorithm catalogue
    public async getAlgorithmCatalogue(): Promise<any[]> {
        const response = await this.client.get('/projects/algorithms');
        return response.data;
    }
    
    public async getProjects(): Promise<any[]> {
        const response = await this.client.get('/projects');
        return response.data;
    }
    
    public async getProjectDetails(projectId: number): Promise<any> {
        const response = await this.client.get(`/projects/${projectId}`);
        return response.data;
    }
    
    public async deleteProject(projectId: number): Promise<void> {
        await this.client.delete(`/projects/${projectId}`);
    }
    
    // Add updateProject, deleteProject methods here...
}



// frontend/src/classes/AreaOfInterestDraft.ts

export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}

interface MappedAlgorithm {
    algoId: string; // The STRING algo_id from the catalogue (e.g., 'NDVI_CHANGE')
    name: string;   // For display in the UI (e.g., 'NDVI_CHANGE')
    configArgs: Record<string, any>; // Specific arguments for this AOI/Algo
}

export class AreaOfInterestDraft {
    public clientAoiId: number;
    public name: string;
    public aoiId: string;
    public geometry: GeoJsonPolygon;
    public mappedAlgorithms: MappedAlgorithm[] = [];
    public bufferDistance: number | null; // NEW: Holds buffer distance in meters
    public geometryType: 'Polygon' | 'LineString' | 'Point'; // NEW: To know if buffer is needed
    public geomProperties: Record<string, any> = {};


    constructor(
        name: string,
        geometry: GeoJsonPolygon,
        clientAoiId: number,
        geometryType: 'Polygon' | 'LineString' | 'Point' = 'Polygon', // Default added
        bufferDistance: number | null = null
    ) {
        this.clientAoiId = clientAoiId;
        this.name = name;
        this.aoiId = `aoi-${clientAoiId}`;
        this.geometry = geometry;
        this.geometryType = geometryType;
        this.bufferDistance = bufferDistance;
    }


    public mapAlgorithm(algoId: string, name: string, configArgs: Record<string, any> = {}): void { // <-- algoId is now string
        const existing = this.mappedAlgorithms.find(a => a.algoId === algoId);
        if (existing) {
            existing.configArgs = configArgs;
        } else {
            this.mappedAlgorithms.push({ algoId, name, configArgs });
        }
    }


    public toBackendData(): any {
        // Prepare geomProperties for the backend (ProjectService)
        const geomProps = {
            ...this.geomProperties,
            // Include buffer distance and geometry type for backend PostGIS processing
            originalType: this.geometryType,
            buffer: this.bufferDistance,
        };

        return {
            aoiId: this.aoiId,
            name: this.name,
            geomGeoJson: this.geometry,
            geomProperties: geomProps,
            mappedAlgorithms: this.mappedAlgorithms.map(a => ({
                algoId: a.algoId, // <-- Send the string algoId
                configArgs: a.configArgs
            }))
        };
    }
}


// frontend/src/classes/ProjectFormData.ts

import { AreaOfInterestDraft } from './AreaOfInterestDraft';

interface UserRoleAssignment {
    userId: string;
    role: 'owner' | 'analyst' | 'viewer' | string;
    username: string;
}

export interface AuxDataDraft {
    key: string;
    value: string;
}
/**
 * ProjectFormData: Manages the volatile state of the 4-step project configuration process.
 */
export class ProjectFormData {
    public projectName: string = '';
    public description: string = '';
    public auxDataDrafts: AuxDataDraft[] = [];

    public aoiDrafts: AreaOfInterestDraft[] = [];
    public users: UserRoleAssignment[] = [];

    public isUpdateMode: boolean = false;
    public currentStep: number = 1;
    public projectIdToUpdate: number | null = null;

    constructor(isUpdate: boolean = false, projectId: number | null = null) {
        this.isUpdateMode = isUpdate;
        this.projectIdToUpdate = projectId;
        // Initialize with creator as owner (will be updated/overridden later)
        this.users = [{ userId: 'current_user_id', role: 'owner', username: 'Creator' }];
    }

    public nextStep(): void {
        if (this.currentStep < 4) {
            this.currentStep++;
        }
    }
    public prevStep(): void {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    public addAOIDraft(aoi: AreaOfInterestDraft): void {
        this.aoiDrafts.push(aoi);
    }

    private getFinalAuxData(): Record<string, any> {
        const finalAuxData: Record<string, any> = {};
        this.auxDataDrafts.forEach(item => {
            if (item.key && item.value) {
                // Try to parse non-string values (numbers, booleans, objects)
                try {
                    finalAuxData[item.key] = JSON.parse(item.value);
                } catch {
                    finalAuxData[item.key] = item.value;
                }
            }
        });
        return finalAuxData;
    }

    public toBackendBundle(): any {
        // CRITICAL FIX: Ensure projectName and description are included here
        const finalAuxData = this.getFinalAuxData();
        return {
            projectBasicInfo: {
                projectName: this.projectName,
                description: this.description,
                auxData: Object.keys(finalAuxData).length > 0 ? finalAuxData : null,
            },
            aoiData: this.aoiDrafts.map(draft => draft.toBackendData()),
            userData: this.users.map(u => ({ userId: u.userId, role: u.role })),
        };
    }

    public reset(): void {
        this.projectName = '';
        this.description = '';
        this.auxDataDrafts = [];
        this.aoiDrafts = [];
        this.users = [{ userId: 'current_user_id', role: 'owner', username: 'Creator' }];
        this.isUpdateMode = false;
        this.currentStep = 1;
        this.projectIdToUpdate = null;
    }
}




// frontend/src/classes/UserSession.ts

import { ApiClient } from '../api/ApiClient';

/**
 * UserSession: Manages the logged-in state and user details.
 */
export class UserSession {
    public userId: string | null = null;
    public username: string | null = null;
    public isLoggedIn: boolean = false;
    
    private static instance: UserSession;

    private static readonly STORAGE_KEY = 'garuda_user_session';

    private constructor() {
        this.loadSession();
    }

    public static getInstance(): UserSession {
        if (!UserSession.instance) {
            UserSession.instance = new UserSession();
        }
        return UserSession.instance;
    }


    private saveSession(): void {
        const data = {
            userId: this.userId,
            username: this.username,
            isLoggedIn: this.isLoggedIn,
        };
        localStorage.setItem(UserSession.STORAGE_KEY, JSON.stringify(data));
    }


    private loadSession(): void {
        const storedData = localStorage.getItem(UserSession.STORAGE_KEY);
        if (storedData) {
            try {
                const data = JSON.parse(storedData);
                this.userId = data.userId;
                this.username = data.username;
                this.isLoggedIn = data.isLoggedIn;
                
                // Re-set the Axios header if session is loaded
                if (this.isLoggedIn && this.userId) {
                    ApiClient.getInstance().setUserId(this.userId);
                }
            } catch (e) {
                console.error("Failed to parse session data from storage:", e);
                this.logout();
            }
        }
    }

    
    public async attemptLogin(username: string, password: string): Promise<boolean> {
        try {
            const api = ApiClient.getInstance();
            // CRITICAL: Get username from API response
            const { userId, username: returnedUsername } = await api.login(username, password);
            
            this.userId = userId;
            this.username = returnedUsername; // Store the actual username
            this.isLoggedIn = true;
            this.saveSession(); // 💾 Save session after successful login

            return true;
        } catch (error) {
            this.logout();
            return false;
        }
    }

    public async attemptSignup(username: string, password: string): Promise<boolean> {
        try {
            const api = ApiClient.getInstance();
            await api.signup(username, password);
            return true;
        } catch (error) {
            console.error('Signup failed:', error);
            return false;
        }
    }

    public logout(): void {
        this.userId = null;
        this.username = null;
        this.isLoggedIn = false;
        ApiClient.getInstance().setUserId('');

        localStorage.removeItem(UserSession.STORAGE_KEY);
    }
}



<!-- auth/LoginForm.vue: -->


<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { UserSession } from '@/classes/UserSession'; 

const router = useRouter();
const session = UserSession.getInstance();

const username = ref('testuser');
const password = ref('pass');
const errorMessage = ref('');
const isSigningUp = ref(false); // New state for toggling between login/signup

const submitAuth = async () => {
    errorMessage.value = '';

    if (isSigningUp.value) {
        // --- SIGNUP LOGIC ---
        const success = await session.attemptSignup(username.value, password.value);
        if (success) {
            errorMessage.value = 'Signup successful! Please log in with your new account.';
            isSigningUp.value = false; // Switch to login view
        } else {
            errorMessage.value = 'Signup failed. User may already exist or invalid input.';
        }

    } else {
        // --- LOGIN LOGIC ---
        const success = await session.attemptLogin(username.value, password.value);

        if (success) {
            router.push('/');
        } else {
            errorMessage.value = 'Login failed. Check username and password.';
        }
    }
};
</script>

<template>
  <div class="login-container max-w-sm mx-auto p-8 mt-20 bg-gray-800 rounded-xl shadow-2xl text-white">
    <h2 class="text-3xl font-bold mb-6 text-center text-cyan-400">{{ isSigningUp ? 'Sign Up' : 'Login' }} to Garuda V1</h2>
    <form @submit.prevent="submitAuth">
      
      <p v-if="errorMessage" class="error-message bg-red-600 p-3 rounded mb-4 text-sm text-center">
        {{ errorMessage }}
      </p>

      <div class="input-group mb-4">
        <label for="username" class="block text-gray-400 mb-1">Username (User ID):</label>
        <input 
            id="username" 
            type="text" 
            v-model="username" 
            required 
            class="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
        />
      </div>
      
      <div class="input-group mb-6">
        <label for="password" class="block text-gray-400 mb-1">Password:</label>
        <input 
            id="password" 
            type="password" 
            v-model="password" 
            required 
            class="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
        />
      </div>
      
      <button 
        type="submit"
        class="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition duration-200 shadow-md"
      >
        {{ isSigningUp ? 'Create Account' : 'Login' }}
      </button>

    </form>
    
    <div class="mt-6 text-center">
        <button 
            @click="isSigningUp = !isSigningUp; errorMessage = ''" 
            class="text-sm font-medium text-gray-400 hover:text-cyan-400 transition duration-150"
        >
            {{ isSigningUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up" }}
        </button>
    </div>
  </div>
</template>

<style scoped>
/* Basic styling for visibility in the dark theme */
.login-container {
    background-color: #1f2937; /* Dark background */
    color: white;
}
.error-message {
    background-color: #dc2626; /* Red 600 */
}
</style>




// // router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
// Standardizing imports to use the @ alias where possible
import { UserSession } from '@/classes/UserSession';

import HomeViewUI from '@/views/HomeViewUI.vue';
import ConfigureProjectUI from '@/views/ConfigureProjectUI.vue';
import LoginForm from '@/components/auth/LoginForm.vue';
import DisplayProjectUI from '@/views/DisplayProjectUI.vue';
import MonitorMapView from '@/views/MonitorMapView.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: LoginForm,
        },
        {
            path: '/',
            name: 'home',
            component: HomeViewUI,
            meta: { requiresAuth: true },
        },
        // ADD/CREATE Project route
        {
            path: '/project/new',
            name: 'add-project',
            component: ConfigureProjectUI,
            meta: { requiresAuth: true },
        },
        // MANAGE/UPDATE Project route (reuses ConfigureProjectUI)
        {
            path: '/project/update/:id', 
            name: 'update-project',
            component: ConfigureProjectUI,
            meta: { requiresAuth: true },
            props: true 
        },
        // LIST/MANAGE Projects route
        {
            path: '/projects/manage',
            name: 'manage-project',
            component: DisplayProjectUI,
            meta: { requiresAuth: true },
        },
        // MONITOR Map view route
        {
            path: '/project/monitor/:id', 
            name: 'monitor-map',
            component: MonitorMapView,
            meta: { requiresAuth: true },
            props: true
        }
    ],
});

// Navigation Guard (enforces login check using the UserSession class)
router.beforeEach((to, from, next) => {
    // We instantiate the class object here to check the login state
    const session = UserSession.getInstance();

    if (to.meta.requiresAuth && !session.isLoggedIn) {
        // Redirect to login if auth is required and user is logged out
        next('/login');
    } else if (to.name === 'login' && session.isLoggedIn) {
        // Redirect home if user is trying to access login while already logged in
        next('/');
    } else {
        next();
    }
});

export default router;




// ProjectStore.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
// STATIC IMPORTS FOR CLASSES
import { ProjectFormData } from '../classes/ProjectFormData';
import { AreaOfInterestDraft } from '../classes/AreaOfInterestDraft';
import { ApiClient } from '../api/ApiClient';

const api = ApiClient.getInstance();

/**
 * Helper function to map the complex backend structure to the simpler ProjectFormData class structure.
 * This is now synchronous, relying on static imports.
 */
function mapBackendToForm(data: any): ProjectFormData {

    // Instantiate the ProjectFormData class
    const form = new ProjectFormData(true, data.id); // Set to update mode

    // Step 1 Mapping
    form.projectName = data.project_name; // <-- Backend alias is used
    form.description = data.description;
    // Map JSONB object to key/value drafts for the form UI
    form.auxDataDrafts = data.auxdata ? Object.entries(data.auxdata).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    })) : [];
    form.currentStep = 1; // Reset to start step

    // Step 2 & 3 Mapping (AOIs and Mappings)
    let aoiCounter = 1;
    form.aoiDrafts = data.aois.map((aoi: any) => {
        // Instantiate the AreaOfInterestDraft class
        const aoiDraft = new AreaOfInterestDraft(
            aoi.name,
            aoi.geomGeoJson,
            aoiCounter++,
            aoi.geom_properties?.originalType || 'Polygon', // Preserve original geometry type
            aoi.geom_properties?.buffer || null
        );
        aoiDraft.aoiId = aoi.aoi_id;
        aoiDraft.geomProperties = aoi.geom_properties || {};

        // Map algorithms
        aoi.mappedAlgorithms.forEach((algo: any) => {
            aoiDraft.mapAlgorithm(
                algo.algo_id, // <-- Use the STRING algo_id for mapping
                algo.algo_id, // Use algo_id string as the display name
                algo.config_args
            );
        });
        return aoiDraft;
    });

    // Step 4 Mapping (Users)
    form.users = data.users.map((u: any) => ({
        userId: u.user_id,
        role: u.role,
        username: u.user_id,
    }));

    return form;
}


/**
 * ProjectStore: Manages the state and logic related to Project instances.
 */
export const useProjectStore = defineStore('project', () => {
    // ... The rest of the Pinia store remains the same ...

    // State: Holds the active form object and the list of projects
    const projectForm = ref<ProjectFormData>(new ProjectFormData());
    const userProjects = ref<any[]>([]);

    const activeAlerts = ref<any[]>([]); // New state for alerts

    // Getters
    const isEditing = computed(() => projectForm.value.isUpdateMode);
    const currentStep = computed(() => projectForm.value.currentStep);


    const totalAlerts = computed(() => activeAlerts.value.length); // New getter

    // Actions

    function initNewProjectForm() {
        projectForm.value = new ProjectFormData(false, null);
    }

    async function submitProject(): Promise<void> {
        // ... (existing submitProject logic) ...
        const bundle = projectForm.value.toBackendBundle();

        // --- ADD DEBUG LOGGING ---
        console.log("--- SUBMIT PAYLOAD ---");
        console.log("Is Update Mode:", projectForm.value.isUpdateMode);
        console.log("Project Name:", bundle.projectBasicInfo.projectName);
        console.log("AOI Count:", bundle.aoiData.length);
        console.log("User Count:", bundle.userData.length);
        console.log("Full Bundle:", JSON.stringify(bundle, null, 2));
        console.log("------------------------");
        // -------------------------


        try {
            let response;
            if (projectForm.value.isUpdateMode && projectForm.value.projectIdToUpdate) {
                // *** CRITICAL UPDATE LOGIC ***
                response = await api.updateProject(projectForm.value.projectIdToUpdate, bundle);
                // *****************************
            } else {
                response = await api.createProject(bundle);
            }

            console.log('Project submitted successfully:', response.data);

            projectForm.value.reset();

        } catch (error) {
            console.error('Error submitting project:', error);
            throw new Error('Failed to submit project. See console for API error details.');
        }


    }

    async function fetchUserProjects(): Promise<void> {
        // ... (existing fetchUserProjects logic) ...

        try {
            const projects = await api.getProjects();
            // --- ADD DEBUG LOGGING ---
            console.log(`[ProjectStore] Fetched ${projects.length} projects.`);
            // -------------------------
            userProjects.value = projects;
        } catch (error) {
            console.error('Error fetching projects:', error);
            userProjects.value = [];
        }
    }

    async function loadProjectForUpdate(projectId: number): Promise<void> {
        try {
            const response = await api.getProjectDetails(projectId);
            projectForm.value = mapBackendToForm(response);
        } catch (error) {
            console.error(`Error loading project ${projectId}:`, error);
            throw new Error('Failed to load project data for editing.');
        }
    }

    async function deleteProject(projectId: number): Promise<void> {
        await api.deleteProject(projectId);
    }

    function addAlert(alert: any) {
        // Ensure unique alerts if loading from Redis/SSE simultaneously
        if (!activeAlerts.value.some(a => a.id === alert.id)) {
            // Add to the beginning of the list (newest first)
            activeAlerts.value.unshift(alert);
        }
    }

    async function markAlertAsRead(alertId: number) {
        const session = UserSession.getInstance();
        const userId = session.getUserId();

        if (!userId) return;

        try {
            // 1. Tell the backend to remove it from Redis
            await api.client.post('/alerts/mark-read', { userId, notificationId: alertId });

            // 2. Remove it locally
            activeAlerts.value = activeAlerts.value.filter(a => a.id !== alertId);
        } catch (error) {
            console.error('Failed to mark alert as read:', error);
            // Optionally, re-add the alert if the API call failed
        }
    }

    // NEW ACTION: Use this in the component to go to the next step
    function nextStep() {
        projectForm.value.nextStep();
    }

    // NEW ACTION: Use this in the component to go to the previous step
    function prevStep() {
        projectForm.value.prevStep();
    }

    return {
        projectForm,
        userProjects,
        isEditing,
        currentStep,
        initNewProjectForm,
        submitProject,
        fetchUserProjects,
        loadProjectForUpdate,
        deleteProject,
        nextStep,
        prevStep,
        activeAlerts, // Return new state
        totalAlerts,  // Return new getter
        addAlert,     // Return new action
        markAlertAsRead, // Return new action


        projectName: computed({
            get: () => projectForm.value.projectName,
            set: (val: string) => { projectForm.value.projectName = val; }
        }),
        description: computed({
            get: () => projectForm.value.description,
            set: (val: string | null) => { projectForm.value.description = val; }
        }),

    };
});



// ProjectTypes.ts
// Re-define the required imported types first (these were already defined in classes)
export interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}

/**
 * Defines the complete data structure that the frontend's ProjectFormData.toBackendBundle() 
 * method must produce, and which the backend's ProjectService.createProject() expects.
 */
export interface ProjectCreationBundle {
    projectBasicInfo: {
        projectName: string;
        description: string | null;
        auxData: Record<string, any> | null;
    };
    aoiData: {
        aoiId: string;
        name: string;
        geomGeoJson: GeoJsonPolygon;
        geomProperties: Record<string, any> | null;
        mappedAlgorithms: { algoId: string; configArgs: Record<string, any> }[]; // <-- algoId is now STRING
    }[];
    userData: { userId: string; role: string }[];
}




<!-- main.ts -->



import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css'; // Global styles
import "tailwindcss";

// Create the root Vue application instance
const app = createApp(App);

// Install Pinia for state management (used by your ProjectStore)
app.use(createPinia());

// Install the Vue Router
app.use(router);

// Mount the application to the DOM (assuming index.html has <div id="app"></div>)
app.mount('#app');




<!-- package.json -->


{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.1.15",
    "@vue-leaflet/vue-leaflet": "^0.10.1",
    "axios": "^1.12.2",
    "leaflet": "^1.9.4",
    "leaflet-draw": "^1.0.4",
    "leaflet-geometryutil": "^0.10.3",
    "leaflet.gridlayer.googlemutant": "^0.15.0",
    "pinia": "^3.0.3",
    "tailwindcss": "^4.1.15",
    "vue": "^3.5.22",
    "vue-leaflet": "^0.1.0",
    "vue-router": "^4.6.3"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.21",
    "@types/leaflet-draw": "^1.0.13",
    "@types/node": "^24.9.1",
    "@vitejs/plugin-vue": "^6.0.1",
    "@vue/tsconfig": "^0.8.1",
    "typescript": "~5.9.3",
    "vite": "^7.1.7",
    "vue-tsc": "^3.1.0"
  }
}


<!-- ts-config.json -->

{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOMIterable"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* ** CRITICAL FIX: Add this block for the @/ alias ** */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}


vite.config.ts



import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),

  ],
  server: {
    // CRITICAL: Configure the proxy here
    proxy: {
      // Proxy all requests starting with /api to the backend Express server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Optional: Rewrite /api to empty path if your backend didn't use /api
        // but since your backend uses /api, this is usually not needed.
      },
    }
  },
  resolve: {
    alias: {
      // This maps the "@/" alias used in your imports to the absolute path of the 'src' directory.
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});