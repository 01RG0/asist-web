/**
 * Migration: Fix Attendance Unique Index for Weekly Sessions
 * 
 * Problem: The old unique index on { assistant_id, session_id } was preventing
 * multiple attendance records for the same weekly session on different dates.
 * 
 * Solution: 
 * - For weekly sessions: Allow multiple records (no unique index)
 * - For call sessions: Keep unique index per assistant
 * - For one-time sessions: Duplicate prevention at controller level
 */

const mongoose = require('mongoose');

const runMigration = async () => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('attendances');

        console.log('[Migration 005] Starting: Fix Attendance Unique Index for Weekly Sessions');

        // Get current indexes
        const existingIndexes = await collection.getIndexes();
        console.log('Existing indexes:', Object.keys(existingIndexes));

        // Drop the old strict unique index if it exists
        const oldIndexName = 'assistant_id_1_session_id_1';
        if (existingIndexes[oldIndexName]) {
            console.log(`Dropping old unique index: ${oldIndexName}`);
            await collection.dropIndex(oldIndexName);
            console.log(`✓ Dropped ${oldIndexName}`);
        } else {
            console.log(`ℹ Index ${oldIndexName} not found (may have been dropped already)`);
        }

        // Create new non-unique index for faster duplicate checks
        console.log('Creating new indexes for weekly session support...');
        
        // Index for checking duplicates within the same day (for weekly sessions)
        await collection.createIndex(
            { assistant_id: 1, session_id: 1, time_recorded: -1 },
            { name: 'assistant_session_date_idx' }
        );
        console.log('✓ Created assistant_session_date_idx');

        // Keep the unique index only for call_sessions
        const callSessionIndexName = 'assistant_id_1_call_session_id_1';
        if (!existingIndexes[callSessionIndexName]) {
            await collection.createIndex(
                { assistant_id: 1, call_session_id: 1 },
                { 
                    unique: true,
                    partialFilterExpression: { call_session_id: { $ne: null } },
                    name: 'assistant_id_1_call_session_id_1'
                }
            );
            console.log('✓ Created/verified assistant_call_session unique index');
        } else {
            console.log('ℹ Call session index already exists');
        }

        console.log('[Migration 005] ✓ Completed successfully');
        console.log('\nNow weekly sessions can have multiple attendance records on different dates:');
        console.log('- Same session, SAME DATE → Rejected (duplicate check in controller)');
        console.log('- Same session, DIFFERENT DATE → Allowed (new record for new week)');
        console.log('- Call sessions → One record per assistant (unique index enforced)');

        return true;
    } catch (error) {
        console.error('[Migration 005] ✗ Failed:', error.message);
        throw error;
    }
};

module.exports = { runMigration };
