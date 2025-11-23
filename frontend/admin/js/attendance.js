// Attendance Reports JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

// Display user info
document.getElementById('user-name').textContent = user.name;
document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        window.api.removeToken();
        window.location.href = 'index.html';
    }
});

let allAttendanceRecords = [];
let filteredRecords = [];
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};
let isLoading = false;

// Alert function
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Load centers and assistants for filter dropdowns
async function loadFilters() {
    try {
        const [centersResponse, assistantsResponse] = await Promise.all([
            window.api.makeRequest('GET', '/centers'),
            window.api.makeRequest('GET', '/admin/users')
        ]);

        if (centersResponse.success) {
            const centerSelect = document.getElementById('filter-center');
            centerSelect.innerHTML = '<option value="">All Centers</option>' +
                centersResponse.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        if (assistantsResponse.success) {
            const assistantSelect = document.getElementById('filter-assistant');
            const assistants = assistantsResponse.data.filter(u => u.role === 'assistant');
            assistantSelect.innerHTML = '<option value="">All Assistants</option>' +
                assistants.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

// Load attendance records with filters and pagination
async function loadAttendance(filters = {}, page = 1) {
    if (isLoading) return;
    isLoading = true;

    try {
        const params = new URLSearchParams({
            page: page,
            limit: 50,
            ...filters
        });

        const response = await window.api.makeRequest('GET', `/admin/attendance?${params}`);

        if (response.success) {
            allAttendanceRecords = response.data;
            filteredRecords = [...allAttendanceRecords];
            currentPage = response.pagination.page;
            totalPages = response.pagination.pages;

            displayAttendance(filteredRecords);
            updatePagination(response.pagination);
            updateRecordsCount(response.pagination.total);
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        showAlert('Failed to load attendance records', 'error');
    } finally {
        isLoading = false;
    }
}

// Display attendance in table
function displayAttendance(records) {
    const tbody = document.getElementById('attendance-table');

    if (!records || records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No attendance records found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = records.map(record => {
        const attendanceDate = new Date(record.time_recorded).toLocaleDateString();
        const attendanceTime = new Date(record.time_recorded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const delayMinutes = record.delay_minutes || 0;
        const delayBadge = delayMinutes > 0
            ? `<span class="badge badge-warning">+${delayMinutes} min</span>`
            : '<span class="badge badge-success">On Time</span>';

        const statusBadge = delayMinutes === 0
            ? '<span class="badge badge-success">On Time</span>'
            : '<span class="badge badge-warning">Late</span>';

        return `
            <tr>
                <td><strong>${record.assistant_name || 'Unknown'}</strong></td>
                <td>${record.subject || 'N/A'}</td>
                <td>${record.center_name || 'Unknown'}</td>
                <td>${attendanceDate}</td>
                <td>${attendanceTime}</td>
                <td>${statusBadge}</td>
                <td>${delayBadge}</td>
            </tr>
        `;
    }).join('');
}

// Update pagination controls
function updatePagination(pagination) {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.pages;
    pageInfo.textContent = `Page ${pagination.page} of ${pagination.pages}`;
}

// Update records count display
function updateRecordsCount(total) {
    const countEl = document.getElementById('records-count');
    countEl.textContent = `Showing ${allAttendanceRecords.length} of ${total} records`;
}

// Apply filters
async function applyFilters() {
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const centerId = document.getElementById('filter-center').value;
    const assistantId = document.getElementById('filter-assistant').value;
    const searchTerm = document.getElementById('search-input').value.trim();

    currentFilters = {
        start_date: dateFrom || undefined,
        end_date: dateTo || undefined,
        center_id: centerId || undefined,
        assistant_id: assistantId || undefined,
        subject: searchTerm || undefined
    };

    // Remove undefined values
    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key] === undefined) delete currentFilters[key];
    });

    await loadAttendance(currentFilters, 1);
    showAlert(`Filters applied successfully`);
}

// Reset filters
function resetFilters() {
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-center').value = '';
    document.getElementById('filter-assistant').value = '';
    document.getElementById('search-input').value = '';

    currentFilters = {};
    loadAttendance({}, 1);
    showAlert('Filters reset');
}

// Export to Excel
function exportToExcel() {
    if (allAttendanceRecords.length === 0) {
        showAlert('No records to export', 'error');
        return;
    }

    const data = allAttendanceRecords.map(record => {
        const attendanceDate = new Date(record.time_recorded).toLocaleDateString();
        const attendanceTime = new Date(record.time_recorded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
            'Assistant': record.assistant_name || 'Unknown',
            'Session': record.subject || 'N/A',
            'Center': record.center_name || 'Unknown',
            'Date': attendanceDate,
            'Time': attendanceTime,
            'Status': record.delay_minutes === 0 ? 'On Time' : 'Late',
            'Delay (minutes)': record.delay_minutes || 0
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

    const filename = `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);

    showAlert('Attendance report exported successfully');
}

// Manual Attendance Modal
let allAssistants = [];
let allSessions = [];

// Load assistants and sessions for manual attendance
async function loadManualAttendanceData() {
    try {
        const [assistantsResponse, sessionsResponse] = await Promise.all([
            window.api.makeRequest('GET', '/admin/users'),
            window.api.makeRequest('GET', '/admin/sessions')
        ]);

        if (assistantsResponse.success) {
            allAssistants = assistantsResponse.data.filter(u => u.role === 'assistant');
        }

        if (sessionsResponse.success) {
            allSessions = sessionsResponse.data;
        }
    } catch (error) {
        console.error('Error loading manual attendance data:', error);
    }
}

// Open manual attendance modal
function openManualAttendanceModal() {
    const modal = document.getElementById('manual-attendance-modal');
    const assistantSelect = document.getElementById('manual-assistant');
    const sessionSelect = document.getElementById('manual-session');

    // Populate assistants
    assistantSelect.innerHTML = '<option value="">Select Assistant</option>';
    allAssistants.forEach(assistant => {
        const option = document.createElement('option');
        option.value = assistant.id;
        option.textContent = assistant.name;
        assistantSelect.appendChild(option);
    });

    // Populate sessions (recent ones)
    sessionSelect.innerHTML = '<option value="">Select Session</option>';
    allSessions.slice(0, 50).forEach(session => { // Limit to recent 50 sessions
        const option = document.createElement('option');
        option.value = session.id;
        option.textContent = `${session.subject} - ${session.center_name} (${new Date(session.start_time).toLocaleDateString()})`;
        sessionSelect.appendChild(option);
    });

    // Set current datetime as default
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('manual-time').value = now.toISOString().slice(0, 16);

    modal.style.display = 'flex';
    // Add active class to trigger CSS transitions
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

// Close manual attendance modal
function closeManualAttendanceModal() {
    const modal = document.getElementById('manual-attendance-modal');
    const form = document.getElementById('manual-attendance-form');

    // Remove active class to trigger fade out
    modal.classList.remove('active');

    // Wait for transition to complete before hiding
    setTimeout(() => {
        modal.style.display = 'none';
        form.reset();
    }, 300);
}

// Handle manual attendance form submission
async function handleManualAttendanceSubmit(e) {
    e.preventDefault();

    const assistantId = document.getElementById('manual-assistant').value;
    const sessionId = document.getElementById('manual-session').value;
    const timeRecorded = document.getElementById('manual-time').value;
    const notes = document.getElementById('manual-notes').value;

    if (!assistantId || !sessionId) {
        showAlert('Please select both assistant and session', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-manual-btn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Recording...';

    try {
        const response = await window.api.makeRequest('POST', '/admin/attendance/manual', {
            assistant_id: parseInt(assistantId),
            session_id: parseInt(sessionId),
            time_recorded: timeRecorded || null,
            notes: notes || null
        });

        if (response.success) {
            showAlert(response.message, 'success');
            closeManualAttendanceModal();
            // Refresh attendance records
            loadAttendance();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to record attendance', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// Event listeners
document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);
document.getElementById('export-btn').addEventListener('click', exportToExcel);

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
        loadAttendance(currentFilters, currentPage - 1);
    }
});

document.getElementById('next-page-btn').addEventListener('click', () => {
    if (currentPage < totalPages) {
        loadAttendance(currentFilters, currentPage + 1);
    }
});

// Manual attendance modal events
document.getElementById('manual-attendance-btn').addEventListener('click', openManualAttendanceModal);
document.getElementById('close-manual-modal').addEventListener('click', closeManualAttendanceModal);
document.getElementById('cancel-manual-btn').addEventListener('click', closeManualAttendanceModal);
document.getElementById('manual-attendance-form').addEventListener('submit', handleManualAttendanceSubmit);

// Close modal when clicking outside
document.getElementById('manual-attendance-modal').addEventListener('click', (e) => {
    if (e.target.id === 'manual-attendance-modal') {
        closeManualAttendanceModal();
    }
});

// Clear Attendance Modal
function openClearAttendanceModal() {
    const modal = document.getElementById('clear-attendance-modal');
    modal.style.display = 'flex';
    // Add active class to trigger CSS transitions
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeClearAttendanceModal() {
    const modal = document.getElementById('clear-attendance-modal');
    const form = document.getElementById('clear-attendance-form');

    // Remove active class to trigger fade out
    modal.classList.remove('active');

    // Wait for transition to complete before hiding
    setTimeout(() => {
        modal.style.display = 'none';
        form.reset();
    }, 300);
}

async function handleClearAttendanceSubmit(e) {
    e.preventDefault();

    const password = document.getElementById('clear-password').value;

    if (!password) {
        showAlert('Please enter the password', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirm-clear-btn');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Clearing...';

    try {
        const response = await window.api.makeRequest('DELETE', '/admin/attendance/clear', {
            password: password
        });

        if (response.success) {
            showAlert(response.message, 'success');
            closeClearAttendanceModal();
            // Refresh attendance records (should show empty)
            loadAttendance({}, 1);
        }
    } catch (error) {
        showAlert(error.message || 'Failed to clear attendance records', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}

// Clear attendance modal events
document.getElementById('clear-attendance-btn').addEventListener('click', openClearAttendanceModal);
document.getElementById('close-clear-modal').addEventListener('click', closeClearAttendanceModal);
document.getElementById('cancel-clear-btn').addEventListener('click', closeClearAttendanceModal);
document.getElementById('clear-attendance-form').addEventListener('submit', handleClearAttendanceSubmit);

// Close clear modal when clicking outside
document.getElementById('clear-attendance-modal').addEventListener('click', (e) => {
    if (e.target.id === 'clear-attendance-modal') {
        closeClearAttendanceModal();
    }
});

// Initialize
loadFilters();
loadAttendance({}, 1);
loadManualAttendanceData();
