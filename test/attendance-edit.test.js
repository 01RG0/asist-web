/**
 * Test: Edit Attendance Functionality
 * Tests that edit button works and modal populates correctly
 */

const { makeRequest } = require('./test-utils');

async function testEditAttendance() {
    console.log('\n=== Testing Edit Attendance Functionality ===\n');

    try {
        // 1. Login as admin
        console.log('1. Logging in as admin...');
        const loginRes = await makeRequest('POST', '/auth/login', {
            email: 'admin@example.com',
            password: 'admin123'
        });
        
        if (!loginRes.success) {
            throw new Error('Admin login failed');
        }
        const adminToken = loginRes.token;
        console.log('✅ Admin logged in');

        // 2. Get attendance records
        console.log('\n2. Fetching attendance records...');
        const attendanceRes = await makeRequest('GET', '/admin/attendance', {}, adminToken);
        
        if (!attendanceRes.success || attendanceRes.data.length === 0) {
            console.log('⚠️  No attendance records found. Creating test data...');
            
            // Create test session and attendance
            const centersRes = await makeRequest('GET', '/centers', {}, adminToken);
            const usersRes = await makeRequest('GET', '/admin/users', {}, adminToken);
            
            if (centersRes.success && usersRes.success && centersRes.data.length > 0) {
                const center = centersRes.data[0];
                const assistant = usersRes.data.find(u => u.role === 'assistant');
                
                if (assistant) {
                    // Create session
                    const sessionData = {
                        subject: 'Test Session for Edit',
                        start_time: new Date().toISOString(),
                        center_id: center.id,
                        assistant_id: assistant.id
                    };
                    const sessionRes = await makeRequest('POST', '/admin/sessions', sessionData, adminToken);
                    
                    if (sessionRes.success) {
                        console.log('✅ Test session created');
                    }
                }
            }
            
            // Retry getting attendance
            const retryRes = await makeRequest('GET', '/admin/attendance', {}, adminToken);
            if (!retryRes.success || retryRes.data.length === 0) {
                throw new Error('No attendance records available for testing');
            }
            attendanceRes.data = retryRes.data;
        }

        const firstRecord = attendanceRes.data[0];
        console.log(`✅ Found ${attendanceRes.data.length} attendance records`);
        console.log(`   Testing with record ID: ${firstRecord.id}`);

        // 3. Get attendance by ID (simulates edit modal load)
        console.log('\n3. Loading attendance data for edit...');
        const getRes = await makeRequest('GET', `/admin/attendance/${firstRecord.id}`, null, adminToken);
        
        if (!getRes.success) {
            throw new Error(`Failed to get attendance: ${getRes.message}`);
        }

        const attendance = getRes.data;
        console.log('✅ Attendance data loaded:');
        console.log(`   - Assistant ID: ${attendance.assistant_id}`);
        console.log(`   - Session ID: ${attendance.session_id}`);
        console.log(`   - Center ID: ${attendance.center_id}`);
        console.log(`   - Time Recorded: ${attendance.time_recorded}`);
        console.log(`   - Delay: ${attendance.delay_minutes} minutes`);
        console.log(`   - Session Subject: ${attendance.session_subject || 'N/A'}`);

        // 4. Verify required fields exist
        console.log('\n4. Verifying required fields...');
        const requiredFields = ['assistant_id', 'session_id', 'center_id', 'time_recorded'];
        const missingFields = requiredFields.filter(field => !attendance[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        console.log('✅ All required fields present');

        // 5. Test update (if we have valid data)
        console.log('\n5. Testing update functionality...');
        const updateData = {
            assistant_id: attendance.assistant_id,
            session_id: attendance.session_id,
            center_id: attendance.center_id,
            time_recorded: attendance.time_recorded,
            delay_minutes: attendance.delay_minutes + 1,
            notes: 'Updated by test script'
        };

        const updateRes = await makeRequest('PUT', `/admin/attendance/${firstRecord.id}`, updateData, adminToken);
        
        if (!updateRes.success) {
            throw new Error(`Update failed: ${updateRes.message}`);
        }
        console.log('✅ Attendance updated successfully');

        // 6. Verify update
        console.log('\n6. Verifying update...');
        const verifyRes = await makeRequest('GET', `/admin/attendance/${firstRecord.id}`, {}, adminToken);
        
        if (verifyRes.data.delay_minutes !== updateData.delay_minutes) {
            throw new Error('Update not reflected correctly');
        }
        console.log('✅ Update verified');

        console.log('\n✅ All edit attendance tests passed!\n');
        return true;

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

module.exports = { testEditAttendance };

