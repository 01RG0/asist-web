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
                <td colspan="8" class="text-center">No attendance records found.</td>
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
                <td>
                    <button class="btn btn-outline btn-sm edit-attendance-btn" data-id="${record.id}" title="Edit Attendance">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                    </button>
                </td>
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
let allCenters = [];
let currentEditingAttendanceId = null;

// Load assistants, sessions, and centers for attendance management
async function loadManualAttendanceData() {
    try {
        const [assistantsResponse, sessionsResponse, centersResponse] = await Promise.all([
            window.api.makeRequest('GET', '/admin/users'),
            window.api.makeRequest('GET', '/admin/sessions'),
            window.api.makeRequest('GET', '/centers')
        ]);

        if (assistantsResponse.success) {
            allAssistants = assistantsResponse.data.filter(u => u.role === 'assistant');
        }

        if (sessionsResponse.success) {
            allSessions = sessionsResponse.data;
        }

        if (centersResponse.success) {
            allCenters = centersResponse.data;
        }
    } catch (error) {
        console.error('Error loading attendance data:', error);
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
            assistant_id: assistantId,
            session_id: sessionId,
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

// Edit attendance modal events
document.getElementById('attendance-table').addEventListener('click', (e) => {
    if (e.target.closest('.edit-attendance-btn')) {
        const button = e.target.closest('.edit-attendance-btn');
        const attendanceId = button.getAttribute('data-id');
        openEditAttendanceModal(attendanceId);
    }
});

document.getElementById('close-edit-modal').addEventListener('click', closeEditAttendanceModal);
document.getElementById('cancel-edit-btn').addEventListener('click', closeEditAttendanceModal);
document.getElementById('edit-attendance-form').addEventListener('submit', handleEditAttendanceSubmit);

// Close edit modal when clicking outside
document.getElementById('edit-attendance-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-attendance-modal') {
        closeEditAttendanceModal();
    }
});

// Edit Attendance Modal
function openEditAttendanceModal(attendanceId) {
    currentEditingAttendanceId = attendanceId;
    const modal = document.getElementById('edit-attendance-modal');
    const assistantSelect = document.getElementById('edit-assistant');
    const sessionSelect = document.getElementById('edit-session');
    const centerSelect = document.getElementById('edit-center');

    // Populate assistants
    assistantSelect.innerHTML = '<option value="">Select Assistant</option>';
    allAssistants.forEach(assistant => {
        const option = document.createElement('option');
        option.value = assistant.id;
        option.textContent = assistant.name;
        assistantSelect.appendChild(option);
    });

    // Populate sessions
    sessionSelect.innerHTML = '<option value="">Select Session</option>';
    allSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        option.textContent = `${session.subject} - ${session.center_name} (${new Date(session.start_time).toLocaleDateString()})`;
        sessionSelect.appendChild(option);
    });

    // Populate centers
    centerSelect.innerHTML = '<option value="">Select Center</option>';
    allCenters.forEach(center => {
        const option = document.createElement('option');
        option.value = center.id;
        option.textContent = center.name;
        centerSelect.appendChild(option);
    });

    // Load current attendance data
    loadAttendanceDataForEdit(attendanceId);

    modal.style.display = 'flex';
    // Add active class to trigger CSS transitions
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeEditAttendanceModal() {
    const modal = document.getElementById('edit-attendance-modal');
    const form = document.getElementById('edit-attendance-form');

    // Remove active class to trigger fade out
    modal.classList.remove('active');

    // Wait for transition to complete before hiding
    setTimeout(() => {
        modal.style.display = 'none';
        form.reset();
        currentEditingAttendanceId = null;
    }, 300);
}

async function loadAttendanceDataForEdit(attendanceId) {
    try {
        const response = await window.api.makeRequest('GET', `/admin/attendance/${attendanceId}`);

        if (response.success) {
            const attendance = response.data;

            // Populate form fields
            document.getElementById('edit-assistant').value = attendance.assistant_id || '';
            document.getElementById('edit-session').value = attendance.session_id || '';
            document.getElementById('edit-center').value = attendance.center_id || '';

            // Format datetime for input
            const timeRecorded = new Date(attendance.time_recorded);
            timeRecorded.setMinutes(timeRecorded.getMinutes() - timeRecorded.getTimezoneOffset());
            document.getElementById('edit-time-recorded').value = timeRecorded.toISOString().slice(0, 16);

            document.getElementById('edit-delay-minutes').value = attendance.delay_minutes || 0;
            document.getElementById('edit-notes').value = attendance.notes || '';
        }
    } catch (error) {
        console.error('Error loading attendance data for edit:', error);
        showAlert('Failed to load attendance data', 'error');
        closeEditAttendanceModal();
    }
}

async function handleEditAttendanceSubmit(e) {
    e.preventDefault();

    const assistantId = document.getElementById('edit-assistant').value;
    const sessionId = document.getElementById('edit-session').value;
    const centerId = document.getElementById('edit-center').value;
    const timeRecorded = document.getElementById('edit-time-recorded').value;
    const delayMinutes = document.getElementById('edit-delay-minutes').value;
    const notes = document.getElementById('edit-notes').value;

    if (!assistantId || !sessionId || !centerId || !timeRecorded) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-edit-btn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Updating...';

    try {
        const response = await window.api.makeRequest('PUT', `/admin/attendance/${currentEditingAttendanceId}`, {
            assistant_id: assistantId,
            session_id: sessionId,
            center_id: centerId,
            time_recorded: timeRecorded,
            delay_minutes: parseInt(delayMinutes) || 0,
            notes: notes || null
        });

        if (response.success) {
            showAlert(response.message, 'success');
            closeEditAttendanceModal();
            // Refresh attendance records
            loadAttendance(currentFilters, currentPage);
        }
    } catch (error) {
        showAlert(error.message || 'Failed to update attendance', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// Initialize
initializeSidebar();
loadFilters();
loadAttendance({}, 1);
loadManualAttendanceData();

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
