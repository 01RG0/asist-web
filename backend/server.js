const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection
const connectDB = require('./config/database');

// Unified logger
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const centerRoutes = require('./routes/centerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const backupRoutes = require('./routes/backupRoutes');
const logRoutes = require('./routes/logRoutes'); // new log endpoint

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------- Middleware ---------- */
app.use(cors({
    origin: process.env.FRONTEND_URL || `http://localhost:${PORT}`,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

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
app.use('/api/log', logRoutes); // expose log endpoint

/* ---------- Health check ---------- */
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState;
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
        database: 'MongoDB',
        endpoints: {
            auth: '/api/auth',
            sessions: '/api/sessions',
            attendance: '/api/attendance',
            centers: '/api/centers',
            admin: '/api/admin',
            log: '/api/log'
        }
    });
});

/* ---------- API root ---------- */
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Assistant Attendance System API',
        version: '1.0.0',
        documentation: 'Please use specific endpoints'
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
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

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
        server.listen(PORT, () => {
            console.log('═══════════════════════════════════════════════════════');
            console.log('  🎯 Assistant Attendance System');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`  ✅ Server running on port ${PORT} (${protocol.toUpperCase()})`);
            console.log('');
            console.log('  📱 ASSISTANT PWA:');
            console.log(`     ${protocol}://localhost:${PORT}/assistant/`);
            console.log('');
            console.log('  👨‍💼 ADMIN DASHBOARD:');
            console.log(`     ${protocol}://localhost:${PORT}/admin/`);
            console.log('═══════════════════════════════════════════════════════');
        });
    }).catch(err => {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    });
} else {
    // For Vercel: Connect to MongoDB without starting HTTP server
    connectDB().catch(err => {
        console.error('Failed to connect to MongoDB in Vercel:', err);
    });
}

// Export app for Vercel serverless function
module.exports = app;

