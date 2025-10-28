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