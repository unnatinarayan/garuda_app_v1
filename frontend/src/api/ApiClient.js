// api/ApiClient.js
import axios from 'axios';

/**
 * ApiClient: Manages all API calls, including setting headers for authentication.
 * Updated for subscription-based flow.
 */
export class ApiClient {
    client;
    static instance;
    userId = null;
    
    constructor() {
        this.client = axios.create({
            baseURL: 'http://localhost:3000/api',
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
        const { userId, username: returnedUsername } = response.data;
        this.setUserId(userId);
        return { userId, username: returnedUsername };
    }

    async signup(username, password, email, contactno) {
        const response = await this.client.post('/auth/signup', { username, password, email, contactno });
        const { userId, username: returnedUsername } = response.data;
        return { userId, username: returnedUsername };
    }

    async getUserProfile(userId) {
        const response = await this.client.get(`/auth/profile/${userId}`);
        return response.data;
    }

    async userExists(userId) {
        const response = await this.client.get(`/auth/exists/${userId}`);
        return response.data.exists;
    }
    async getAllRoles() {
    const response = await this.client.get('/projects/roles');
    return response.data;
}


    // --- Project Endpoints ---
    async createProject(bundle) {
        return this.client.post('/projects', bundle);
    }

    async updateProject(projectId, bundle) {
        return this.client.put(`/projects/${projectId}`, bundle);
    }

    // NEW: Get alert channel catalogue
    async getAlertChannelCatalogue() {
        const response = await this.client.get('/projects/alert-channels');
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

    async getProjectAlerts(projectId, aoiId = null) {
        const params = {};
        if (aoiId) params.aoiId = aoiId;

        const response = await this.client.get(`/projects/${projectId}/alerts`, { params });
        return response.data; // returns { alerts, timeRange }
    }
}