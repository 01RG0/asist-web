// Settings page functionality
document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    const user = window.api.getUser();
    if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    // Initialize sidebar functionality after sidebar loads
    document.addEventListener('sidebarLoaded', () => {
        initializeSidebar();
    });

    // Update date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Clear Logs Modal
    const clearLogsModal = document.getElementById('clear-logs-modal');
    const clearLogsBtn = document.getElementById('clear-errors-btn');
    const closeClearModal = document.getElementById('close-clear-modal');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');
    const clearLogsForm = document.getElementById('clear-logs-form');

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            clearLogsModal.style.display = 'flex';
        });
    }

    if (closeClearModal) {
        closeClearModal.addEventListener('click', () => {
            clearLogsModal.style.display = 'none';
        });
    }

    if (cancelClearBtn) {
        cancelClearBtn.addEventListener('click', () => {
            clearLogsModal.style.display = 'none';
        });
    }

    // Close modal on outside click
    if (clearLogsModal) {
        clearLogsModal.addEventListener('click', (e) => {
            if (e.target === clearLogsModal) {
                clearLogsModal.style.display = 'none';
            }
        });
    }

    // Handle Clear Logs Submit
    if (clearLogsForm) {
        clearLogsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!confirm('Are you sure you want to delete these logs? This action cannot be undone.')) {
                return;
            }

            const formData = new FormData(clearLogsForm);
            const resolvedOnly = formData.get('resolved_only') === 'true';
            const olderThanDays = formData.get('older_than_days');

            try {
                const response = await window.api.makeRequest('DELETE', '/admin/error-logs', {
                    resolved_only: resolvedOnly,
                    older_than_days: olderThanDays
                });

                if (response.success) {
                    showAlert(response.message, 'success');
                    clearLogsModal.style.display = 'none';
                    clearLogsForm.reset();
                } else {
                    showAlert('Failed to clear logs: ' + response.message, 'error');
                }
            } catch (error) {
                console.error('Error clearing logs:', error);
                showAlert('An error occurred while clearing logs', 'error');
            }
        });
    }

    // Sidebar functionality (shared across admin pages)
    function initializeSidebar() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    }

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
});
