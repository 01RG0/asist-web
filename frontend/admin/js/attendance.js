// Attendance Reports JavaScript

// Hide WhatsApp schedule elements from attendance page
document.addEventListener('DOMContentLoaded', function() {
    // Hide any WhatsApp schedule related elements that might be loaded
    const whatsappElements = document.querySelectorAll('[id*="whatsapp"], .whatsapp-schedule, .whatsapp-related');
    whatsappElements.forEach(element => {
        element.style.display = 'none';
    });

    // Prevent WhatsApp schedule functionality from loading
    if (typeof loadWhatsAppSchedules === 'function') {
        loadWhatsAppSchedules = function() { /* Disabled on attendance page */ };
    }
    if (typeof displayWhatsAppSchedules === 'function') {
        displayWhatsAppSchedules = function() { /* Disabled on attendance page */ };
    }
});

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

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

        // Delay badge: Always show actual delay time
        const delayBadge = delayMinutes > 0
            ? `<span class="badge badge-warning">+${delayMinutes} min</span>`
            : delayMinutes < 0
                ? `<span class="badge badge-info">${delayMinutes} min</span>`
                : '<span class="badge badge-success">0 min</span>';

        // Status badge: "On Time" if delay <= 10 minutes, otherwise "Late"
        const statusBadge = delayMinutes <= 10
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
                    <button class="btn btn-danger btn-sm delete-attendance-btn" data-id="${record.id}" title="Delete Attendance" style="margin-left: 0.5rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete
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

// Export to Excel (single file with all records)
function exportToExcel() {
    if (allAttendanceRecords.length === 0) {
        showAlert('No records to export', 'error');
        return;
    }

    // Filter out any WhatsApp schedule related records (safety check)
    const filteredRecords = allAttendanceRecords.filter(record => {
        // Ensure we're only exporting attendance records, not WhatsApp schedules
        return record && typeof record.assistant_name === 'string' && record.time_recorded;
    });

    if (filteredRecords.length === 0) {
        showAlert('No valid attendance records to export', 'error');
        return;
    }

    const data = filteredRecords.map(record => {
        const attendanceDate = new Date(record.time_recorded).toLocaleDateString();
        const attendanceTime = new Date(record.time_recorded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
            'Assistant': record.assistant_name || 'Unknown',
            'Session': record.subject || 'N/A',
            'Center': record.center_name || 'Unknown',
            'Date': attendanceDate,
            'Time': attendanceTime,
            'Status': (record.delay_minutes || 0) <= 10 ? 'On Time' : 'Late',
            'Delay (minutes)': record.delay_minutes || 0,
            'Notes': record.notes || ''
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

    const filename = `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);

    showAlert('Attendance report exported successfully');
}

// Export individual files per assistant as ZIP
function exportIndividualToZip() {
    if (allAttendanceRecords.length === 0) {
        showAlert('No records to export', 'error');
        return;
    }

    // Filter out any WhatsApp schedule related records (safety check)
    const validAttendanceRecords = allAttendanceRecords.filter(record => {
        // Ensure we're only exporting attendance records, not WhatsApp schedules
        return record && typeof record.assistant_name === 'string' && record.time_recorded;
    });

    if (validAttendanceRecords.length === 0) {
        showAlert('No valid attendance records to export', 'error');
        return;
    }

    // Group records by assistant
    const recordsByAssistant = {};
    validAttendanceRecords.forEach(record => {
        const assistantName = record.assistant_name || 'Unknown';
        if (!recordsByAssistant[assistantName]) {
            recordsByAssistant[assistantName] = [];
        }
        recordsByAssistant[assistantName].push(record);
    });

    // Get date range for filename
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const dateRange = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().split('T')[0];

    const zip = new JSZip();
    let processedCount = 0;
    const totalAssistants = Object.keys(recordsByAssistant).length;

    showAlert(`Exporting ${validAttendanceRecords.length} attendance records for ${totalAssistants} assistants...`);

    // Create Excel file for each assistant and add to ZIP
    Object.entries(recordsByAssistant).forEach(([assistantName, records]) => {
        const data = records.map(record => {
            const attendanceDate = new Date(record.time_recorded).toLocaleDateString();
            const attendanceTime = new Date(record.time_recorded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return {
                'Assistant': record.assistant_name || 'Unknown',
                'Session': record.subject || 'N/A',
                'Center': record.center_name || 'Unknown',
                'Date': attendanceDate,
                'Time': attendanceTime,
                'Status': (record.delay_minutes || 0) <= 10 ? 'On Time' : 'Late',
                'Delay (minutes)': record.delay_minutes || 0,
                'Notes': record.notes || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `${assistantName} Attendance`);

        // Generate Excel file as array buffer
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

        // Sanitize filename (remove special characters)
        const safeAssistantName = assistantName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const filename = `${safeAssistantName}_attendance_${dateRange}.xlsx`;

        // Add file to ZIP
        zip.file(filename, excelBuffer);
        processedCount++;
    });

    // Generate and download ZIP file
    zip.generateAsync({ type: 'blob' }).then(content => {
        const zipFilename = `individual_attendance_reports_${dateRange}.zip`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFilename;
        link.click();

        showAlert(`Successfully exported ${processedCount} attendance files in ZIP (${totalAssistants} assistants, ${validAttendanceRecords.length} total records)`);
    }).catch(error => {
        console.error('Error creating ZIP file:', error);
        showAlert('Failed to create ZIP file', 'error');
    });
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

    // Clear previous inputs
    document.getElementById('manual-assistant-input').value = '';
    document.getElementById('manual-assistant').value = '';
    document.getElementById('manual-session-input').value = '';
    document.getElementById('manual-session').value = '';

    // Populate assistants datalist
    const assistantList = document.getElementById('manual-assistant-list');
    assistantList.innerHTML = '';
    allAssistants.forEach(assistant => {
        const option = document.createElement('option');
        option.value = assistant.name; // User types name
        option.dataset.id = assistant.id; // Store ID for lookup
        assistantList.appendChild(option);
    });

    // Populate sessions datalist
    const sessionList = document.getElementById('manual-session-list');
    sessionList.innerHTML = '';
    allSessions.slice(0, 50).forEach(session => {
        const option = document.createElement('option');
        // Format: Subject - Center (Date)
        const sessionName = `${session.subject} - ${session.center_name} (${new Date(session.start_time).toLocaleDateString()})`;
        option.value = sessionName;
        option.dataset.id = session.id;
        sessionList.appendChild(option);
    });

    // Setup input listeners to update hidden IDs
    setupSearchableInput('manual-assistant-input', 'manual-assistant-list', 'manual-assistant', allAssistants, 'name');
    setupSearchableInput('manual-session-input', 'manual-session-list', 'manual-session', allSessions, null, (s) => `${s.subject} - ${s.center_name} (${new Date(s.start_time).toLocaleDateString()})`);

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

// Helper to setup searchable input logic
function setupSearchableInput(inputId, listId, hiddenId, sourceData, nameField, nameFormatter) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);

    // Update hidden ID on input change
    input.oninput = function () {
        const val = this.value;
        const opts = document.getElementById(listId).options;
        let foundId = '';

        for (let i = 0; i < opts.length; i++) {
            if (opts[i].value === val) {
                // We stored ID in dataset, but datalist options via JS don't officially support getting dataset back easily from input value matching
                // Instead, we can look up in sourceData
                break;
            }
        }

        // Lookup in source data
        const match = sourceData.find(item => {
            const itemName = nameFormatter ? nameFormatter(item) : item[nameField];
            return itemName === val;
        });

        if (match) {
            hidden.value = match.id;
        } else {
            hidden.value = ''; // Invalid selection
        }
    };

    // Also try to find on blur in case they typed exact name but didn't click
    input.onblur = input.oninput;
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
document.getElementById('export-individual-btn').addEventListener('click', exportIndividualToZip);

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

    if (e.target.closest('.delete-attendance-btn')) {
        const button = e.target.closest('.delete-attendance-btn');
        const attendanceId = button.getAttribute('data-id');
        confirmDeleteAttendance(attendanceId);
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
async function openEditAttendanceModal(attendanceId) {
    currentEditingAttendanceId = attendanceId;
    const modal = document.getElementById('edit-attendance-modal');
    const assistantSelect = document.getElementById('edit-assistant');
    const sessionSelect = document.getElementById('edit-session');
    const centerSelect = document.getElementById('edit-center');

    // Show modal first
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);

    // Ensure data is loaded before populating dropdowns
    if (allAssistants.length === 0 || allSessions.length === 0 || allCenters.length === 0) {
        await loadManualAttendanceData();
    }

    // Populate assistants
    // Populate assistants datalist
    const assistantList = document.getElementById('edit-assistant-list');
    assistantList.innerHTML = '';
    allAssistants.forEach(assistant => {
        const option = document.createElement('option');
        option.value = assistant.name;
        assistantList.appendChild(option);
    });

    // Populate sessions datalist
    const sessionList = document.getElementById('edit-session-list');
    sessionList.innerHTML = '';
    allSessions.forEach(session => {
        const option = document.createElement('option');
        const sessionName = `${session.subject} - ${session.center_name} (${new Date(session.start_time).toLocaleDateString()})`;
        option.value = sessionName;
        sessionList.appendChild(option);
    });

    // Setup input listeners
    setupSearchableInput('edit-assistant-input', 'edit-assistant-list', 'edit-assistant', allAssistants, 'name');
    setupSearchableInput('edit-session-input', 'edit-session-list', 'edit-session', allSessions, null, (s) => `${s.subject} - ${s.center_name} (${new Date(s.start_time).toLocaleDateString()})`);

    // Populate centers
    centerSelect.innerHTML = '<option value="">Select Center</option>';
    allCenters.forEach(center => {
        const option = document.createElement('option');
        option.value = center.id;
        option.textContent = center.name;
        centerSelect.appendChild(option);
    });

    // Load current attendance data AFTER dropdowns are populated
    await loadAttendanceDataForEdit(attendanceId);
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

            // Convert IDs to strings for comparison (MongoDB ObjectIds)
            const assistantId = attendance.assistant_id ? String(attendance.assistant_id) : '';
            const sessionId = attendance.session_id ? String(attendance.session_id) : '';
            const centerId = attendance.center_id ? String(attendance.center_id) : '';

            // Populate form fields - ensure dropdowns are ready
            const assistantSelect = document.getElementById('edit-assistant');
            const sessionSelect = document.getElementById('edit-session');
            const centerSelect = document.getElementById('edit-center');

            // Set values - convert option values to strings for comparison
            // Set values for searchable inputs
            if (assistantId) {
                const assistant = allAssistants.find(a => String(a.id) === assistantId);
                if (assistant) {
                    document.getElementById('edit-assistant-input').value = assistant.name;
                    document.getElementById('edit-assistant').value = assistantId;
                }
            }

            if (sessionId) {
                const session = allSessions.find(s => String(s.id) === sessionId);
                if (session) {
                    const sessionName = `${session.subject} - ${session.center_name} (${new Date(session.start_time).toLocaleDateString()})`;
                    document.getElementById('edit-session-input').value = sessionName;
                    document.getElementById('edit-session').value = sessionId;
                } else {
                    console.warn('Session ID not found in loaded sessions:', sessionId);
                    // Set hidden ID anyway, but input empty? or maybe try to fetch it?
                    // For now just warn.
                }
            }

            // Removed old select logic for session

            if (centerId && centerSelect) {
                const centerOption = Array.from(centerSelect.options).find(
                    opt => String(opt.value) === centerId
                );
                if (centerOption) {
                    centerSelect.value = centerId;
                } else {
                    console.warn('Center ID not found in dropdown:', centerId);
                }
            }

            // Format datetime for input
            const timeRecorded = new Date(attendance.time_recorded);
            timeRecorded.setMinutes(timeRecorded.getMinutes() - timeRecorded.getTimezoneOffset());
            document.getElementById('edit-time-recorded').value = timeRecorded.toISOString().slice(0, 16);

            document.getElementById('edit-delay-minutes').value = attendance.delay_minutes || 0;
            document.getElementById('edit-notes').value = attendance.notes || '';
        } else {
            showAlert(response.message || 'Failed to load attendance data', 'error');
            closeEditAttendanceModal();
        }
    } catch (error) {
        console.error('Error loading attendance data for edit:', error);
        showAlert(error.message || 'Failed to load attendance data', 'error');
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

// Delete attendance confirmation and execution
// Delete Attendance Modal
let currentDeletingAttendanceId = null;

function openDeleteAttendanceModal(attendanceId) {
    currentDeletingAttendanceId = attendanceId;
    const modal = document.getElementById('delete-attendance-modal');
    const reasonInput = document.getElementById('delete-reason');
    const charCount = document.getElementById('reason-char-count');

    // Reset form
    reasonInput.value = '';
    charCount.textContent = '0';

    // Show modal
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);

    // Focus on reason input
    setTimeout(() => {
        reasonInput.focus();
    }, 100);
}

function closeDeleteAttendanceModal() {
    const modal = document.getElementById('delete-attendance-modal');
    const form = document.getElementById('delete-attendance-form');

    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        form.reset();
        currentDeletingAttendanceId = null;
    }, 300);
}

// Character count for deletion reason
document.getElementById('delete-reason').addEventListener('input', (e) => {
    const charCount = document.getElementById('reason-char-count');
    charCount.textContent = e.target.value.length;

    if (e.target.value.length > 200) {
        charCount.style.color = 'var(--accent-red)';
    } else {
        charCount.style.color = 'var(--text-secondary)';
    }
});

// Delete attendance form submit
document.getElementById('delete-attendance-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentDeletingAttendanceId) {
        showAlert('Error: No attendance record selected', 'error');
        return;
    }

    const reasonInput = document.getElementById('delete-reason');
    const reason = reasonInput.value.trim();

    if (!reason || reason.length === 0) {
        showAlert('Please provide a reason for deletion', 'error');
        reasonInput.focus();
        return;
    }

    if (reason.length > 200) {
        showAlert('Deletion reason cannot exceed 200 characters', 'error');
        reasonInput.focus();
        return;
    }

    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';

    try {
        const response = await window.api.makeRequest('DELETE', `/admin/attendance/${currentDeletingAttendanceId}`, {
            reason: reason
        });

        if (response.success) {
            showAlert('Attendance record deleted successfully', 'success');
            closeDeleteAttendanceModal();
            loadAttendance(currentFilters, currentPage);
        } else {
            showAlert(response.message || 'Failed to delete attendance record', 'error');
        }
    } catch (error) {
        console.error('Delete attendance error:', error);
        showAlert('An error occurred while deleting the attendance record', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete Attendance';
    }
});

// Close delete modal events
document.getElementById('close-delete-modal').addEventListener('click', closeDeleteAttendanceModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteAttendanceModal);

// Close modal when clicking outside
document.getElementById('delete-attendance-modal').addEventListener('click', (e) => {
    if (e.target.id === 'delete-attendance-modal') {
        closeDeleteAttendanceModal();
    }
});

// confirmDeleteAttendance now opens the modal (defined above)
function confirmDeleteAttendance(attendanceId) {
    openDeleteAttendanceModal(attendanceId);
}

// Initialize
loadFilters();
loadAttendance({}, 1);
loadManualAttendanceData();

// After sidebar is loaded
document.addEventListener('sidebarLoaded', () => {
    initializeSidebar();
});

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
