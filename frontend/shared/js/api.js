// API Base URL
const API_BASE_URL = '/api';

/**
 * Get authentication token from localStorage
 */
function getToken() {
    return localStorage.getItem('authToken');
}

/**
 * Get refresh token from localStorage
 */
function getRefreshToken() {
    return localStorage.getItem('refreshToken');
}

/**
 * Save authentication token to localStorage
 */
function saveToken(token) {
    localStorage.setItem('authToken', token);
}

/**
 * Save refresh token to localStorage
 */
function saveRefreshToken(refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
}

/**
 * Remove authentication token from localStorage
 */
function removeToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
}

/**
 * Get user data from localStorage
 */
function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

/**
 * Save user data to localStorage
 */
function saveUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Refresh the access token using refresh token
 * @returns {Promise<boolean>} Success status
 */
async function refreshAccessToken() {
    try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            console.warn('No refresh token available');
            return false;
        }

        // Add retry logic for server restart scenarios
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refreshToken })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    saveToken(result.data.token);
                    console.log('Token refreshed successfully');
                    return true;
                }

                // If server error (5xx), retry
                if (response.status >= 500) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.warn(`Refresh attempt ${attempts} failed, retrying...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
                        continue;
                    }
                }

                console.error('Refresh failed:', result.message);
                return false;

            } catch (fetchError) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.warn(`Refresh attempt ${attempts} failed with network error, retrying...`, fetchError);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                    continue;
                }
                console.error('Token refresh network error:', fetchError);
                return false;
            }
        }

        return false;
    } catch (error) {
        console.error('Token refresh error:', error);
        return false;
    }
}

/**
 * Make API request with authentication
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} endpoint - API endpoint (e.g., '/sessions/today')
 * @param {object} data - Request body data (optional)
 * @returns {Promise} Response data
 */
async function makeRequest(method, endpoint, data = null) {
    const token = getToken();
    const startTime = Date.now();

    const config = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // Add authorization header if token exists
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add body for POST, PUT, PATCH, DELETE requests
    if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const result = await response.json();
        const duration = Date.now() - startTime;

        // Track API call with analytics
        if (window.Analytics && window.Analytics.trackApiCall) {
            window.Analytics.trackApiCall(endpoint, method, duration, response.ok);
        }

        if (!response.ok) {
            // Handle unauthorized (expired token) - try to refresh
            if ((response.status === 401 || response.status === 403) && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
                // Try to refresh token
                const refreshSuccess = await refreshAccessToken();
                if (refreshSuccess) {
                    // Retry the request with new token
                    const newToken = getToken();
                    if (newToken) {
                        config.headers['Authorization'] = `Bearer ${newToken}`;
                        try {
                            const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
                            const retryDuration = Date.now() - startTime;
                            if (window.Analytics && window.Analytics.trackApiCall) {
                                window.Analytics.trackApiCall(endpoint, method, retryDuration, retryResponse.ok);
                            }
                            if (retryResponse.ok) {
                                const retryResult = await retryResponse.json();
                                return retryResult;
                            }
                        } catch (retryError) {
                            console.error('Retry request failed:', retryError);
                        }
                    }
                }

                // Only logout if we have a refresh token but refresh failed
                // If no refresh token, user needs to login anyway
                const hasRefreshToken = getRefreshToken() !== null;
                if (hasRefreshToken) {
                    console.warn('Token refresh failed, logging out user');
                    removeToken();
                    if (window.location.pathname.includes('/admin')) {
                        window.location.href = '/admin/index.html';
                    } else {
                        window.location.href = '/assistant/index.html';
                    }
                    return; // Don't throw error, redirect handled
                }
            }

            throw new Error(result.message || 'Request failed');
        }

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;

        // Track failed API call with analytics
        if (window.Analytics && window.Analytics.trackApiCall) {
            window.Analytics.trackApiCall(endpoint, method, duration, false);
        }

        console.error('API Request Error:', error);
        throw error;
    }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return getToken() !== null;
}

/**
 * Logout user
 */
function logout() {
    removeToken();
    if (window.location.pathname.includes('/admin')) {
        window.location.href = '/admin/index.html';
    } else {
        window.location.href = '/assistant/index.html';
    }
}

// Make functions globally available
window.api = {
    makeRequest,
    getToken,
    saveToken,
    saveRefreshToken,
    removeToken,
    getUser,
    saveUser,
    isAuthenticated,
    logout,
    refreshAccessToken
};
