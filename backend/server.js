const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection
const connectDB = require('./config/database');

// Unified logger
const logger = require('./utils/logger');

// Error handler
const errorHandler = require('./middleware/errorHandler');

// Analytics utilities
const { processAnalyticsEvent } = require('./utils/analytics');

// Route imports
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const centerRoutes = require('./routes/centerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const backupRoutes = require('./routes/backupRoutes');
const logRoutes = require('./routes/logRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------- Middleware ---------- */
// CORS configuration - allow Vercel deployment and localhost
const allowedOrigins = [
    'https://assist-web.vercel.app',
    'https://assistweb.vercel.app',
    process.env.FRONTEND_URL,
    `http://localhost:${PORT}`,
    `http://localhost:5000`,
    `http://127.0.0.1:${PORT}`,
    `http://127.0.0.1:5000`,
    `https://localhost:${PORT}`,
    `https://localhost:5000`,
    `https://127.0.0.1:${PORT}`,
    `https://127.0.0.1:5000`,
    // Additional development origins
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (same-origin requests, mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, true); // Allow all origins for now (Vercel handles CORS at edge)
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend directory
try {
    // In Vercel, __dirname might be different, but this is standard for Node
    app.use(express.static(path.join(__dirname, '../frontend')));
} catch (err) {
    console.error('Error setting up static files:', err);
}

/* ---------- Request logging ---------- */
app.use((req, res, next) => {
    logger.info(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

/* ---------- Routes ---------- */
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/backups', backupRoutes);
app.use('/api/log', logRoutes);
app.use('/api/activities', activityRoutes);

/* ---------- Vercel Web Analytics ---------- */
app.post('/api/analytics', (req, res) => {
    try {
        const analyticsData = req.body;
        // Process analytics event using dedicated utility
        processAnalyticsEvent(analyticsData);
        res.status(204).send(); // Return 204 No Content
    } catch (error) {
        logger.error('Error processing analytics data:', error);
        res.status(200).json({ success: true }); // Still return success to not break client
    }
});

/* ---------- Health check ---------- */
app.get('/api/health', (req, res) => {
    try {
        const dbStatus = mongoose.connection ? mongoose.connection.readyState : 0;
        const statusMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        res.json({
            status: 'ok',
            timestamp: new Date(),
            database: statusMap[dbStatus] || 'unknown',
            env: process.env.NODE_ENV
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            error: error.message,
            stack: error.stack
        });
    }
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Attendance System API is running',
        timestamp: new Date().toISOString(),
        database: 'MongoDB'
    });
});

/* ---------- Root endpoint ---------- */
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Assistant Attendance System API',
        version: '1.0.0',
        database: 'MongoDB'
    });
});

/* ---------- API root ---------- */
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Assistant Attendance System API',
        version: '1.0.0'
    });
});

/* ---------- 404 handler ---------- */
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

/* ---------- Error handler ---------- */
// Use centralized error handler with logging
app.use(errorHandler);

/* ---------- Server startup ---------- */
// Start server only if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');

    let server;
    let protocol = 'http';

    try {
        if (fs.existsSync(path.join(__dirname, 'key.pem')) && fs.existsSync(path.join(__dirname, 'cert.pem'))) {
            const sslOptions = {
                key: fs.readFileSync(path.join(__dirname, 'key.pem')),
                cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
            };
            server = https.createServer(sslOptions, app);
            protocol = 'https';
            console.log('🔒 HTTPS Enabled');
        } else {
            throw new Error('Certificates not found');
        }
    } catch (e) {
        console.log('⚠️  SSL Certificates not found or invalid, falling back to HTTP');
        server = http.createServer(app);
    }

    // Connect to MongoDB and start server
    connectDB().then(() => {
        // Initialize WhatsApp scheduler cron job
        const cron = require('node-cron');
        const { initializeWhatsAppScheduler } = require('./utils/whatsappScheduler');
        const { initializeCallSessionChecker } = require('./utils/callSessionScheduler');
        initializeWhatsAppScheduler(cron);
        initializeCallSessionChecker(cron);

        server.listen(PORT, () => {
            console.log('═══════════════════════════════════════════════════════');
            console.log('  🎯 Assistant Attendance System');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`  ✅ Server running on port ${PORT} (${protocol.toUpperCase()})`);
        });
    }).catch(err => {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    });
} else {
    // For Vercel: Connect to MongoDB without starting HTTP server
    // We don't await here because Vercel functions are stateless/ephemeral
    // but we hope the connection is established before the request is processed
    // or that Mongoose buffers the commands.
    connectDB().catch(err => {
        console.error('Failed to connect to MongoDB in Vercel:', err);
    });
}

// Handle uncaught exceptions to prevent server crashes
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack trace:', error.stack);
    // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});

// Export app for Vercel serverless function
module.exports = app;
