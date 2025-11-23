const express = require('express');
const router = express.Router();
const { login, register, refreshToken } = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/register (for testing - should be admin-only in production)
router.post('/register', register);

// POST /api/auth/refresh
router.post('/refresh', refreshToken);

module.exports = router;
