// ProjectController.js

import { Router } from 'express';

import { ProjectService } from '../services/ProjectService.js';
/**
 * ProjectController: Handles routing and HTTP request/response logic for projects.
 */
export class ProjectController {
    router;
    projectService;

    constructor() {
        this.router = Router();
        this.projectService = new ProjectService();
        this.initializeRoutes();
    }

    initializeRoutes() {
    this.router.post('/', this.createProject);         // POST /api/projects
    this.router.get('/', this.getProjectsByUser);        // GET /api/projects
    this.router.get('/algorithms', this.getAlgorithmCatalogue); // GET /api/projects/algorithms
    this.router.get('/:id/alerts', this.getProjectAlerts);

    this.router.get('/:id', this.getProjectDetails);     // GET /api/projects/:id
    this.router.put('/:id', this.updateProject);          // PUT /api/projects/:id (Update)
    this.router.delete('/:id', this.deleteProject);      // DELETE /api/projects/:id
};

    /**
     * POST /api/projects
     * Handles the final submission of the 4-step project creation form.
     */
    createProject = async (req, res) => {
        // NOTE: In this single-user simulation, we hardcode the userId from the simple login
        const currentUserId = req.header('X-User-ID') || 'user123'; // Assume header is set after login

        const projectBundle = req.body;

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
                details: (error).message
            });
        }
    }
    /**
     * GET /api/projects
     * Fetches all projects the current user is involved in (for HomeViewUI: Manage/Monitor)
     */
    getProjectsByUser = async (req, res) => {
        const currentUserId = req.header('X-User-ID') || 'user123';

        try {
            const projects = await this.projectService.getUserProjects(currentUserId);
            return res.status(200).json(projects);
        } catch (error) {
            console.error('Controller Error fetching projects:', error);
            return res.status(500).json({ error: 'Failed to fetch user projects.' });
        }
    }

    getProjectDetails = async (req, res) => {
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
     * GET /api/projects/:id/alerts
     * Fetches all alerts for a project, enriched with names.
     */
    // --- UPDATE getProjectAlerts in ProjectController.js ---

getProjectAlerts = async (req, res) => {
    const projectId = parseInt(req.params.id);
    const aoiId = req.query.aoiId ? parseInt(req.query.aoiId) : null;

    if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid Project ID format.' });
    }

    try {
        const { alerts, timeRange } = await this.projectService.getProjectAlerts(projectId, aoiId);
        return res.status(200).json({ alerts, timeRange });
    } catch (error) {
        console.error('Controller Error fetching project alerts:', error);
        return res.status(500).json({ error: 'Failed to fetch project alerts.', details: error.message });
    }
};




    /**
     * DELETE /api/projects/:id
     * Deletes a project and all associated data.
     */
    deleteProject = async (req, res) => {
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

    getAlgorithmCatalogue = async (req, res) => {
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
    updateProject = async (req, res) => {
        const projectIdParam = req.params.id;
        const projectId = parseInt(projectIdParam);
        const currentUserId = req.header('X-User-ID') || 'user123';

        if (isNaN(projectId)) {
             return res.status(400).json({ message: 'Invalid Project ID format.' });
        }
        
        const projectBundle = req.body;

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
            const statusCode = (error).message.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                error: 'Failed to update project.',
                details: (error).message
            });
        }
    }



}
