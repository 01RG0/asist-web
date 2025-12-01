// Error Logs page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const user = window.api.getUser();
    if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    // Update user info in sidebar
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    // Initialize sidebar functionality
    initializeSidebar();

    // State
    let currentFilters = {};
    let currentPage = 1;
    let totalPages = 1;

    // Load initial data
    loadErrorLogs();
    loadStatistics();

    // Event listeners
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    document.getElementById('refresh-logs').addEventListener('click', () => loadErrorLogs(currentFilters, currentPage));

    // Pagination
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            loadErrorLogs(currentFilters, currentPage - 1);
        }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadErrorLogs(currentFilters, currentPage + 1);
        }
    });

    // Modal
    document.getElementById('close-error-modal').addEventListener('click', () => {
        document.getElementById('error-detail-modal').style.display = 'none';
    });

    // Close modal on outside click
    document.getElementById('error-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'error-detail-modal') {
            document.getElementById('error-detail-modal').style.display = 'none';
        }
    });

    /**
     * Load error logs
     */
    async function loadErrorLogs(filters = {}, page = 1) {
        try {
            currentFilters = filters;
            currentPage = page;

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '50',
                ...filters
            });

            const response = await window.api.makeRequest('GET', `/admin/error-logs?${params.toString()}`);

            if (response.success) {
                displayErrorLogs(response.data);
                updatePagination(response.pagination);
            } else {
                showAlert('Failed to load error logs: ' + response.message, 'error');
            }
        } catch (error) {
            console.error('Error loading error logs:', error);
            showAlert('Failed to load error logs', 'error');
        }
    }

    /**
     * Display error logs in table
     */
    function displayErrorLogs(logs) {
        const tbody = document.getElementById('error-logs-table-body');
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No error logs found</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const levelBadge = getLevelBadge(log.level);
            const statusBadge = log.resolved 
                ? '<span class="badge badge-success">Resolved</span>'
                : '<span class="badge badge-warning">Unresolved</span>';

            return `
                <tr>
                    <td>${timestamp}</td>
                    <td>${levelBadge}</td>
                    <td>${log.user_name || 'System'}</td>
                    <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(log.message)}">${escapeHtml(log.message)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewErrorDetail('${log.id}')" title="View Details">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        ${!log.resolved ? `
                            <button class="btn btn-sm btn-primary" onclick="markResolved('${log.id}')" title="Mark Resolved">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteErrorLog('${log.id}')" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Get level badge HTML
     */
    function getLevelBadge(level) {
        const badges = {
            error: '<span class="badge badge-danger">Error</span>',
            warning: '<span class="badge badge-warning">Warning</span>',
            critical: '<span class="badge badge-danger" style="background: #dc3545;">Critical</span>',
            info: '<span class="badge badge-info">Info</span>'
        };
        return badges[level] || '<span class="badge">' + level + '</span>';
    }

    /**
     * Update pagination
     */
    function updatePagination(pagination) {
        totalPages = pagination.pages;
        document.getElementById('page-info').textContent = `Page ${pagination.page} of ${pagination.pages}`;
        document.getElementById('records-count').textContent = `${pagination.total} total errors`;
        
        document.getElementById('prev-page-btn').disabled = pagination.page <= 1;
        document.getElementById('next-page-btn').disabled = pagination.page >= pagination.pages;
    }

    /**
     * Apply filters
     */
    function applyFilters() {
        const filters = {};
        
        const level = document.getElementById('level-filter').value;
        if (level) filters.level = level;
        
        const resolved = document.getElementById('resolved-filter').value;
        if (resolved !== '') filters.resolved = resolved;
        
        const startDate = document.getElementById('start-date').value;
        if (startDate) filters.start_date = startDate;
        
        const endDate = document.getElementById('end-date').value;
        if (endDate) filters.end_date = endDate;

        loadErrorLogs(filters, 1);
    }

    /**
     * Reset filters
     */
    function resetFilters() {
        document.getElementById('level-filter').value = '';
        document.getElementById('resolved-filter').value = '';
        document.getElementById('start-date').value = '';
        document.getElementById('end-date').value = '';
        loadErrorLogs({}, 1);
    }

    /**
     * Load statistics
     */
    async function loadStatistics() {
        try {
            const [allRes, unresolvedRes, resolvedRes, criticalRes] = await Promise.all([
                window.api.makeRequest('GET', '/admin/error-logs?limit=1'),
                window.api.makeRequest('GET', '/admin/error-logs?resolved=false&limit=1'),
                window.api.makeRequest('GET', '/admin/error-logs?resolved=true&limit=1'),
                window.api.makeRequest('GET', '/admin/error-logs?level=critical&limit=1')
            ]);

            if (allRes.success) {
                document.getElementById('total-errors').textContent = allRes.pagination.total;
            }
            if (unresolvedRes.success) {
                document.getElementById('unresolved-errors').textContent = unresolvedRes.pagination.total;
            }
            if (resolvedRes.success) {
                document.getElementById('resolved-errors').textContent = resolvedRes.pagination.total;
            }
            if (criticalRes.success) {
                document.getElementById('critical-errors').textContent = criticalRes.pagination.total;
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    /**
     * View error detail
     */
    window.viewErrorDetail = async function(errorId) {
        try {
            const response = await window.api.makeRequest('GET', `/admin/error-logs/${errorId}`);
            
            if (response.success) {
                const log = response.data;
                const content = document.getElementById('error-detail-content');
                
                content.innerHTML = `
                    <div style="margin-bottom: 1rem;">
                        <strong>Level:</strong> ${getLevelBadge(log.level)}
                        <strong style="margin-left: 1rem;">Status:</strong> ${log.resolved ? '<span class="badge badge-success">Resolved</span>' : '<span class="badge badge-warning">Unresolved</span>'}
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <strong>Timestamp:</strong> ${new Date(log.timestamp).toLocaleString()}
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <strong>User:</strong> ${log.user_name || 'System'} ${log.user_email ? `(${log.user_email})` : ''}
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <strong>Endpoint:</strong> ${log.method || ''} ${log.endpoint || 'N/A'}
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <strong>IP Address:</strong> ${log.ip_address || 'N/A'}
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <strong>Message:</strong>
                        <div style="background: #f5f5f5; padding: 0.75rem; border-radius: 4px; margin-top: 0.5rem; font-family: monospace; white-space: pre-wrap;">${escapeHtml(log.message)}</div>
                    </div>
                    ${log.stack ? `
                        <div style="margin-bottom: 1rem;">
                            <strong>Stack Trace:</strong>
                            <div style="background: #f5f5f5; padding: 0.75rem; border-radius: 4px; margin-top: 0.5rem; font-family: monospace; white-space: pre-wrap; max-height: 300px; overflow-y: auto; font-size: 0.875rem;">${escapeHtml(log.stack)}</div>
                        </div>
                    ` : ''}
                    ${Object.keys(log.context || {}).length > 0 ? `
                        <div style="margin-bottom: 1rem;">
                            <strong>Context:</strong>
                            <div style="background: #f5f5f5; padding: 0.75rem; border-radius: 4px; margin-top: 0.5rem; font-family: monospace; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${escapeHtml(JSON.stringify(log.context, null, 2))}</div>
                        </div>
                    ` : ''}
                    ${log.resolved ? `
                        <div style="margin-bottom: 1rem;">
                            <strong>Resolved By:</strong> ${log.resolved_by_name || 'Unknown'}
                            <br><strong>Resolved At:</strong> ${log.resolved_at ? new Date(log.resolved_at).toLocaleString() : 'N/A'}
                            ${log.resolution_notes ? `<br><strong>Notes:</strong> ${escapeHtml(log.resolution_notes)}` : ''}
                        </div>
                    ` : ''}
                `;
                
                document.getElementById('error-detail-modal').style.display = 'flex';
            } else {
                showAlert('Failed to load error details', 'error');
            }
        } catch (error) {
            console.error('Error loading error detail:', error);
            showAlert('Failed to load error details', 'error');
        }
    };

    /**
     * Mark error as resolved
     */
    window.markResolved = async function(errorId) {
        const notes = prompt('Enter resolution notes (optional):');
        if (notes === null) return; // User cancelled

        try {
            const response = await window.api.makeRequest('PUT', `/admin/error-logs/${errorId}/resolve`, {
                resolution_notes: notes || null
            });

            if (response.success) {
                showAlert('Error marked as resolved', 'success');
                loadErrorLogs(currentFilters, currentPage);
                loadStatistics();
            } else {
                showAlert('Failed to mark error as resolved: ' + response.message, 'error');
            }
        } catch (error) {
            console.error('Error marking resolved:', error);
            showAlert('Failed to mark error as resolved', 'error');
        }
    };

    /**
     * Delete error log
     */
    window.deleteErrorLog = async function(errorId) {
        if (!confirm('Are you sure you want to delete this error log?')) {
            return;
        }

        try {
            const response = await window.api.makeRequest('DELETE', `/admin/error-logs/${errorId}`);

            if (response.success) {
                showAlert('Error log deleted', 'success');
                loadErrorLogs(currentFilters, currentPage);
                loadStatistics();
            } else {
                showAlert('Failed to delete error log: ' + response.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting error log:', error);
            showAlert('Failed to delete error log', 'error');
        }
    };

    /**
     * Initialize sidebar
     */
    function initializeSidebar() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        const logoutBtn = document.getElementById('logout-btn');

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });

        logoutBtn.addEventListener('click', () => {
            window.api.logout();
            window.location.href = 'index.html';
        });
    }

    /**
     * Show alert
     */
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alert-container');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alertContainer.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

