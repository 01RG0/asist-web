#!/usr/bin/env node
/**
 * Migration Runner - Run from backend folder
 * Fixes the MongoDB index to allow multiple weekly attendance records
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function runMigration() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system';
        
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const collection = db.collection('attendances');
        
        console.log('\n--- Running Migration 005: Fix Weekly Attendance Index ---\n');
        console.log('Checking existing indexes...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique })));
        
        // Look for the problematic unique index on assistant_id and session_id
        const oldUniqueIndex = indexes.find(idx => 
            idx.key.assistant_id === 1 && 
            idx.key.session_id === 1 && 
            idx.unique === true
        );
        
        if (oldUniqueIndex) {
            console.log('\nFound old unique index:', oldUniqueIndex.name);
            console.log('Dropping index:', oldUniqueIndex.name);
            await collection.dropIndex(oldUniqueIndex.name);
            console.log('✓ Dropped old unique index');
        } else {
            console.log('\n✓ Old unique index not found (already removed)');
        }
        
        // Create new non-unique index for performance
        console.log('\nCreating new non-unique index for queries...');
        await collection.createIndex(
            { assistant_id: 1, session_id: 1 },
            { unique: false }
        );
        console.log('✓ Created non-unique index for {assistant_id, session_id}');
        
        // Create compound index with time_recorded for better query performance
        console.log('Creating compound index with time_recorded...');
        await collection.createIndex(
            { assistant_id: 1, session_id: 1, time_recorded: -1 },
            { unique: false }
        );
        console.log('✓ Created compound index for efficient duplicate checking');
        
        console.log('\n✓ Migration completed successfully!');
        console.log('\nResult:');
        console.log('- Weekly sessions can now have multiple attendance records (one per date)');
        console.log('- One-time sessions still allow only one record (enforced at controller)');
        console.log('- Call sessions still allow only one record (unique index preserved)');
        
        const newIndexes = await collection.indexes();
        console.log('\nNew indexes:');
        newIndexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

runMigration();
