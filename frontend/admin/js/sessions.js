// Sessions Management JavaScript

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

let currentSessionToDelete = null;
let centers = [];
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

// Load centers and assistants for dropdowns
async function loadCentersAndAssistants() {
    try {
        const [centersResponse, assistantsResponse] = await Promise.all([
            window.api.makeRequest('GET', '/centers'),
            window.api.makeRequest('GET', '/admin/users')
        ]);

        if (centersResponse.success) {
            centers = centersResponse.data;
            populateCenterDropdown();
        }

        if (assistantsResponse.success) {
            assistants = assistantsResponse.data.filter(u => u.role === 'assistant');
            populateAssistantDropdown();
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function populateCenterDropdown() {
    const select = document.getElementById('session-center');
    select.innerHTML = '<option value="">Select Center</option>' +
        centers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function populateAssistantDropdown() {
    const select = document.getElementById('session-assistant');
    select.innerHTML = '<option value="">Any Assistant (Open Session)</option>' +
        assistants.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
}

// Load all sessions
async function loadSessions() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/sessions');

        if (response.success) {
            displaySessions(response.data);
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showAlert('Failed to load sessions', 'error');
    }
}

// Display sessions in table
function displaySessions(sessions) {
    const tbody = document.getElementById('sessions-table');

    if (!sessions || sessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No sessions found. Click "Add Session" to create one.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sessions.map(session => {
        const sessionDate = new Date(session.start_time).toLocaleDateString();
        const sessionTime = new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const centerName = session.center_name || 'Unknown';
        const assistantName = session.assistant_name || '<span style="color: #666;">Open Session</span>';

        // Add recurrence badge
        const recurrenceBadge = session.recurrence_type === 'weekly'
            ? '<span class="badge badge-primary" style="margin-left: 0.5rem; font-size: 0.75rem;">Weekly</span>'
            : '';

        return `
            <tr data-id="${session.id}">
                <td><strong>${session.subject || 'N/A'}</strong>${recurrenceBadge}</td>
                <td>${sessionDate}</td>
                <td>${sessionTime}</td>
                <td>${centerName}</td>
                <td>${assistantName}</td>
                <td>
                    <div class="table-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon edit-btn" data-id="${session.id}" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
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

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });
}

// Modal functions
const sessionModal = document.getElementById('session-modal');
const deleteModal = document.getElementById('delete-modal');

function openSessionModal(sessionId = null) {
    if (sessionId) {
        document.getElementById('modal-title').textContent = 'Edit Session';
        loadSessionData(sessionId);
    } else {
        document.getElementById('modal-title').textContent = 'Add New Session';
        document.getElementById('session-form').reset();
        document.getElementById('session-id').value = '';
    }

    sessionModal.classList.add('active');
}

function closeSessionModal() {
    sessionModal.classList.remove('active');
}

async function loadSessionData(id) {
    try {
        const response = await window.api.makeRequest('GET', `/admin/sessions/${id}`);

        if (response.success) {
            const session = response.data;
            const sessionDateTime = new Date(session.start_time);

            document.getElementById('session-id').value = session.id;
            document.getElementById('session-subject').value = session.subject || '';

            // Set recurrence type
            document.getElementById('session-recurrence').value = session.recurrence_type || 'one_time';

            // Trigger recurrence change to show/hide fields
            document.getElementById('session-recurrence').dispatchEvent(new Event('change'));

            // Set day of week if weekly
            if (session.day_of_week) {
                document.getElementById('session-day-of-week').value = session.day_of_week;
            }

            document.getElementById('session-date').value = sessionDateTime.toISOString().split('T')[0];
            document.getElementById('session-time').value = sessionDateTime.toTimeString().slice(0, 5);
            document.getElementById('session-center').value = session.center_id;
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

// Save session (create or update)
document.getElementById('session-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('session-id').value;
    const date = document.getElementById('session-date').value;
    const time = document.getElementById('session-time').value;
    const startTime = `${date}T${time}:00`;
    const recurrenceType = document.getElementById('session-recurrence').value;
    const dayOfWeek = document.getElementById('session-day-of-week').value || null;
    const assistantId = document.getElementById('session-assistant').value || null;

    const sessionData = {
        subject: document.getElementById('session-subject').value,
        start_time: startTime,
        center_id: document.getElementById('session-center').value,
        assistant_id: assistantId || null,
        recurrence_type: recurrenceType,
        day_of_week: dayOfWeek ? parseInt(dayOfWeek) : null
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/admin/sessions/${id}` : '/admin/sessions';

        const response = await window.api.makeRequest(method, endpoint, sessionData);

        if (response.success) {
            showAlert(id ? 'Session updated successfully' : 'Session created successfully');
            closeSessionModal();
            loadSessions();
        } else {
            showAlert(response.message || 'Failed to save session', 'error');
        }
    } catch (error) {
        console.error('Error saving session:', error);
        showAlert('Failed to save session', 'error');
    }
});

// Delete modal
function openDeleteModal(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const sessionSubject = row.querySelector('strong').textContent;

    currentSessionToDelete = id;
    document.getElementById('delete-session-name').textContent = sessionSubject;
    deleteModal.classList.add('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    currentSessionToDelete = null;
}

async function deleteSession() {
    if (!currentSessionToDelete) return;

    try {
        const response = await window.api.makeRequest('DELETE', `/admin/sessions/${currentSessionToDelete}`);

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

// Search functionality
document.getElementById('search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#sessions-table tr');

    rows.forEach(row => {
        const subject = row.querySelector('strong')?.textContent.toLowerCase() || '';
        const center = row.querySelectorAll('td')[3]?.textContent.toLowerCase() || '';
        row.style.display = (subject.includes(searchTerm) || center.includes(searchTerm)) ? '' : 'none';
    });
});

// Event listeners
document.getElementById('add-session-btn').addEventListener('click', () => openSessionModal());
document.getElementById('close-modal').addEventListener('click', closeSessionModal);
document.getElementById('cancel-btn').addEventListener('click', closeSessionModal);
document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
document.getElementById('confirm-delete-btn').addEventListener('click', deleteSession);

// Close modals on overlay click
sessionModal.addEventListener('click', (e) => {
    if (e.target === sessionModal) closeSessionModal();
});


deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

// ===================================================================
// RECURRING SESSIONS SUPPORT
// ===================================================================

// Handle recurrence type change to show/hide day of week field
const recurrenceSelect = document.getElementById('session-recurrence');
const dayOfWeekGroup = document.getElementById('day-of-week-group');
const dayOfWeekSelect = document.getElementById('session-day-of-week');
const dateHelp = document.getElementById('date-help');

if (recurrenceSelect) {
    recurrenceSelect.addEventListener('change', (e) => {
        if (e.target.value === 'weekly') {
            dayOfWeekGroup.style.display = 'block';
            dateHelp.textContent = 'Select the first occurrence date';
            dayOfWeekSelect.required = true;
        } else {
            dayOfWeekGroup.style.display = 'none';
            dateHelp.textContent = 'For one-time sessions, select the specific date';
            dayOfWeekSelect.required = false;
            dayOfWeekSelect.value = '';
        }
    });
}

// Initialize
loadCentersAndAssistants();
loadSessions();
