const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const jwtConfig = require('../config/jwt');

/**
 * Login user (admin or assistant)
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user by email
        const [users] = await db.query(
            'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT access token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            jwtConfig.secret,
            { expiresIn: jwtConfig.expiresIn }
        );

        // Generate refresh token
        const refreshToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            jwtConfig.secret,
            { expiresIn: jwtConfig.refreshExpiresIn }
        );

        // Return tokens and user info
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};

/**
 * Register new user (for testing - should be admin-only in production)
 * POST /api/auth/register
 */
const register = async (req, res) => {
    try {
        const { name, email, password, role = 'assistant' } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        // Check if user exists
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, role]
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: result.insertId,
                name,
                email,
                role
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(token, jwtConfig.secret);

        // Optional: Find user to ensure they still exist (skip on database errors for resilience)
        let user = { id: decoded.id, email: decoded.email, role: decoded.role };

        try {
            const [users] = await db.query(
                'SELECT id, name, email, role FROM users WHERE id = ?',
                [decoded.id]
            );

            if (users.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            user = users[0];
        } catch (dbError) {
            // If database is temporarily unavailable, allow refresh with token data
            // This prevents logout during server restarts or database issues
            console.warn('Database unavailable during token refresh, using token data:', dbError.message);
        }

        // Generate new access token
        const newToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            jwtConfig.secret,
            { expiresIn: jwtConfig.expiresIn }
        );

        // Return new access token
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: newToken
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(403).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
};

module.exports = { login, register, refreshToken };
