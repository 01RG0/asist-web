/**
 * Test: Session Deletion and Name Preservation
 * Tests that deleted sessions preserve names in attendance records
 */

const { makeRequest } = require('./test-utils');
const moment = require('moment-timezone');

async function testSessionDeletion() {
    console.log('\n=== Testing Session Deletion & Name Preservation ===\n');

    try {
        // 1. Login as admin
        console.log('1. Logging in as admin...');
        const adminLogin = await makeRequest('POST', '/auth/login', {
            email: 'admin@example.com',
            password: 'admin123'
        });
        const adminToken = adminLogin.token;
        console.log('✅ Admin logged in');

        // 2. Create test session
        console.log('\n2. Creating test session...');
        const centersRes = await makeRequest('GET', '/centers', {}, adminToken);
        const usersRes = await makeRequest('GET', '/admin/users', {}, adminToken);
        
        if (!centersRes.success || centersRes.data.length === 0) {
            throw new Error('No centers available');
        }

        const center = centersRes.data[0];
        const assistant = usersRes.data.find(u => u.role === 'assistant');
        
        if (!assistant) {
            throw new Error('No assistant found');
        }

        const sessionSubject = 'Math Class - Algebra Test';
        const sessionTime = moment.tz('Africa/Cairo').hours(10).minutes(0).seconds(0).milliseconds(0);
        const sessionData = {
            subject: sessionSubject,
            start_time: sessionTime.toDate().toISOString(),
            center_id: center.id,
            assistant_id: assistant.id
        };

        const sessionRes = await makeRequest('POST', '/admin/sessions', sessionData, adminToken);
        if (!sessionRes.success) {
            throw new Error(`Failed to create session: ${sessionRes.message}`);
        }
        const sessionId = sessionRes.data.id;
        console.log(`✅ Session created: "${sessionSubject}" (ID: ${sessionId})`);

        // 3. Create attendance record (simulate assistant marking attendance)
        console.log('\n3. Creating attendance record...');
        const attendanceData = {
            assistant_id: assistant.id,
            session_id: sessionId,
            time_recorded: moment.tz('Africa/Cairo').toDate().toISOString(),
            notes: 'Test attendance'
        };

        const attendanceRes = await makeRequest('POST', '/admin/attendance/manual', attendanceData, adminToken);
        if (!attendanceRes.success) {
            throw new Error(`Failed to create attendance: ${attendanceRes.message}`);
        }
        const attendanceId = attendanceRes.data.id;
        console.log(`✅ Attendance record created (ID: ${attendanceId})`);

        // 4. Verify attendance shows session name
        console.log('\n4. Verifying attendance shows session name...');
        const getAttendanceRes = await makeRequest('GET', `/admin/attendance/${attendanceId}`, null, adminToken);
        
        if (!getAttendanceRes.success) {
            throw new Error('Failed to get attendance');
        }

        const attendance = getAttendanceRes.data;
        console.log(`   Session subject in attendance: ${attendance.session_subject || 'NOT SET'}`);
        
        if (!attendance.session_subject) {
            throw new Error('session_subject not stored in attendance record');
        }
        if (attendance.session_subject !== sessionSubject) {
            throw new Error(`Session subject mismatch: expected "${sessionSubject}", got "${attendance.session_subject}"`);
        }
        console.log('✅ Session name stored in attendance record');

        // 5. Delete session
        console.log('\n5. Deleting session...');
        const deleteRes = await makeRequest('DELETE', `/admin/sessions/${sessionId}`, {}, adminToken);
        if (!deleteRes.success) {
            throw new Error(`Failed to delete session: ${deleteRes.message}`);
        }
        console.log('✅ Session deleted');

        // 6. Verify attendance still shows session name
        console.log('\n6. Verifying attendance still shows session name after deletion...');
        const getAttendanceAfterRes = await makeRequest('GET', `/admin/attendance/${attendanceId}`, null, adminToken);
        
        if (!getAttendanceAfterRes.success) {
            throw new Error('Failed to get attendance after deletion');
        }

        const attendanceAfter = getAttendanceAfterRes.data;
        console.log(`   Session subject after deletion: ${attendanceAfter.session_subject || 'MISSING'}`);
        console.log(`   Session ID (should be null): ${attendanceAfter.session_id || 'null'}`);

        if (!attendanceAfter.session_subject) {
            throw new Error('session_subject missing after session deletion');
        }
        if (attendanceAfter.session_subject !== sessionSubject) {
            throw new Error(`Session subject lost: expected "${sessionSubject}", got "${attendanceAfter.session_subject}"`);
        }
        console.log('✅ Session name preserved after deletion');

        // 7. Test attendance list view
        console.log('\n7. Testing attendance list view...');
        const listRes = await makeRequest('GET', '/admin/attendance', {}, adminToken);
        
        if (listRes.success) {
            const deletedSessionAttendance = listRes.data.find(a => a.id === attendanceId);
            if (deletedSessionAttendance) {
                console.log(`   Subject in list: ${deletedSessionAttendance.subject}`);
                if (deletedSessionAttendance.subject === sessionSubject) {
                    console.log('✅ Session name shown correctly in list');
                } else {
                    throw new Error(`List shows wrong name: "${deletedSessionAttendance.subject}"`);
                }
            }
        }

        // 8. Test subject filter with deleted session
        console.log('\n8. Testing subject filter with deleted session...');
        const filterRes = await makeRequest('GET', `/admin/attendance?subject=Math`, {}, adminToken);
        
        if (filterRes.success) {
            const found = filterRes.data.find(a => a.id === attendanceId);
            if (found) {
                console.log('✅ Subject filter finds deleted session attendance');
            } else {
                console.log('⚠️  Subject filter did not find deleted session attendance');
            }
        }

        // Cleanup
        console.log('\n9. Cleaning up test data...');
        await makeRequest('DELETE', `/admin/attendance/${attendanceId}`, {}, adminToken);
        console.log('✅ Test data cleaned up');

        console.log('\n✅ All session deletion tests passed!\n');
        return true;

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

module.exports = { testSessionDeletion };

