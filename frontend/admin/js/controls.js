// Controls Management - Simple Version

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

let users = [];
let currentDeleteItem = null;
let currentDeleteType = null;

// Alert
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => alertContainer.innerHTML = '', 5000);
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

        const tabContent = document.getElementById(`${tab}-tab`);
        if (tabContent) tabContent.style.display = 'block';

        if (tab === 'whatsapp') loadWhatsAppSchedules();
        else if (tab === 'calls') loadCallSessions();
    });
});

// Load users
async function loadUsers() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/users');
        if (response.success) {
            users = response.data.filter(u => u.role === 'assistant');
            const select = document.getElementById('whatsapp-user');
            if (select) {
                select.innerHTML = '<option value="">Select User</option>' +
                    users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// WhatsApp Schedules
async function loadWhatsAppSchedules() {
    const tbody = document.getElementById('whatsapp-table');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const response = await window.api.makeRequest('GET', '/activities/whatsapp-schedules');
        if (response && response.success) {
            displayWhatsAppSchedules(response.data || []);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading</td></tr>';
    }
}

function displayWhatsAppSchedules(schedules) {
    const tbody = document.getElementById('whatsapp-table');

    if (!schedules || schedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No schedules found</td></tr>';
        return;
    }

    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    tbody.innerHTML = schedules.map(s => `
        <tr>
            <td>${s.user_name || 'Unknown'}</td>
            <td>${days[s.day_of_week] || s.day_of_week}</td>
            <td>${s.start_time}</td>
            <td>${s.end_time}</td>
            <td>${s.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editWhatsApp('${s.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteWhatsApp('${s.id}', '${s.user_name}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openWhatsAppModal(scheduleId = null) {
    const modal = document.getElementById('whatsapp-modal');

    if (scheduleId) {
        document.getElementById('whatsapp-modal-title').textContent = 'Edit Schedule';
        loadWhatsAppData(scheduleId);
    } else {
        document.getElementById('whatsapp-modal-title').textContent = 'Add Schedule';
        document.getElementById('whatsapp-form').reset();
        document.getElementById('whatsapp-id').value = '';
        document.getElementById('whatsapp-active').checked = true;
    }

    modal.style.display = 'flex';
}

function closeWhatsAppModal() {
    document.getElementById('whatsapp-modal').style.display = 'none';
}

async function loadWhatsAppData(id) {
    try {
        const response = await window.api.makeRequest('GET', '/activities/whatsapp-schedules');
        if (response.success) {
            const schedule = response.data.find(s => s.id === id);
            if (schedule) {
                document.getElementById('whatsapp-id').value = schedule.id;
                document.getElementById('whatsapp-user').value = schedule.user_id;
                document.getElementById('whatsapp-day').value = schedule.day_of_week;
                document.getElementById('whatsapp-start-time').value = schedule.start_time;
                document.getElementById('whatsapp-end-time').value = schedule.end_time;
                document.getElementById('whatsapp-active').checked = schedule.is_active;
            }
        }
    } catch (error) {
        showAlert('Failed to load schedule', 'error');
    }
}

function editWhatsApp(id) {
    openWhatsAppModal(id);
}

// Call Sessions
async function loadCallSessions() {
    const tbody = document.getElementById('calls-table');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const response = await window.api.makeRequest('GET', '/activities/call-sessions');
        if (response && response.success) {
            displayCallSessions(response.data || []);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading</td></tr>';
    }
}

function displayCallSessions(sessions) {
    const tbody = document.getElementById('calls-table');

    if (!sessions || sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No sessions found</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(s => {
        const status = s.status === 'pending' ? 'Pending' : s.status === 'active' ? 'Active' : 'Completed';
        const statusClass = s.status === 'active' ? 'success' : s.status === 'pending' ? 'secondary' : 'primary';
        
        // Display assistants
        let assistantDisplay = 'Not started';
        if (s.assistants && s.assistants.length > 0) {
            const names = s.assistants.map(a => a.name || 'Unknown').filter(Boolean);
            assistantDisplay = names.length > 0 ? names.join(', ') : 'Not started';
        } else if (s.assistant_name) {
            assistantDisplay = s.assistant_name;
        }
        
        const endTimeDisplay = s.end_time ? new Date(s.end_time).toLocaleString() : '-';

        return `
            <tr>
                <td><strong>${s.name || 'N/A'}</strong></td>
                <td>${new Date(s.date).toLocaleDateString()}</td>
                <td>${s.start_time}</td>
                <td>${endTimeDisplay}</td>
                <td><span class="badge badge-${statusClass}">${status}</span></td>
                <td>${assistantDisplay}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="editCall('${s.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCall('${s.id}', '${s.name}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function openCallModal(sessionId = null) {
    const modal = document.getElementById('call-modal');

    if (sessionId) {
        document.getElementById('call-modal-title').textContent = 'Edit Call Session';
        loadCallData(sessionId);
    } else {
        document.getElementById('call-modal-title').textContent = 'Add Call Session';
        document.getElementById('call-form').reset();
        document.getElementById('call-id').value = '';
    }

    modal.style.display = 'flex';
}

function closeCallModal() {
    document.getElementById('call-modal').style.display = 'none';
}

async function loadCallData(id) {
    try {
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${id}`);
        if (response.success) {
            const session = response.data;
            document.getElementById('call-id').value = session.id;
            document.getElementById('call-name').value = session.name || '';
            document.getElementById('call-date').value = session.date;
            document.getElementById('call-start-time').value = session.start_time;
            
            // Set end_time if it exists
            if (session.end_time) {
                const endTimeDate = new Date(session.end_time);
                const endTimeString = endTimeDate.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
                document.getElementById('call-end-time').value = endTimeString;
            } else {
                document.getElementById('call-end-time').value = '';
            }
        }
    } catch (error) {
        showAlert('Failed to load session', 'error');
    }
}

function editCall(id) {
    openCallModal(id);
}

// Delete Modal Logic
function openDeleteModal(id, type, name) {
    currentDeleteItem = id;
    currentDeleteType = type;

    const modal = document.getElementById('delete-modal');
    const title = document.getElementById('delete-modal-title');
    const message = document.getElementById('delete-message');

    if (type === 'whatsapp') {
        title.textContent = 'Delete Schedule';
        message.innerHTML = `Are you sure you want to delete schedule for <strong>${name}</strong>?`;
    } else {
        title.textContent = 'Delete Session';
        message.innerHTML = `Are you sure you want to delete session <strong>${name}</strong>?`;
    }

    modal.style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    currentDeleteItem = null;
    currentDeleteType = null;
}

function deleteWhatsApp(id, name) {
    openDeleteModal(id, 'whatsapp', name);
}

function deleteCall(id, name) {
    openDeleteModal(id, 'call', name);
}

async function confirmDelete() {
    if (!currentDeleteItem || !currentDeleteType) return;

    const btn = document.getElementById('confirm-delete-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Deleting...';
    btn.disabled = true;

    try {
        let endpoint = '';
        if (currentDeleteType === 'whatsapp') {
            endpoint = `/activities/whatsapp-schedules/${currentDeleteItem}`;
        } else {
            endpoint = `/activities/call-sessions/${currentDeleteItem}`;
        }

        const response = await window.api.makeRequest('DELETE', endpoint);

        if (response.success) {
            showAlert('Item deleted successfully');
            closeDeleteModal();
            if (currentDeleteType === 'whatsapp') loadWhatsAppSchedules();
            else loadCallSessions();
        } else {
            showAlert(response.message || 'Failed to delete', 'error');
        }
    } catch (error) {
        showAlert('Error deleting item', 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Form submissions
document.getElementById('whatsapp-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('whatsapp-id').value;
    const data = {
        user_id: document.getElementById('whatsapp-user').value,
        day_of_week: parseInt(document.getElementById('whatsapp-day').value),
        start_time: document.getElementById('whatsapp-start-time').value,
        end_time: document.getElementById('whatsapp-end-time').value,
        is_active: document.getElementById('whatsapp-active').checked
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/activities/whatsapp-schedules/${id}` : '/activities/whatsapp-schedules';
        const response = await window.api.makeRequest(method, endpoint, data);

        if (response.success) {
            showAlert(id ? 'Schedule updated' : 'Schedule created');
            closeWhatsAppModal();
            loadWhatsAppSchedules();
        } else {
            showAlert(response.message || 'Failed to save schedule', 'error');
        }
    } catch (error) {
        console.error(error);
        showAlert(error.message || 'Failed to save schedule', 'error');
    }
});

document.getElementById('call-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('call-id').value;
    const endTimeValue = document.getElementById('call-end-time').value;
    
    const data = {
        name: document.getElementById('call-name').value,
        date: document.getElementById('call-date').value,
        start_time: document.getElementById('call-start-time').value
    };
    
    // Add end_time if provided
    if (endTimeValue) {
        // Convert local datetime to ISO string for backend
        const endTimeDate = new Date(endTimeValue);
        data.end_time = endTimeDate.toISOString();
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/activities/call-sessions/${id}` : '/activities/call-sessions';
        const response = await window.api.makeRequest(method, endpoint, data);

        if (response.success) {
            showAlert(id ? 'Session updated' : 'Session created');
            closeCallModal();
            loadCallSessions();
        } else {
            showAlert(response.message || 'Failed to save session', 'error');
        }
    } catch (error) {
        console.error(error);
        showAlert(error.message || 'Failed to save session', 'error');
    }
});

// Event listeners
document.getElementById('add-whatsapp-btn').addEventListener('click', () => openWhatsAppModal());
document.getElementById('add-call-btn').addEventListener('click', () => openCallModal());

document.getElementById('close-whatsapp-modal').addEventListener('click', closeWhatsAppModal);
document.getElementById('cancel-whatsapp-btn').addEventListener('click', closeWhatsAppModal);

document.getElementById('close-call-modal').addEventListener('click', closeCallModal);
document.getElementById('cancel-call-btn').addEventListener('click', closeCallModal);

document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);

// Click outside to close
document.getElementById('whatsapp-modal').addEventListener('click', (e) => {
    if (e.target.id === 'whatsapp-modal') closeWhatsAppModal();
});

document.getElementById('call-modal').addEventListener('click', (e) => {
    if (e.target.id === 'call-modal') closeCallModal();
});

document.getElementById('delete-modal').addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') closeDeleteModal();
});

// Initialize
loadUsers();
loadWhatsAppSchedules();
