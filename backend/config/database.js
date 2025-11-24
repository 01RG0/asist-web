const mongoose = require('mongoose');
require('dotenv').config();

/**
 * MongoDB Connection Configuration
 * Connects to MongoDB Atlas or local MongoDB instance
 */

const connectDB = async () => {
    try {
        // MongoDB connection options
        const options = {
            // Connection pool settings
            maxPoolSize: 10,
            minPoolSize: 2,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,

            // Recommended settings
            family: 4, // Use IPv4, skip trying IPv6
        };

        // Get MongoDB URI from environment variables
        const mongoURI = process.env.MONGODB_URI || process.env.DB_URI || 'mongodb://localhost:27017/attendance_system';

        // Connect to MongoDB
        const conn = await mongoose.connect(mongoURI, options);

        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });

        return conn;

    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('Error details:', error);

        // In development, exit on connection failure
        // In production, you might want to retry or use a fallback
        if (process.env.NODE_ENV === 'development') {
            process.exit(1);
        }

        throw error;
    }
};

// For backward compatibility with the old MySQL-style export
// This allows controllers to still use "db" variable during migration
const db = {
    // Mongoose connection will be available after connectDB() is called
    connection: mongoose.connection,
    mongoose: mongoose
};

module.exports = connectDB;
// Also export db for compatibility during migration
module.exports.db = db;
