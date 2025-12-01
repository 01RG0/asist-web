/**
 * Test Utilities
 * Helper functions for running tests
 * Uses mock mode by default to avoid affecting production database
 */

const axios = require('axios');
const TEST_CONFIG = require('./test-config');
const { mockRequest, clearMockData } = require('./mock-api');

// Base URL for API (adjust as needed)
const BASE_URL = TEST_CONFIG.API_URL;

let authToken = null;
let useMock = TEST_CONFIG.USE_MOCK;

/**
 * Enable/disable mock mode
 */
function setMockMode(enabled) {
    useMock = enabled;
}

/**
 * Make API request (uses mock if enabled)
 */
async function makeRequest(method, endpoint, data = {}, token = null) {
    // Use mock if enabled
    if (useMock) {
        return await mockRequest(method, endpoint, data, token || authToken);
    }

    // Real API request
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        } else if (authToken) {
            config.headers['Authorization'] = `Bearer ${authToken}`;
        }

        if (method === 'GET') {
            if (data && Object.keys(data).length > 0) {
                config.params = data;
            }
        } else {
            if (data && Object.keys(data).length > 0) {
                config.data = data;
            }
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response) {
            return {
                success: false,
                message: error.response.data?.message || error.message,
                error: error.response.data
            };
        }
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Set auth token
 */
function setAuthToken(token) {
    authToken = token;
}

/**
 * Clear auth token
 */
function clearAuthToken() {
    authToken = null;
}

/**
 * Clear test data (for cleanup)
 */
function clearTestData() {
    if (useMock) {
        clearMockData();
    }
}

module.exports = {
    makeRequest,
    setAuthToken,
    clearAuthToken,
    setMockMode,
    clearTestData,
    BASE_URL,
    TEST_CONFIG
};

