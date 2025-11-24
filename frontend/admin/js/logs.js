// Logs page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const user = window.api.getUser();
    if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    // Update user info in sidebar and hero
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('user-greeting').textContent = user.name.split(' ')[0];

    // Initialize sidebar functionality
    initializeSidebar();

    // Load initial data
    loadUsers();
    loadLogs();
    loadStatistics();

    // Event listeners
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    document.getElementById('refresh-logs').addEventListener('click', () => loadLogs(currentFilters, currentPage));
    document.getElementById('export-excel').addEventListener('click', exportToExcel);

    // Search input with debounce
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applyFilters();
        }, 500);
    });

    // Pagination
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            loadLogs(currentFilters, currentPage - 1);
        }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadLogs(currentFilters, currentPage + 1);
        }
    });

    // Enter key on filters
    ['start-date', 'end-date'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    });

    // Auto-refresh every 60 seconds
    setInterval(() => {
        loadStatistics();
        if (document.visibilityState === 'visible') {
            loadLogs(currentFilters, currentPage, false); // Silent refresh
        }
    }, 60000);
});

// Global variables
let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};
let isLoading = false;

// Sidebar functionality (shared across admin pages)
function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    if (!sidebar || !sidebarToggle) return;

    // Touch/swipe variables
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;

    // Auto-hide sidebar on page load for larger screens
    if (window.innerWidth > 768) {
        sidebar.classList.add('collapsed');
        sidebarToggle.classList.add('show');
    }

    // Toggle sidebar on button click
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        sidebarToggle.classList.toggle('show');
    });

    // Show sidebar on hover when collapsed (desktop only)
    if (window.innerWidth > 768) {
        let hoverTimeout;

        sidebar.addEventListener('mouseenter', () => {
            if (sidebar.classList.contains('collapsed')) {
                clearTimeout(hoverTimeout);
                sidebar.classList.remove('collapsed');
            }
        });

        sidebar.addEventListener('mouseleave', () => {
            if (!sidebar.classList.contains('collapsed')) {
                hoverTimeout = setTimeout(() => {
                    sidebar.classList.add('collapsed');
                    sidebarToggle.classList.add('show');
                }, 300);
            }
        });
    }

    // Touch event handlers for swipe gestures
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });

    // Handle swipe gestures
    function handleSwipe() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(touchEndY - touchStartY);

        // Only handle horizontal swipes (ignore vertical swipes)
        if (deltaY > maxVerticalDistance) return;

        // Swipe right to show sidebar
        if (deltaX > minSwipeDistance) {
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                sidebarToggle.classList.remove('show');
            }
        }
        // Swipe left to hide sidebar
        else if (deltaX < -minSwipeDistance) {
            if (!sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('collapsed');
                sidebarToggle.classList.add('show');
            }
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('collapsed');
            sidebarToggle.classList.add('show');
        } else {
            sidebar.classList.add('collapsed');
            sidebarToggle.classList.add('show');
        }
    });

    // Close sidebar when clicking outside (desktop only)
    document.addEventListener('click', (e) => {
        // Desktop behavior - auto-hide sidebar when clicking outside
        if (window.innerWidth > 768 &&
            !sidebar.contains(e.target) &&
            !sidebarToggle.contains(e.target) &&
            !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            sidebarToggle.classList.add('show');
        }
    });
}

async function loadUsers() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/users');
        if (response.success) {
            const userSelect = document.getElementById('user-filter');
            userSelect.innerHTML = '<option value="">All Users</option>';
            response.data.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.name} (${user.email})`;
                userSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Failed to load users for filtering', 'error');
    }
}

async function loadStatistics() {
    try {
        // Get today's logs count - use a high limit to get all today's logs for statistics
        const today = new Date().toISOString().split('T')[0];
        const todayResponse = await window.api.makeRequest('GET', `/admin/audit-logs?start_date=${today}&end_date=${today}&limit=1000`);
        const todayCount = todayResponse.success ? todayResponse.pagination.total : 0;

        // Get active users (users with logs in last 7 days) - use high limit
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        const activeUsersResponse = await window.api.makeRequest('GET', `/admin/audit-logs?start_date=${weekAgoStr}&limit=1000`);
        const activeUsers = activeUsersResponse.success ? new Set(activeUsersResponse.data.map(log => log.user_id)).size : 0;

        // Get critical actions (security-related) from today's logs
        const criticalActions = todayResponse.success ? todayResponse.data.filter(log =>
            ['DELETE_USER', 'CHANGE_USER_PASSWORD', 'MANUAL_ATTENDANCE_RECORD'].includes(log.action)
        ).length : 0;

        // Update statistics cards with animation
        animateCounter('total-logs-today', todayCount);
        animateCounter('active-users', activeUsers);
        animateCounter('critical-actions', criticalActions);
        document.getElementById('system-health').textContent = 'Good';

    } catch (error) {
        console.error('Error loading statistics:', error);
        // Set default values on error
        animateCounter('total-logs-today', 0);
        animateCounter('active-users', 0);
        animateCounter('critical-actions', 0);
        document.getElementById('system-health').textContent = 'Checking...';
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const startValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }

    requestAnimationFrame(updateCounter);
}

async function loadLogs(filters = {}, page = 1, showLoading = true) {
    if (isLoading) return;
    isLoading = true;

    const tbody = document.getElementById('logs-table-body');
    if (showLoading) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="loading-spinner"></div>
                    Loading activity logs...
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams({
            page: page,
            limit: 50,
            ...filters
        });

        const response = await window.api.makeRequest('GET', `/admin/audit-logs?${params}`);

        if (response.success) {
            allLogs = response.data;
            filteredLogs = [...allLogs];
            currentPage = response.pagination ? response.pagination.page : 1;
            totalPages = response.pagination ? response.pagination.pages : 1;

            displayLogs(filteredLogs);
            if (response.pagination) {
                updatePagination(response.pagination);
                updateRecordsCount(response.pagination.total);
            }
        } else {
            showAlert('Failed to load logs', 'error');
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-gray">
                        Failed to load logs
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        const errorMessage = error.message || 'Unknown error occurred';
        showAlert(`Error loading logs: ${errorMessage}`, 'error');
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-gray">
                    Error loading logs. Please try refreshing the page.
                </td>
            </tr>
        `;
    } finally {
        isLoading = false;
    }
}

function applyFilters() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const userId = document.getElementById('user-filter').value;
    const action = document.getElementById('action-filter').value;
    const searchTerm = document.getElementById('search-input').value.trim();

    currentFilters = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        user_id: userId || undefined,
        action: action || undefined,
        subject: searchTerm || undefined
    };

    // Remove undefined values
    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key] === undefined) delete currentFilters[key];
    });

    loadLogs(currentFilters, 1);
    showAlert('Filters applied successfully');
}

function resetFilters() {
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('user-filter').value = '';
    document.getElementById('action-filter').value = '';
    document.getElementById('search-input').value = '';

    currentFilters = {};
    loadLogs({}, 1);
    showAlert('Filters reset');
}

function displayLogs(logs) {
    const tbody = document.getElementById('logs-table-body');

    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-gray">
                    No activity logs found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const userDisplay = log.user_name
            ? `<div class="user-info-cell">
                <div class="user-avatar-small">${log.user_name.charAt(0).toUpperCase()}</div>
                <div class="user-details-small">
                    <div class="user-name-small">${log.user_name}</div>
                    <div class="user-email-small">${log.user_email}</div>
                </div>
               </div>`
            : '<span class="text-gray">Unknown User</span>';

        const actionBadge = getActionBadge(log.action);
        const details = formatDetails(log.details);

        return `
            <tr>
                <td>
                    <div class="timestamp-cell">
                        <div class="timestamp-date">${timestamp.split(',')[0]}</div>
                        <div class="timestamp-time">${timestamp.split(',')[1]}</div>
                    </div>
                </td>
                <td>${userDisplay}</td>
                <td>${actionBadge}</td>
                <td class="details-cell">
                    <div class="details-content">${details}</div>
                </td>
                <td>
                    <button class="btn-icon" onclick="showLogDetails(${log.id})" title="View Details">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getActionBadge(action) {
    const actionConfig = {
        'CREATE_USER': { icon: 'user-plus', color: 'success', label: 'User Created' },
        'UPDATE_USER': { icon: 'user-check', color: 'primary', label: 'User Updated' },
        'DELETE_USER': { icon: 'user-x', color: 'danger', label: 'User Deleted' },
        'CHANGE_USER_PASSWORD': { icon: 'lock', color: 'warning', label: 'Password Changed' },
        'RECORD_ATTENDANCE': { icon: 'check-circle', color: 'success', label: 'Attendance' },
        'MANUAL_ATTENDANCE_RECORD': { icon: 'edit', color: 'warning', label: 'Manual Attendance' },
        'CREATE_SESSION': { icon: 'calendar-plus', color: 'primary', label: 'Session Created' },
        'UPDATE_SESSION': { icon: 'calendar-check', color: 'primary', label: 'Session Updated' },
        'DELETE_SESSION': { icon: 'calendar-x', color: 'danger', label: 'Session Deleted' },
        'LOGIN': { icon: 'log-in', color: 'info', label: 'Login' }
    };

    const config = actionConfig[action] || { icon: 'activity', color: 'secondary', label: action };
    return `<span class="badge badge-${config.color} action-badge"><span class="action-icon">${getActionIcon(config.icon)}</span>${config.label}</span>`;
}

function getActionIcon(iconName) {
    const icons = {
        'user-plus': '👤+',
        'user-check': '👤✓',
        'user-x': '👤✗',
        'lock': '🔒',
        'check-circle': '✅',
        'edit': '✏️',
        'calendar-plus': '📅+',
        'calendar-check': '📅✓',
        'calendar-x': '📅✗',
        'log-in': '🔑',
        'activity': '📋'
    };
    return icons[iconName] || '📋';
}

function updatePagination(pagination) {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.pages;
    pageInfo.textContent = `Page ${pagination.page} of ${pagination.pages}`;
}

function updateRecordsCount(total) {
    const countEl = document.getElementById('records-count');
    countEl.textContent = `Showing ${allLogs.length} of ${total} total logs`;
}

function formatDetails(detailsJson) {
    try {
        let details;

        // Handle both string and object formats
        if (typeof detailsJson === 'string') {
            details = JSON.parse(detailsJson);
        } else if (typeof detailsJson === 'object' && detailsJson !== null) {
            details = detailsJson;
        } else {
            return '<span class="text-gray">Invalid details format</span>';
        }

        const entries = Object.entries(details);

        if (entries.length === 0) {
            return '<span class="text-gray">No additional details</span>';
        }

        return entries.map(([key, value]) => {
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `<div class="detail-item"><strong>${displayKey}:</strong> <span>${value}</span></div>`;
        }).join('');
    } catch (error) {
        return '<span class="text-gray">Invalid details format</span>';
    }
}

function showLogDetails(logId) {
    const log = allLogs.find(l => l.id === logId);
    if (!log) return;

    // Create a simple modal or expand the row to show full details
    const details = formatDetails(log.details);
    const timestamp = new Date(log.timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // For now, just show an alert with full details
    const message = `
Log Details:
Action: ${log.action}
User: ${log.user_name} (${log.user_email})
Timestamp: ${timestamp}
Details: ${JSON.stringify(log.details, null, 2)}
    `;

    alert(message);
}

function exportToExcel() {
    if (allLogs.length === 0) {
        showAlert('No logs to export', 'error');
        return;
    }

    const data = allLogs.map(log => {
        let details = {};
        if (typeof log.details === 'string') {
            try {
                details = JSON.parse(log.details || '{}');
            } catch (e) {
                details = {};
            }
        } else if (typeof log.details === 'object' && log.details !== null) {
            details = log.details;
        }

        return {
            'Timestamp': new Date(log.timestamp).toLocaleString('en-US'),
            'User Name': log.user_name || 'Unknown',
            'User Email': log.user_email || 'Unknown',
            'Action': log.action,
            ...details
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Logs');

    const filename = `activity_logs_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);

    showAlert('Activity logs exported successfully');
}

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}