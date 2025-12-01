/**
 * Test Configuration
 * Uses test database or mocks to avoid affecting production
 */

// Use test database if TEST_DB_URI is set, otherwise use mock mode
const TEST_DB_URI = process.env.TEST_DB_URI || process.env.MONGODB_URI?.replace(/(\/[^\/]+)$/, '/test_attendance_system');
const USE_MOCK = process.env.USE_MOCK === 'true' || !process.env.MONGODB_URI;

// Test mode configuration
const TEST_CONFIG = {
    // Use test database
    TEST_DB_URI: TEST_DB_URI,
    
    // Mock mode (doesn't require database)
    USE_MOCK: USE_MOCK,
    
    // Test API URL (should point to test server or mock)
    API_URL: process.env.TEST_API_URL || 'http://localhost:3000/api',
    
    // Test credentials (should be test users, not production)
    TEST_ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL || 'test-admin@test.com',
    TEST_ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || 'test123',
    
    // Cleanup after tests
    CLEANUP_AFTER_TESTS: process.env.CLEANUP_AFTER_TESTS !== 'false'
};

module.exports = TEST_CONFIG;

