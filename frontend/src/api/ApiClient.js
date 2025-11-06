// ApiClient.js

import axios from 'axios';

/**
 * ApiClient: Manages all API calls, including setting headers for authentication.
 */
export class ApiClient {
    client;
    static instance;
    userId = null;
    
    constructor() {
        this.client = axios.create({
            baseURL: 'http://localhost:3000/api', // Backend base URL
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    static getInstance() {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    setUserId(userId) {
        this.userId = userId;
        this.client.defaults.headers['X-User-ID'] = userId;
    }

    getUserId() {
        return this.userId;
    }
    
    // --- Auth Endpoints ---
    async login(username, password) {
        const response = await this.client.post('/auth/login', { username, password });
        const { userId, username: returnedUsername } = response.data; // Destructure username
        this.setUserId(userId);
        // CRITICAL: Return username to be stored in UserSession
        return { userId, username: returnedUsername };
    }

    async signup(username, password) {
        const response = await this.client.post('/auth/signup', { username, password, email, contactno });
        const { userId, username: returnedUsername } = response.data;
        return { userId, username: returnedUsername };
    }

    // --- Project Endpoints ---
    

    async createProject(bundle) {
        return this.client.post('/projects', bundle);
    }

    // NEW: Update existing project
    async updateProject(projectId, bundle) {
        return this.client.put(`/projects/${projectId}`, bundle);
    }

    // NEW: Fetch algorithm catalogue
    async getAlgorithmCatalogue() {
        const response = await this.client.get('/projects/algorithms');
        return response.data;
    }
    
    async getProjects() {
        const response = await this.client.get('/projects');
        return response.data;
    }
    
    async getProjectDetails(projectId) {
        const response = await this.client.get(`/projects/${projectId}`);
        return response.data;
    }
    
    async deleteProject(projectId) {
        await this.client.delete(`/projects/${projectId}`);
    }
    
}
