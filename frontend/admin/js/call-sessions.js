// Call Sessions Management JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

let currentSessionToDelete = null;
let assistants = [];

// Alert function
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Format filter status for display
function formatFilterStatus(status) {
    if (!status) return 'Pending';

    const statusMap = {
        'present': 'Present (حاضر)',
        'wrong-number': 'Wrong Number',
        'no-answer': 'No Answer',
        'online-makeup': 'Online Makeup',
        'left-teacher': 'Left Teacher',
        'other-makeup': 'Other Makeup',
        'tired': 'Tired'
    };

    return statusMap[status] || status;
}

// Get color for filter status
function getFilterStatusColor(status) {
    if (!status) return { bg: '#f3f4f6', text: '#374151' };

    // Present status gets special green styling
    if (status === 'present') {
        return { bg: '#dcfce7', text: '#166534' };
    }

    // Other statuses use the same styling as before
    return { bg: '#dcfce7', text: '#166534' };
}

// Load assistants for dropdown
async function loadAssistants() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/users');
        if (response.success) {
            assistants = response.data.filter(u => u.role === 'assistant');
            populateAssistantDropdown();
        }
    } catch (error) {
        console.error('Error loading assistants:', error);
    }
}

function populateAssistantDropdown() {
    const select = document.getElementById('session-assistant');
    select.innerHTML = '<option value="">Any Assistant</option>' +
        assistants.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
}

// Load all call sessions
async function loadSessions() {
    try {
        // Check authentication first
        if (!window.api.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }

        const response = await window.api.makeRequest('GET', '/activities/call-sessions');
        if (response.success) {
            displaySessions(response.data);
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showAlert('Failed to load call sessions: ' + (error.response?.data?.message || error.message), 'error');
    }
}

// Display sessions in table
function displaySessions(sessions) {
    const tbody = document.getElementById('sessions-table');

    if (!sessions || sessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No call sessions found. Click "Create Call Session" to start.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sessions.map(session => {
        // Use the formatted assistant display from backend
        const assistantsList = session.assistant_display
            ? session.assistant_display.replace(/\n/g, '<br>')
            : '<span style="color: #888;">Any</span>';

        // Status badge
        let statusBadge = '';
        switch (session.status) {
            case 'completed':
                statusBadge = '<span class="badge badge-success">Completed</span>';
                break;
            case 'active':
                statusBadge = '<span class="badge badge-primary">Active</span>';
                break;
            default:
                statusBadge = '<span class="badge" style="background: #e5e7eb; color: #374151;">Pending</span>';
        }

        return `
            <tr data-id="${session.id}">
                <td><strong>${session.name}</strong></td>
                <td>${session.date}</td>
                <td>${session.start_time}</td>
                <td>${statusBadge}</td>
                <td>${assistantsList}</td>
                <td>
                    <button class="btn btn-sm btn-outline view-students-btn" data-id="${session.id}">
                        View Students
                    </button>
                </td>
                <td>
                    <div class="table-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon monitor-btn" data-id="${session.id}" title="Monitor" style="color: var(--accent-blue);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <button class="btn-icon edit-btn" data-id="${session.id}" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        ${session.status !== 'completed' ? `
                        <button class="btn-icon end-btn" data-id="${session.id}" title="End Session" style="color: var(--accent-orange);">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <rect x="9" y="9" width="6" height="6"></rect>
                            </svg>
                        </button>
                        ` : ''}
                        <a href="../assistant/call-session.html?session=${session.id}" target="_blank" class="btn-icon" title="Join as Assistant" style="color: var(--accent-purple); display: flex; align-items: center; justify-content: center; text-decoration: none;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10 17 15 12 10 7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                            </svg>
                        </a>
                        <button class="btn-icon delete-btn" data-id="${session.id}" title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Attach event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editSession(btn.dataset.id));
    });

    document.querySelectorAll('.end-btn').forEach(btn => {
        btn.addEventListener('click', () => endSession(btn.dataset.id));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });

    document.querySelectorAll('.view-students-btn').forEach(btn => {
        btn.addEventListener('click', () => openStudentsModal(btn.dataset.id));
    });

    document.querySelectorAll('.monitor-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `monitor-session.html?session=${btn.dataset.id}`;
        });
    });
}

// Modal functions
const sessionModal = document.getElementById('session-modal');
const deleteModal = document.getElementById('delete-modal');
const studentsModal = document.getElementById('students-modal');

function openSessionModal(sessionId = null) {
    if (sessionId) {
        document.getElementById('modal-title').textContent = 'Edit Call Session';
        document.getElementById('file-upload-group').style.display = 'block'; // Allow adding more students
        loadSessionData(sessionId);
    } else {
        document.getElementById('modal-title').textContent = 'Create Call Session';
        document.getElementById('session-form').reset();
        document.getElementById('session-id').value = '';
        document.getElementById('file-upload-group').style.display = 'block';

        // Default to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('session-date').value = today;
    }

    sessionModal.classList.add('active');
}

function closeSessionModal() {
    sessionModal.classList.remove('active');
}

async function loadSessionData(id) {
    try {
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${id}`);

        if (response.success) {
            const session = response.data;

            document.getElementById('session-id').value = session.id;
            document.getElementById('session-name').value = session.name;
            document.getElementById('session-date').value = session.date;
            document.getElementById('session-time').value = session.start_time;
            document.getElementById('session-assistant').value = session.assistant_id || '';
        }
    } catch (error) {
        console.error('Error loading session:', error);
        showAlert('Failed to load session data', 'error');
    }
}

function editSession(id) {
    openSessionModal(id);
}

// Parsing Helper (Excel & CSV)
function parseImportFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });

                // Assuming first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON with raw values to handle various headers
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                console.log('Parsed raw data:', jsonData.slice(0, 2)); // Debug log for user

                // Skip header row (first row)
                const dataRows = jsonData.slice(1);

                const normalizedData = dataRows.map(row => {
                    const newRow = {};

                    // Flexible Column Mapping
                    Object.keys(row).forEach(key => {
                        // Normalize key: removal all special chars, lowercase
                        const cleanKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                        const val = row[key];

                        if (!val && val !== 0) return; // Skip empty values, but keep 0

                        // Name detection
                        if (['name', 'studentname', 'student'].includes(cleanKey)) {
                            newRow.name = val;
                        }
                        // Phone detection (Student)
                        else if (['studentphone', 'phone', 'mobile', 'studentmobile'].includes(cleanKey)) {
                            newRow.studentPhone = String(val);
                        }
                        // Phone detection (Parent)
                        else if (['parentphone', 'fatherphone', 'motherphone', 'parentmobile'].includes(cleanKey)) {
                            newRow.parentPhone = String(val);
                        }
                        // Exam Mark
                        else if (['exammark', 'mark', 'score', 'degree', 'grade', 'exam'].includes(cleanKey)) {
                            newRow.examMark = val;
                        }
                        // Center
                        else if (['center', 'location', 'branch', 'group'].includes(cleanKey)) {
                            newRow.center = val;
                        }
                        // Student ID
                        else if (['studentid', 'id', 'code', 'studentcode'].includes(cleanKey)) {
                            newRow.studentId = val;
                        }
                        // Attendance Status
                        else if (['attendancestatus', 'attendance', 'status', 'present', 'absent'].includes(cleanKey)) {
                            newRow.attendanceStatus = val;
                        }
                        // Homework Status
                        else if (['homeworkstatus', 'homework', 'hw', 'hwstatus', 'assignment', 'assignmentstatus'].includes(cleanKey)) {
                            newRow.homeworkStatus = val;
                        }
                    });

                    // Validation: Must have at least a name
                    if (!newRow.name) return null;

                    // Skip if name looks like a header (contains common header words)
                    const nameLower = newRow.name.toString().toLowerCase();
                    if (nameLower.includes('name') || nameLower.includes('student') || nameLower.includes('id') || nameLower.length < 2) {
                        return null;
                    }

                    // Cleaning up phones (remove dashes, spaces if needed, or keep as is)
                    if (newRow.studentPhone) {
                        newRow.studentPhone = newRow.studentPhone.replace(/[^0-9+]/g, '');
                        // Add +20 prefix if missing and doesn't start with +
                        if (newRow.studentPhone && !newRow.studentPhone.startsWith('+')) {
                            // Remove leading 0 if present
                            if (newRow.studentPhone.startsWith('0')) {
                                newRow.studentPhone = newRow.studentPhone.substring(1);
                            }
                            newRow.studentPhone = '+20' + newRow.studentPhone;
                        }
                    }
                    if (newRow.parentPhone) {
                        newRow.parentPhone = newRow.parentPhone.replace(/[^0-9+]/g, '');
                        // Add +20 prefix if missing and doesn't start with +
                        if (newRow.parentPhone && !newRow.parentPhone.startsWith('+')) {
                            // Remove leading 0 if present
                            if (newRow.parentPhone.startsWith('0')) {
                                newRow.parentPhone = newRow.parentPhone.substring(1);
                            }
                            newRow.parentPhone = '+20' + newRow.parentPhone;
                        }
                    }

                    return newRow;
                }).filter(r => r !== null);

                console.log(`Mapped ${normalizedData.length} students from ${jsonData.length} rows.`);
                resolve(normalizedData);
            } catch (error) {
                console.error("Parsing error:", error);
                reject(new Error("Failed to parse file. Please check the format."));
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
}

// Save session
document.getElementById('session-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = document.getElementById('save-btn');
    const originalBtnText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const id = document.getElementById('session-id').value;
        const name = document.getElementById('session-name').value;
        const date = document.getElementById('session-date').value;
        const time = document.getElementById('session-time').value;
        const assistantId = document.getElementById('session-assistant').value || null;

        // 1. Create/Update Session
        const sessionData = {
            name,
            date,
            start_time: time,
            assistant_id: assistantId
        };

        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/activities/call-sessions/${id}` : '/activities/call-sessions';

        const response = await window.api.makeRequest(method, endpoint, sessionData);

        if (!response.success) {
            throw new Error(response.message || 'Failed to save session');
        }

        const sessionId = response.data?.id || id; // Use returned ID or existing ID

        // 2. Handle File Upload OR Merged Data
        const fileInput = document.getElementById('students-file');
        const importType = document.getElementById('import-type').value;
        let studentsToUpload = null;

        if (fileInput.files.length > 0) {
            // Parse uploaded file
            try {
                saveBtn.textContent = 'Uploading students...';
                studentsToUpload = await parseImportFile(fileInput.files[0]);
            } catch (fileError) {
                console.error('File processing error:', fileError);
                showAlert('Session created, but failed to upload students: ' + fileError.message, 'error');
            }
        } else if (window.mergedStudentsData && window.mergedStudentsData.length > 0) {
            // Use merged data if available
            studentsToUpload = window.mergedStudentsData;
            saveBtn.textContent = 'Uploading merged students...';
        }

        // Apply Import Type & Deduplication
        if (studentsToUpload && studentsToUpload.length > 0) {
            // 1. Apply Status
            if (importType === 'absent') {
                studentsToUpload.forEach(s => s.attendanceStatus = 'Absent');
            } else if (importType === 'present') {
                studentsToUpload.forEach(s => s.attendanceStatus = 'Present');
            }

            // 2. Prevent Duplication (within this batch)
            const uniqueStudents = [];
            const seen = new Set();

            studentsToUpload.forEach(s => {
                // Use phone as primary key, name as fallback
                const key = s.studentPhone ? s.studentPhone.replace(/[^0-9]/g, '') : s.name.toLowerCase().trim();

                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueStudents.push(s);
                }
            });

            if (studentsToUpload.length > uniqueStudents.length) {
                console.log(`Removed ${studentsToUpload.length - uniqueStudents.length} duplicates from upload.`);
            }
            studentsToUpload = uniqueStudents;
        }

        // Upload students if we have any
        if (studentsToUpload && studentsToUpload.length > 0) {
            try {
                await window.api.makeRequest('POST', `/activities/call-sessions/${sessionId}/students`, { students: studentsToUpload });
                // Clear merged data after successful upload
                window.mergedStudentsData = null;
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                showAlert('Session created, but failed to upload students: ' + uploadError.message, 'error');
            }
        }

        showAlert(id ? 'Session updated successfully' : 'Session created successfully');
        closeSessionModal();
        loadSessions();

    } catch (error) {
        console.error('Error saving session:', error);
        showAlert(error.message || 'Failed to save session', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalBtnText;
    }
});

// End Session
async function endSession(id) {
    if (!confirm('Are you sure you want to end this session? This will force-end all active assistants and mark the session as completed.')) return;

    try {
        const response = await window.api.makeRequest('PUT', `/activities/call-sessions/${id}`, {
            status: 'completed'
        });

        if (response.success) {
            showAlert('Session ended successfully - all active assistants have been force-ended');
            loadSessions();
        } else {
            showAlert('Failed to end session', 'error');
        }
    } catch (error) {
        console.error('Error ending session:', error);
        showAlert('Error ending session', 'error');
    }
}

// Delete functions
function openDeleteModal(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const sessionName = row.querySelector('strong').textContent;

    currentSessionToDelete = id;
    document.getElementById('delete-session-name').textContent = sessionName;
    deleteModal.classList.add('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    currentSessionToDelete = null;
}

async function deleteSession() {
    if (!currentSessionToDelete) return;

    try {
        const response = await window.api.makeRequest('DELETE', `/activities/call-sessions/${currentSessionToDelete}`);

        if (response.success) {
            showAlert('Session deleted successfully');
            closeDeleteModal();
            loadSessions();
        } else {
            showAlert(response.message || 'Failed to delete session', 'error');
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        showAlert('Failed to delete session', 'error');
    }
}

// Students Modal
async function openStudentsModal(id) {
    studentsModal.classList.add('active');
    const loading = document.getElementById('students-loading');
    const tbody = document.getElementById('students-list-body');

    loading.style.display = 'block';
    tbody.innerHTML = '';

    try {
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${id}/students`);

        if (response.success) {
            const students = response.data;
            if (students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No students found in this session.</td></tr>';
            } else {
                tbody.innerHTML = students.map(s => {
                    const lastComment = s.comments && s.comments.length > 0
                        ? s.comments[s.comments.length - 1].text
                        : '-';

                    return `
                        <tr>
                            <td>${s.name}</td>
                            <td>${s.studentPhone || '-'}</td>
                            <td>${s.parentPhone || '-'}</td>
                            <td><span class="badge" style="background: ${getFilterStatusColor(s.filterStatus).bg}; color: ${getFilterStatusColor(s.filterStatus).text};">${formatFilterStatus(s.filterStatus)}</span></td>
                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lastComment}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Error loading students:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: red;">Failed to load students.</td></tr>';
    } finally {
        loading.style.display = 'none';
    }
}

function closeStudentsModal() {
    studentsModal.classList.remove('active');
}

// Helper: Get Search params
document.getElementById('search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#sessions-table tr');

    rows.forEach(row => {
        const name = row.querySelector('strong')?.textContent.toLowerCase() || '';
        if (name.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

// Event listeners
document.getElementById('add-session-btn').addEventListener('click', () => openSessionModal());
document.getElementById('close-modal').addEventListener('click', closeSessionModal);
document.getElementById('cancel-btn').addEventListener('click', closeSessionModal);

document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
document.getElementById('confirm-delete-btn').addEventListener('click', deleteSession);

document.getElementById('close-students-modal').addEventListener('click', closeStudentsModal);
document.getElementById('close-students-btn').addEventListener('click', closeStudentsModal);

// Close on overlay click
sessionModal.addEventListener('click', (e) => {
    if (e.target === sessionModal) closeSessionModal();
});
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});
studentsModal.addEventListener('click', (e) => {
    if (e.target === studentsModal) closeStudentsModal();
});

// Init
loadAssistants();
loadSessions();

// Check for merged data from merge-files page
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('autoCreate') === 'true') {
    const mergedDataStr = sessionStorage.getItem('mergedStudentsData');
    if (mergedDataStr) {
        try {
            const mergedData = JSON.parse(mergedDataStr);
            // Clear the session storage
            sessionStorage.removeItem('mergedStudentsData');

            // Show alert
            showAlert(`Loaded ${mergedData.length} students from merged file. Please create a session to use them.`);

            // Store in a global variable for use when creating session
            window.mergedStudentsData = mergedData;

            // Auto-open create modal after a short delay
            setTimeout(() => {
                openSessionModal();
                showAlert(`Ready to create session with ${mergedData.length} merged students`, 'info');
            }, 500);
        } catch (error) {
            console.error('Error loading merged data:', error);
        }
    }
}


// Monitor Modal Functions
const monitorModal = document.getElementById('monitor-modal');

function openMonitorModal(id) {
    monitorModal.classList.add('active');
    loadMonitorData(id);
}

function closeMonitorModal() {
    monitorModal.classList.remove('active');
}

async function loadMonitorData(id) {
    const tbody = document.getElementById('monitor-table-body');
    const leaderboardEl = document.getElementById('assistant-leaderboard');

    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading data...</td></tr>';
    leaderboardEl.innerHTML = '<div class="text-center">Loading...</div>';

    try {
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${id}/students`);

        if (response.success) {
            const students = response.data;

            // 1. Stats Calculation
            const total = students.length;
            const completed = students.filter(s => s.filterStatus).length;
            const pending = total - completed;

            document.getElementById('monitor-total').textContent = total;
            document.getElementById('monitor-completed').textContent = completed;
            document.getElementById('monitor-pending').textContent = pending;

            // 2. Leaderboard Calculation
            const assistantStats = {};
            students.forEach(s => {
                if (s.lastCalledBy) {
                    assistantStats[s.lastCalledBy] = (assistantStats[s.lastCalledBy] || 0) + 1;
                }
            });

            // Sort leaderboard
            const leaderboard = Object.entries(assistantStats)
                .sort(([, a], [, b]) => b - a); // Descending

            if (leaderboard.length === 0) {
                leaderboardEl.innerHTML = '<div style="color: #64748b; font-size: 0.9rem;">No calls made yet.</div>';
            } else {
                leaderboardEl.innerHTML = leaderboard.map(([name, count]) => `
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9;">
                        <span style="font-weight: 500; color: #334155;">${name}</span>
                        <span class="badge badge-primary">${count}</span>
                    </div>
                `).join('');
            }

            // 3. Render Table
            if (students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">No students found.</td></tr>';
            } else {
                tbody.innerHTML = students.map(s => {
                    const lastComment = s.comments && s.comments.length > 0
                        ? s.comments[s.comments.length - 1].text
                        : '-';

                    const calledBy = (s.assignedTo && !s.filterStatus) ?
                        `<span style="color: #ea580c;">In Progress (${s.assignedTo})</span>` :
                        (s.lastCalledBy || '<span style="color: #94a3b8;">-</span>');

                    return `
                        <tr>
                            <td>${s.name}</td>
                            <td><span class="badge" style="background: ${getFilterStatusColor(s.filterStatus).bg}; color: ${getFilterStatusColor(s.filterStatus).text};">${formatFilterStatus(s.filterStatus)}</span></td>
                            <td>${calledBy}</td>
                            <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${lastComment}">${lastComment}</td>
                        </tr>
                    `;
                }).join('');
            }

        }
    } catch (error) {
        console.error('Error loading monitor data:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: red;">Failed to load data.</td></tr>';
    }
}

// Event Listeners for Monitor
document.getElementById('close-monitor-modal').addEventListener('click', closeMonitorModal);
document.getElementById('close-monitor-btn').addEventListener('click', closeMonitorModal);

monitorModal.addEventListener('click', (e) => {
    if (e.target === monitorModal) closeMonitorModal();
});

// Update displaySessions to add listener
const originalDisplaySessions = displaySessions;
displaySessions = function (sessions) {
    originalDisplaySessions(sessions); // Call original

    // Add new listeners
    document.querySelectorAll('.monitor-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `monitor-session.html?session=${btn.dataset.id}`;
        });
    });
};
