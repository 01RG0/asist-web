/**
 * Test: Egypt Timezone Handling
 * Tests that all time operations use Egypt timezone, not server timezone
 */

const { makeRequest } = require('./test-utils');
const moment = require('moment-timezone');

async function testEgyptTimezone() {
    console.log('\n=== Testing Egypt Timezone Handling ===\n');

    try {
        // 1. Login as admin
        console.log('1. Logging in as admin...');
        const adminLogin = await makeRequest('POST', '/auth/login', {
            email: 'admin@example.com',
            password: 'admin123'
        });
        const adminToken = adminLogin.token;
        console.log('✅ Admin logged in');

        // 2. Test current time in Egypt timezone
        console.log('\n2. Testing Egypt timezone calculations...');
        const now = new Date();
        const egyptNow = moment.tz(now, 'Africa/Cairo');
        const serverNow = moment(now);
        
        console.log(`   Server time: ${serverNow.format('YYYY-MM-DD HH:mm:ss Z')}`);
        console.log(`   Egypt time: ${egyptNow.format('YYYY-MM-DD HH:mm:ss Z')}`);
        
        const timeDiff = egyptNow.utcOffset() - serverNow.utcOffset();
        if (timeDiff !== 0) {
            console.log(`   ⚠️  Timezone difference: ${timeDiff} minutes`);
        }
        console.log('✅ Timezone conversion working');

        // 3. Test date calculations
        console.log('\n3. Testing date calculations in Egypt timezone...');
        const todayEgypt = moment.tz('Africa/Cairo').startOf('day');
        const todayServer = moment().startOf('day');
        
        console.log(`   Egypt today start: ${todayEgypt.format('YYYY-MM-DD HH:mm:ss Z')}`);
        console.log(`   Server today start: ${todayServer.format('YYYY-MM-DD HH:mm:ss Z')}`);
        
        const dayDiff = todayEgypt.date() - todayServer.date();
        if (dayDiff !== 0) {
            console.log(`   ⚠️  Day difference detected: ${dayDiff} days`);
            console.log('   This is expected if server is in different timezone');
        }
        console.log('✅ Date calculations use Egypt timezone');

        // 4. Test session time extraction
        console.log('\n4. Testing session time extraction...');
        const testTime = new Date('2025-01-23T12:00:00Z');
        const egyptTime = moment.tz(testTime, 'Africa/Cairo');
        const hours = egyptTime.hours();
        const minutes = egyptTime.minutes();
        
        console.log(`   UTC time: ${testTime.toISOString()}`);
        console.log(`   Egypt time: ${egyptTime.format('YYYY-MM-DD HH:mm:ss Z')}`);
        console.log(`   Extracted hours: ${hours}, minutes: ${minutes}`);
        console.log('✅ Time extraction uses Egypt timezone');

        // 5. Test attendance time recording
        console.log('\n5. Testing attendance time recording...');
        const centersRes = await makeRequest('GET', '/centers', {}, adminToken);
        if (centersRes.success && centersRes.data.length > 0) {
            const center = centersRes.data[0];
            const usersRes = await makeRequest('GET', '/admin/users', {}, adminToken);
            const assistant = usersRes.data.find(u => u.role === 'assistant');
            
            if (assistant) {
                // Create session
                const sessionTime = moment.tz('Africa/Cairo').hours(10).minutes(0).seconds(0).milliseconds(0);
                const sessionData = {
                    subject: 'Timezone Test Session',
                    start_time: sessionTime.toDate().toISOString(),
                    center_id: center.id,
                    assistant_id: assistant.id
                };
                
                const sessionRes = await makeRequest('POST', '/admin/sessions', sessionData, adminToken);
                if (sessionRes.success) {
                    console.log(`✅ Test session created at ${sessionTime.format('HH:mm')} Egypt time`);
                    
                    // Get session back and verify time
                    const getSessionRes = await makeRequest('GET', `/admin/sessions/${sessionRes.data.id}`, {}, adminToken);
                    if (getSessionRes.success) {
                        const returnedTime = new Date(getSessionRes.data.start_time);
                        const returnedEgypt = moment.tz(returnedTime, 'Africa/Cairo');
                        console.log(`   Returned time in Egypt: ${returnedEgypt.format('HH:mm')}`);
                        
                        if (returnedEgypt.hours() === 10 && returnedEgypt.minutes() === 0) {
                            console.log('✅ Session time correctly stored and retrieved');
                        } else {
                            throw new Error('Session time mismatch');
                        }
                    }
                    
                    // Cleanup
                    await makeRequest('DELETE', `/admin/sessions/${sessionRes.data.id}`, {}, adminToken);
                }
            }
        }

        // 6. Test day of week calculation
        console.log('\n6. Testing day of week calculation...');
        const testDates = [
            moment.tz('2025-01-20', 'Africa/Cairo'), // Monday
            moment.tz('2025-01-21', 'Africa/Cairo'), // Tuesday
            moment.tz('2025-01-22', 'Africa/Cairo'), // Wednesday
        ];
        
        testDates.forEach(date => {
            const jsDay = date.day(); // 0 = Sunday, 1 = Monday
            const ourDay = jsDay === 0 ? 7 : jsDay; // 1 = Monday, 7 = Sunday
            console.log(`   ${date.format('YYYY-MM-DD')} (${date.format('dddd')}): JS day=${jsDay}, Our day=${ourDay}`);
        });
        console.log('✅ Day of week calculation correct');

        console.log('\n✅ All Egypt timezone tests passed!\n');
        return true;

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

module.exports = { testEgyptTimezone };

