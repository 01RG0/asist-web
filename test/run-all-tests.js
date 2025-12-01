/**
 * Run All Tests
 * Executes all test suites and reports results
 */

const { testEditAttendance } = require('./attendance-edit.test');
const { testSessionTimeDisplay } = require('./session-time-display.test');
const { testEgyptTimezone } = require('./timezone-egypt.test');
const { testWeeklySessions } = require('./weekly-sessions.test');
const { testSessionDeletion } = require('./session-deletion.test');
const { setMockMode, clearTestData, TEST_CONFIG } = require('./test-utils');

async function runAllTests() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     COMPREHENSIVE TEST SUITE - ASIST WEB APP            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\nStarting test execution...\n');
    
    // Use mock mode by default (safe - won't affect production)
    const useMock = TEST_CONFIG.USE_MOCK;
    console.log(`📋 Test Mode: ${useMock ? 'MOCK (Safe - No database changes)' : 'REAL API (May affect database)'}`);
    console.log(`   To use real API, set USE_MOCK=false\n`);
    
    setMockMode(useMock);
    
    // Clear test data before starting
    clearTestData();

    const results = [];

    // Test 1: Edit Attendance
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const result = await testEditAttendance();
        results.push({ name: 'Edit Attendance', passed: result });
    } catch (error) {
        console.error('Test suite error:', error);
        results.push({ name: 'Edit Attendance', passed: false, error: error.message });
    }

    // Test 2: Session Time Display
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const result = await testSessionTimeDisplay();
        results.push({ name: 'Session Time Display', passed: result });
    } catch (error) {
        console.error('Test suite error:', error);
        results.push({ name: 'Session Time Display', passed: false, error: error.message });
    }

    // Test 3: Egypt Timezone
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const result = await testEgyptTimezone();
        results.push({ name: 'Egypt Timezone', passed: result });
    } catch (error) {
        console.error('Test suite error:', error);
        results.push({ name: 'Egypt Timezone', passed: false, error: error.message });
    }

    // Test 4: Weekly Sessions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const result = await testWeeklySessions();
        results.push({ name: 'Weekly Sessions', passed: result });
    } catch (error) {
        console.error('Test suite error:', error);
        results.push({ name: 'Weekly Sessions', passed: false, error: error.message });
    }

    // Test 5: Session Deletion
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
        const result = await testSessionDeletion();
        results.push({ name: 'Session Deletion', passed: result });
    } catch (error) {
        console.error('Test suite error:', error);
        results.push({ name: 'Session Deletion', passed: false, error: error.message });
    }

    // Print Summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    let passed = 0;
    let failed = 0;

    results.forEach((result, index) => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${index + 1}. ${result.name.padEnd(30)} ${status}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        if (result.passed) {
            passed++;
        } else {
            failed++;
        }
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log('─'.repeat(60) + '\n');

    if (failed === 0) {
        console.log('🎉 All tests passed!');
    } else {
        console.log(`⚠️  ${failed} test(s) failed. Please review the errors above.`);
    }

    // Cleanup test data
    if (TEST_CONFIG.CLEANUP_AFTER_TESTS) {
        clearTestData();
        console.log('\n🧹 Test data cleaned up');
    }

    return { passed, failed, total: results.length, results };
}

// Run tests if executed directly
if (require.main === module) {
    runAllTests()
        .then((summary) => {
            process.exit(summary.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('Fatal error running tests:', error);
            process.exit(1);
        });
}

module.exports = { runAllTests };

