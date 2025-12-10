// Vercel Web Analytics Integration
// This file provides analytics for the attendance system
// Uses Vercel Web Analytics via CDN for plain HTML sites

/**
 * Initialize Vercel Web Analytics
 * Loads the official Vercel Analytics library from CDN
 * Reference: https://vercel.com/docs/analytics
 */
function initVercelAnalytics() {
    try {
        // Load Vercel Web Analytics script from official CDN
        // This script automatically injects analytics tracking
        const script = document.createElement('script');
        script.src = 'https://cdn.vercel.com/analytics/v0.1';
        script.async = true;
        script.defer = true;
        script.onerror = () => console.debug('Vercel Analytics script failed to load');
        document.head.appendChild(script);

        console.log('Vercel Web Analytics initialized');
    } catch (error) {
        console.debug('Error initializing Vercel Analytics:', error);
    }
}

/**
 * Track custom events for user interactions
 * @param {string} eventName - Name of the event
 * @param {object} properties - Additional properties to track
 */
function trackEvent(eventName, properties = {}) {
    try {
        // Use standard web performance API if available
        if (window.performance && window.performance.mark) {
            window.performance.mark(`event:${eventName}`);
        }

        // Prepare event data
        const data = {
            event: eventName,
            ...properties,
            timestamp: new Date().toISOString(),
            page: window.location.pathname,
            url: window.location.href
        };

        // Send analytics data to backend endpoint via sendBeacon
        if (navigator.sendBeacon) {
            try {
                navigator.sendBeacon('/api/analytics', JSON.stringify(data));
            } catch (error) {
                console.debug('Could not send beacon:', error);
            }
        }
    } catch (error) {
        console.debug('Error tracking event:', error);
    }
}

/**
 * Track user actions (login, logout, etc.)
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

/**
 * Track page views
 */
function trackPageView() {
    trackEvent('page_view', {
        title: document.title,
        referrer: document.referrer
    });
}

// Auto-initialize analytics when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initVercelAnalytics();
        trackPageView();
    });
} else {
    // DOM is already loaded
    initVercelAnalytics();
    trackPageView();
}

// Track page visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        trackEvent('page_visible');
    } else {
        trackEvent('page_hidden');
    }
});

// Make functions globally available for use in other scripts
window.Analytics = {
    initVercelAnalytics,
    trackEvent,
    trackUserAction,
    trackApiCall,
    trackPageView
};
