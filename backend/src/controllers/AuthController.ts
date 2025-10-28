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