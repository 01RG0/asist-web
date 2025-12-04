/**
 * Migration: Fix Weekly Attendance Index
 * 
 * Purpose: Remove the strict unique index on {assistant_id, session_id}
 * that was preventing multiple weekly attendance records on different dates.
 * 
 * The old index prevented:
 * - Multiple attendance for same session on different weeks
 * 
 * The new approach:
 * - Remove unique constraint from session_id index
 * - Keep duplicate prevention at controller level with date-based checks
 * - Allow weekly sessions to have multiple records (one per week/date)
 */

const mongoose = require('mongoose');

async function up() {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('attendances');
        
        console.log('Checking existing indexes...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes);
        
        // Look for the problematic unique index on assistant_id and session_id
        const oldUniqueIndex = indexes.find(idx => 
            idx.key.assistant_id === 1 && 
            idx.key.session_id === 1 && 
            idx.unique === true
        );
        
        if (oldUniqueIndex) {
            console.log('Found old unique index:', oldUniqueIndex.name);
            console.log('Dropping index:', oldUniqueIndex.name);
            await collection.dropIndex(oldUniqueIndex.name);
            console.log('✓ Dropped old unique index');
        } else {
            console.log('✓ Old unique index not found (already removed)');
        }
        
        // Create new non-unique index for performance
        console.log('Creating new non-unique index for queries...');
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
        console.log('\nNew indexes:', newIndexes);
        
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    }
}

async function down() {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('attendances');
        
        console.log('Rolling back migration...');
        
        // Drop the new indexes we created
        try {
            await collection.dropIndex('assistant_id_1_session_id_1');
            console.log('✓ Dropped non-unique index');
        } catch (e) {
            console.log('Index not found, skipping...');
        }
        
        try {
            await collection.dropIndex('assistant_id_1_session_id_1_time_recorded_-1');
            console.log('✓ Dropped compound index');
        } catch (e) {
            console.log('Index not found, skipping...');
        }
        
        console.log('✓ Rollback completed');
    } catch (error) {
        console.error('Rollback error:', error);
        throw error;
    }
}

module.exports = { up, down };
