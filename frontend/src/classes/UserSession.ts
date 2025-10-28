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