// Test Call Session Workflow
const axios = require('axios');

const BASE_URL = 'https://localhost:5000/api';

// Configure axios to ignore SSL certificate validation for local testing
const httpsAgent = new (require('https').Agent)({
    rejectUnauthorized: false
});

// Test user credentials (admin)
const testUser = {
    email: 'admin@example.com',
    password: 'admin123'
};

let authToken = '';
let userId = '';
let sessionId1 = '';
let sessionId2 = '';

async function login() {
    try {
        console.log('🔐 Logging in as admin...');
        const response = await axios.post(`${BASE_URL}/auth/login`, testUser, {
            httpsAgent
        });

        if (response.data.success) {
            authToken = response.data.data.token;
            userId = response.data.data.user.id;
            console.log('✅ Login successful');
            return true;
        }
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
    }
    return false;
}

async function createCallSession(name, startTime = '10:00') {
    try {
        console.log(`📞 Creating call session: ${name}...`);
        const sessionData = {
            name: name,
            date: new Date().toISOString().split('T')[0], // Today
            start_time: startTime
        };

        const response = await axios.post(`${BASE_URL}/activities/call-sessions`, sessionData, {
            headers: { Authorization: `Bearer ${authToken}` },
            httpsAgent
        });

        if (response.data.success) {
            const sessionId = response.data.data.id;
            console.log(`✅ Call session created: ${sessionId} (${name})`);
            return sessionId;
        }
    } catch (error) {
        console.error(`❌ Failed to create call session "${name}":`, error.response?.data || error.message);
    }
    return null;
}

async function importStudents(sessionId, sessionName) {
    try {
        console.log(`👥 Importing test students for ${sessionName}...`);
        const students = [
            {
                name: `Student for ${sessionName} 1`,
                studentPhone: '+201234567890',
                parentPhone: '+201234567891'
            },
            {
                name: `Student for ${sessionName} 2`,
                studentPhone: '+201234567892',
                parentPhone: '+201234567893'
            }
        ];

        const response = await axios.post(`${BASE_URL}/activities/call-sessions/${sessionId}/students`, { students }, {
            headers: { Authorization: `Bearer ${authToken}` },
            httpsAgent
        });

        if (response.data.success) {
            console.log(`✅ Students imported successfully for ${sessionName}`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Failed to import students for ${sessionName}:`, error.response?.data || error.message);
    }
    return false;
}

async function startCallSession(sessionId, sessionName) {
    try {
        console.log(`🚀 Starting call session: ${sessionName}...`);

        const response = await axios.post(`${BASE_URL}/activities/call-sessions/${sessionId}/start`, {}, {
            headers: { Authorization: `Bearer ${authToken}` },
            httpsAgent
        });

        if (response.data.success) {
            console.log(`✅ Successfully joined call session: ${sessionName}`);
            return true;
        }
    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.log(`ℹ️ Could not join ${sessionName}: ${errorMessage}`);
        return false;
    }
    return false;
}

async function getCallSessions() {
    try {
        const response = await axios.get(`${BASE_URL}/activities/call-sessions`, {
            headers: { Authorization: `Bearer ${authToken}` },
            httpsAgent
        });

        if (response.data.success) {
            return response.data.data;
        }
    } catch (error) {
        console.error('❌ Failed to get call sessions:', error.response?.data || error.message);
    }
    return [];
}

async function checkAssistantActiveSessions(assistantId) {
    const sessions = await getCallSessions();
    return sessions.filter(session =>
        session.status === 'active' &&
        session.assistants &&
        session.assistants.some(assistant => assistant.id === assistantId)
    );
}

async function testSingleSessionConstraint() {
    console.log('🧪 Testing Single Session Constraint...\n');

    // Step 1: Create two call sessions
    sessionId1 = await createCallSession('Session 1', '10:00');
    if (!sessionId1) return false;

    sessionId2 = await createCallSession('Session 2', '11:00');
    if (!sessionId2) return false;

    // Step 2: Import students for both sessions
    const students1Imported = await importStudents(sessionId1, 'Session 1');
    const students2Imported = await importStudents(sessionId2, 'Session 2');

    if (!students1Imported || !students2Imported) {
        console.log('❌ Failed to import students for both sessions');
        return false;
    }

    // Step 3: Start Session 1
    console.log('\n📍 Step 3: Starting Session 1...');
    const session1Started = await startCallSession(sessionId1, 'Session 1');
    if (!session1Started) {
        console.log('❌ Failed to start Session 1');
        return false;
    }

    // Step 4: Check that assistant is active in Session 1
    console.log('\n📍 Step 4: Checking assistant is active in Session 1...');
    let activeSessions = await checkAssistantActiveSessions(userId);
    const activeInSession1 = activeSessions.some(s => s.id === sessionId1);

    if (!activeInSession1) {
        console.log('❌ Assistant should be active in Session 1 but is not');
        return false;
    }
    console.log('✅ Assistant is correctly active in Session 1');

    // Step 5: Try to start Session 2 (should automatically end Session 1)
    console.log('\n📍 Step 5: Attempting to start Session 2 (should auto-end Session 1)...');
    const session2Started = await startCallSession(sessionId2, 'Session 2');

    if (!session2Started) {
        console.log('❌ Failed to start Session 2');
        return false;
    }

    // Step 6: Check that assistant is now active ONLY in Session 2
    console.log('\n📍 Step 6: Checking assistant is now active ONLY in Session 2...');
    activeSessions = await checkAssistantActiveSessions(userId);
    const activeInSession2 = activeSessions.some(s => s.id === sessionId2);
    const stillActiveInSession1 = activeSessions.some(s => s.id === sessionId1);

    if (!activeInSession2) {
        console.log('❌ Assistant should be active in Session 2 but is not');
        return false;
    }

    if (stillActiveInSession1) {
        console.log('❌ Assistant should NOT be active in Session 1 anymore');
        return false;
    }

    console.log('✅ Assistant is correctly active ONLY in Session 2');
    console.log('✅ Session 1 was automatically ended when joining Session 2');

    // Step 7: Verify Session 1 status
    console.log('\n📍 Step 7: Verifying Session 1 status...');
    const sessions = await getCallSessions();
    const session1 = sessions.find(s => s.id === sessionId1);
    const session2 = sessions.find(s => s.id === sessionId2);

    if (session1 && session1.status !== 'pending') {
        console.log(`✅ Session 1 status is "${session1.status}" (not active anymore)`);
    }

    if (session2 && session2.status === 'active') {
        console.log(`✅ Session 2 status is "${session2.status}"`);
    }

    return true;
}

async function runTests() {
    console.log('🧪 Starting Call Session Single-Session Constraint Tests...\n');

    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('❌ Login failed, cannot proceed with tests');
        return;
    }

    const constraintTestPassed = await testSingleSessionConstraint();

    console.log('\n' + '='.repeat(60));
    if (constraintTestPassed) {
        console.log('🎉 ALL TESTS PASSED! Single session constraint is working correctly.');
        console.log('✅ Assistant cannot be active in multiple call sessions simultaneously.');
        console.log('✅ Joining a new session automatically ends previous active sessions.');
    } else {
        console.log('❌ TESTS FAILED! Single session constraint is not working properly.');
        console.log('Check the output above for details.');
    }
    console.log('='.repeat(60));
}

// Run the tests
runTests().catch(console.error);