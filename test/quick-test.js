/**
 * Quick Test - Basic Functionality Check
 * Fast test to verify main features work
 */

const { makeRequest, setMockMode, TEST_CONFIG } = require('./test-utils');

async function quickTest() {
    console.log('Running Quick Test...\n');
    console.log(`📋 Test Mode: ${TEST_CONFIG.USE_MOCK ? 'MOCK (Safe)' : 'REAL API'}\n`);
    
    setMockMode(TEST_CONFIG.USE_MOCK);

    const results = {
        login: false,
        sessions: false,
        attendance: false,
        timezone: false
    };

    try {
        // 1. Test Login
        console.log('1. Testing login...');
        const loginRes = await makeRequest('POST', '/auth/login', {
            email: 'admin@example.com',
            password: 'admin123'
        });
        results.login = loginRes.success;
        console.log(results.login ? '✅ Login works' : '❌ Login failed');

        if (!results.login) {
            console.log('\n⚠️  Cannot continue tests without login');
            return results;
        }

        const token = loginRes.token;

        // 2. Test Sessions API
        console.log('\n2. Testing sessions API...');
        const sessionsRes = await makeRequest('GET', '/admin/sessions', {}, token);
        results.sessions = sessionsRes.success;
        console.log(results.sessions ? '✅ Sessions API works' : '❌ Sessions API failed');

        // 3. Test Attendance API
        console.log('\n3. Testing attendance API...');
        const attendanceRes = await makeRequest('GET', '/admin/attendance', {}, token);
        results.attendance = attendanceRes.success;
        console.log(results.attendance ? '✅ Attendance API works' : '❌ Attendance API failed');

        // 4. Test Timezone
        console.log('\n4. Testing timezone...');
        const moment = require('moment-timezone');
        const egyptTime = moment.tz('Africa/Cairo');
        const serverTime = moment();
        results.timezone = true;
        console.log(`   Egypt time: ${egyptTime.format('YYYY-MM-DD HH:mm:ss Z')}`);
        console.log(`   Server time: ${serverTime.format('YYYY-MM-DD HH:mm:ss Z')}`);
        console.log('✅ Timezone utilities available');

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('Quick Test Results:');
        console.log(`  Login: ${results.login ? '✅' : '❌'}`);
        console.log(`  Sessions: ${results.sessions ? '✅' : '❌'}`);
        console.log(`  Attendance: ${results.attendance ? '✅' : '❌'}`);
        console.log(`  Timezone: ${results.timezone ? '✅' : '❌'}`);
        console.log('='.repeat(50));

        const allPassed = Object.values(results).every(r => r === true);
        console.log(allPassed ? '\n✅ All quick tests passed!' : '\n⚠️  Some tests failed');

    } catch (error) {
        console.error('\n❌ Quick test error:', error.message);
    }

    return results;
}

if (require.main === module) {
    quickTest().then(() => process.exit(0));
}

module.exports = { quickTest };

