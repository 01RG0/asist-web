// Vercel Analytics Integration
// This file provides a centralized way to initialize Vercel Analytics across all pages

/**
 * Initialize Vercel Analytics
 * Call this function after the analytics script has loaded
 */
function initVercelAnalytics() {
    // Load the analytics script dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@vercel/analytics@1.6.1/dist/index.min.js';
    script.async = true;

    script.onload = function() {
        // Initialize analytics after script loads
        if (window.VercelAnalytics) {
            window.VercelAnalytics.inject();

            // Track page view
            if (window.VercelAnalytics.track) {
                window.VercelAnalytics.track('page_view', {
                    page: window.location.pathname,
                    timestamp: new Date().toISOString()
                });
            }

            console.log('Vercel Analytics initialized');
        }
    };

    script.onerror = function() {
        console.warn('Failed to load Vercel Analytics script');
    };

    document.head.appendChild(script);
}

/**
 * Track custom events
 * @param {string} eventName - Name of the event
 * @param {object} properties - Additional properties to track
 */
function trackEvent(eventName, properties = {}) {
    if (window.VercelAnalytics && window.VercelAnalytics.track) {
        window.VercelAnalytics.track(eventName, {
            ...properties,
            timestamp: new Date().toISOString(),
            page: window.location.pathname
        });
    }
}

/**
 * Track user interactions (login, logout, etc.)
 * @param {string} action - User action
 * @param {object} details - Additional details
 */
function trackUserAction(action, details = {}) {
    trackEvent('user_action', {
        action,
        ...details
    });
}

/**
 * Track API calls for performance monitoring
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {number} duration - Request duration in ms
 * @param {boolean} success - Whether the request was successful
 */
function trackApiCall(endpoint, method, duration, success) {
    trackEvent('api_call', {
        endpoint,
        method,
        duration,
        success
    });
}

// Auto-initialize analytics when this script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVercelAnalytics);
} else {
    initVercelAnalytics();
}

// Make functions globally available
window.Analytics = {
    trackEvent,
    trackUserAction,
    trackApiCall
};
