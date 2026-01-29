/**
 * MongoDB Migration: Fix Attendance Unique Index for Weekly Sessions
 * 
 * This script removes the old strict unique index that prevented weekly sessions
 * from having multiple attendance records on different dates.
 * 
 * Run this once: node backend/fix-attendance-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixAttendanceIndex() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const attendancesCollection = db.collection('attendances');

        // Get current indexes
        const currentIndexes = await attendancesCollection.listIndexes().toArray();
        console.log('\nCurrent indexes:');
        currentIndexes.forEach((idx, i) => {
            console.log(`${i}: ${JSON.stringify(idx.key)} - Unique: ${idx.unique || false}`);
        });

        // Drop the old strict unique index if it exists
        const oldIndexName = 'assistant_id_1_session_id_1';
        const hasOldIndex = currentIndexes.some(idx => idx.name === oldIndexName);
        
        if (hasOldIndex) {
            console.log(`\nDropping old index: ${oldIndexName}`);
            await attendancesCollection.dropIndex(oldIndexName);
            console.log(`✓ Dropped index: ${oldIndexName}`);
        } else {
            console.log(`\n✓ Old index ${oldIndexName} not found (might already be removed)`);
        }

        // Create new indexes via Mongoose schema
        // Reload the Attendance model to ensure new indexes are created
        const Attendance = require('./models/Attendance');
        await Attendance.collection.syncIndexes();
        console.log('\n✓ Synchronized indexes based on Attendance schema');

        // Get final indexes
        const finalIndexes = await attendancesCollection.listIndexes().toArray();
        console.log('\nFinal indexes:');
        finalIndexes.forEach((idx, i) => {
            console.log(`${i}: ${JSON.stringify(idx.key)} - Unique: ${idx.unique || false}`);
        });

        console.log('\n✓ Migration completed successfully!');
        console.log('\nNow weekly sessions can have multiple attendance records on different dates.');
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

fixAttendanceIndex();
