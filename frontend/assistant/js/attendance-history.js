// Check authentication
if (!window.api.isAuthenticated()) {
    window.location.href = '/assistant/index.html';
}

const loadingSpinner = document.getElementById('loading-spinner');
const recordsContainer = document.getElementById('records-container');
const emptyState = document.getElementById('empty-state');
const alertContainer = document.getElementById('alert-container');
const attendanceList = document.getElementById('attendance-list');
const recordsCount = document.getElementById('records-count');

let currentRecords = [];

// Show alert
function showAlert(message, type = 'error') {
    const alertClass = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-warning';
    alertContainer.innerHTML = `
    <div class="alert ${alertClass}">
      ${message}
    </div>
  `;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format time
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Load attendance history
async function loadAttendanceHistory(filters = {}) {
    try {
        loadingSpinner.style.display = 'block';
        recordsContainer.style.display = 'none';
        emptyState.style.display = 'none';

        const response = await window.api.makeRequest('GET', '/attendance/my-history');

        if (response.success) {
            let records = response.data;

            // Apply date filters
            if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                records = records.filter(r => new Date(r.time_recorded) >= fromDate);
            }
            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                toDate.setHours(23, 59, 59, 999);
                records = records.filter(r => new Date(r.time_recorded) <= toDate);
            }

            currentRecords = records;
            displayRecords(records);
        }
    } catch (error) {
        showAlert(error.message || 'Failed to load attendance history');
        emptyState.style.display = 'block';
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Display records
function displayRecords(records) {
    if (!records || records.length === 0) {
        emptyState.style.display = 'block';
        recordsContainer.style.display = 'none';
        return;
    }

    recordsCount.textContent = records.length;
    recordsContainer.style.display = 'block';
    emptyState.style.display = 'none';

    attendanceList.innerHTML = records.map(record => {
        const recordDate = formatDate(record.time_recorded);
        const recordTime = new Date(record.time_recorded).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Check if record is deleted
        if (record.is_deleted) {
            const deletedDate = formatDate(record.deleted_at);
            const deletedTime = new Date(record.deleted_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="attendance-record-card deleted-record">
                    <div class="record-header">
                        <h4>${record.subject}</h4>
                        <span class="badge badge-danger">Deleted Record</span>
                    </div>
                    <div class="record-details">
                        <div class="record-detail-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>${record.center_name}</span>
                        </div>
                        <div class="record-detail-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span>${recordDate}</span>
                        </div>
                        <div class="record-detail-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span>Session: ${formatTime(record.start_time)} - ${formatTime(record.end_time)}</span>
                        </div>
                        <div class="record-detail-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span class="deleted-info">Deleted by ${record.deleted_by} on ${deletedDate} at ${deletedTime}</span>
                        </div>
                        ${record.deletion_reason ? `
                        <div class="record-detail-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span class="deletion-reason">Reason: ${record.deletion_reason}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Normal active record
        const delayMinutes = record.delay_minutes || 0;
        
        // Status: "On Time" if delay <= 10 minutes
        const statusText = delayMinutes <= 10 ? 'On Time' : `Late ${delayMinutes} min`;
        const statusClass = delayMinutes <= 10 ? 'badge-success' : 'badge-warning';
        
        // Delay badge: Always show actual delay time
        const delayBadge = delayMinutes > 0
            ? `<span class="badge badge-warning">+${delayMinutes} min</span>`
            : delayMinutes < 0
            ? `<span class="badge badge-info">${delayMinutes} min</span>`
            : '<span class="badge badge-success">0 min</span>';
        
        // Status badge
        const statusBadge = `<span class="badge ${statusClass}">${statusText}</span>`;

        return `
            <div class="attendance-record-card">
                <div class="record-header">
                    <h4>${record.subject}</h4>
                    ${delayBadge}
                </div>
                <div class="record-details">
                    <div class="record-detail-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>${record.center_name}</span>
                    </div>
                    <div class="record-detail-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>${recordDate}</span>
                    </div>
                    <div class="record-detail-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>Session: ${formatTime(record.start_time)} - ${formatTime(record.end_time)}</span>
                    </div>
                    <div class="record-detail-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>Marked at: ${recordTime}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Apply filters
function applyFilters() {
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;

    loadAttendanceHistory({ dateFrom, dateTo });
}

// Reset filters
function resetFilters() {
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    loadAttendanceHistory();
}

// Update user display
function updateUserDisplay() {
    const user = window.api.getUser();
    if (user) {
        document.getElementById('user-name').textContent = user.name;
    }
}

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    window.api.logout();
    window.location.href = '/assistant/index.html';
});

// Event listeners
document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);

// Initialize
updateUserDisplay();
loadAttendanceHistory();
