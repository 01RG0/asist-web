/**
 * Run Database Migration: Fix Attendance Indexes
 * Usage: node database/run-migration-005.js
 */

const mongoose = require('mongoose');
const path = require('path');

// Database config
const databaseConfig = {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system'
};

const connectDatabase = async () => {
    try {
        await mongoose.connect(databaseConfig.mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✓ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('✗ Failed to connect to MongoDB:', error.message);
        throw error;
    }
};

const main = async () => {
    try {
        console.log('='.repeat(60));
        console.log('Attendance System - Database Migration 005');
        console.log('Fix Unique Index for Weekly Sessions Support');
        console.log('='.repeat(60));
        console.log('');

        // Connect to database
        await connectDatabase();

        // Run migration
        const { runMigration } = require('./migrations/005_fix_attendance_unique_index.js');
        await runMigration();

        console.log('');
        console.log('='.repeat(60));
        console.log('Migration completed! Your database is ready.');
        console.log('='.repeat(60));

        // Verify indexes
        const db = mongoose.connection.db;
        const collection = db.collection('attendances');
        const indexes = await collection.getIndexes();
        
        console.log('\nFinal indexes on attendances collection:');
        Object.keys(indexes).forEach(indexName => {
            console.log(`  - ${indexName}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('\n✗ Migration failed!');
        console.error(error);
        process.exit(1);
    }
};

main();
