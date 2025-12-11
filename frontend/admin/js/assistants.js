// Assistants Management JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

let currentAssistantToDelete = null;

// Alert function
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Load all assistants
async function loadAssistants() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/assistants');

        if (response.success) {
            displayAssistants(response.data);
        }
    } catch (error) {
        console.error('Error loading assistants:', error);
        showAlert('Failed to load assistants', 'error');
    }
}

// Display assistants in table
function displayAssistants(assistants) {
    const tbody = document.getElementById('assistants-table');

    if (!assistants || assistants.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No assistants found. Click "Add Assistant" to create one.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = assistants.map(assistant => {
        const joinedDate = new Date(assistant.created_at).toLocaleDateString();
        const roleBadge = assistant.role === 'admin'
            ? '<span class="badge badge-primary">Admin</span>'
            : '<span class="badge badge-secondary">Assistant</span>';

        return `
            <tr data-id="${assistant.id}">
                <td><strong>${assistant.name}</strong></td>
                <td>${assistant.email}</td>
                <td>${roleBadge}</td>
                <td>${joinedDate}</td>
                <td>
                    <div class="table-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon edit-btn" data-id="${assistant.id}" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon password-btn" data-id="${assistant.id}" data-name="${assistant.name}" title="Change Password" style="color: var(--accent-blue);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete-btn" data-id="${assistant.id}" title="Delete">
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
        btn.addEventListener('click', () => editAssistant(btn.dataset.id));
    });

    // Only attach password button handlers if the modal exists
    if (window.openPasswordModal) {
        document.querySelectorAll('.password-btn').forEach(btn => {
            btn.addEventListener('click', () => window.openPasswordModal(btn.dataset.id, btn.dataset.name));
        });
    }

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });
}

// Modal functions
const assistantModal = document.getElementById('assistant-modal');
const deleteModal = document.getElementById('delete-modal');

function openAssistantModal(assistantId = null) {
    if (assistantId) {
        document.getElementById('modal-title').textContent = 'Edit Assistant';
        document.getElementById('password-group').style.display = 'none';
        document.getElementById('assistant-password').required = false;
        loadAssistantData(assistantId);
    } else {
        document.getElementById('modal-title').textContent = 'Add New Assistant';
        document.getElementById('assistant-form').reset();
        document.getElementById('assistant-id').value = '';
        document.getElementById('password-group').style.display = 'block';
        document.getElementById('assistant-password').required = true;
    }

    assistantModal.classList.add('active');
}

function closeAssistantModal() {
    assistantModal.classList.remove('active');
}

async function loadAssistantData(id) {
    try {
        const response = await window.api.makeRequest('GET', `/admin/users/${id}`);

        if (response.success) {
            const assistant = response.data;
            document.getElementById('assistant-id').value = assistant.id;
            document.getElementById('assistant-name').value = assistant.name;
            document.getElementById('assistant-email').value = assistant.email;
            document.getElementById('assistant-role').value = assistant.role;
        }
    } catch (error) {
        console.error('Error loading assistant:', error);
        showAlert('Failed to load assistant data', 'error');
    }
}

function editAssistant(id) {
    openAssistantModal(id);
}

// Save assistant (create or update)
document.getElementById('assistant-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('assistant-id').value;
    const assistantData = {
        name: document.getElementById('assistant-name').value,
        email: document.getElementById('assistant-email').value,
        role: document.getElementById('assistant-role').value
    };

    if (!id) {
        assistantData.password = document.getElementById('assistant-password').value;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/admin/users/${id}` : '/admin/users';

        const response = await window.api.makeRequest(method, endpoint, assistantData);

        if (response.success) {
            showAlert(id ? 'Assistant updated successfully' : 'Assistant created successfully');
            closeAssistantModal();
            loadAssistants();
        } else {
            showAlert(response.message || 'Failed to save assistant', 'error');
        }
    } catch (error) {
        console.error('Error saving assistant:', error);
        showAlert('Failed to save assistant', 'error');
    }
});

// Delete modal
function openDeleteModal(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const assistantName = row.querySelector('strong').textContent;

    currentAssistantToDelete = id;
    document.getElementById('delete-assistant-name').textContent = assistantName;
    deleteModal.classList.add('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    currentAssistantToDelete = null;
}

async function deleteAssistant() {
    if (!currentAssistantToDelete) return;

    try {
        const response = await window.api.makeRequest('DELETE', `/admin/users/${currentAssistantToDelete}`);

        if (response.success) {
            showAlert('Assistant deleted successfully');
            closeDeleteModal();
            loadAssistants();
        } else {
            showAlert(response.message || 'Failed to delete assistant', 'error');
        }
    } catch (error) {
        console.error('Error deleting assistant:', error);
        showAlert('Failed to delete assistant', 'error');
    }
}

// Search functionality
document.getElementById('search-input').addEventListener('input', async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#assistants-table tr');

    rows.forEach(row => {
        const name = row.querySelector('strong')?.textContent.toLowerCase() || '';
        const email = row.querySelectorAll('td')[1]?.textContent.toLowerCase() || '';
        row.style.display = (name.includes(searchTerm) || email.includes(searchTerm)) ? '' : 'none';
    });
});

// Event listeners
document.getElementById('add-assistant-btn').addEventListener('click', () => openAssistantModal());
document.getElementById('close-modal').addEventListener('click', closeAssistantModal);
document.getElementById('cancel-btn').addEventListener('click', closeAssistantModal);
document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
document.getElementById('confirm-delete-btn').addEventListener('click', deleteAssistant);

// Close modals on overlay click
assistantModal.addEventListener('click', (e) => {
    if (e.target === assistantModal) closeAssistantModal();
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

// ===================================================================
// PASSWORD CHANGE MODAL
// ===================================================================

const passwordModal = document.getElementById('password-modal');

// Only initialize password modal if it exists in the HTML
if (passwordModal) {
    let currentPasswordAssistantId = null;

    function openPasswordModal(id, name) {
        currentPasswordAssistantId = id;
        document.getElementById('password-assistant-id').value = id;
        document.getElementById('password-assistant-name').textContent = name;
        document.getElementById('password-form').reset();
        passwordModal.classList.add('active');
    }

    function closePasswordModal() {
        passwordModal.classList.remove('active');
        currentPasswordAssistantId = null;
        document.getElementById('password-form').reset();
    }

    // Password form submit
    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            showAlert('Passwords do not match', 'error');
            return;
        }

        // Validate password length
        if (newPassword.length < 6) {
            showAlert('Password must be at least 6 characters long', 'error');
            return;
        }

        try {
            const response = await window.api.makeRequest(
                'PUT',
                `/admin/users/${currentPasswordAssistantId}/password`,
                { password: newPassword }
            );

            if (response.success) {
                showAlert('Password changed successfully');
                closePasswordModal();
            } else {
                showAlert(response.message || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showAlert('Failed to change password', 'error');
        }
    });

    // Password modal event listeners
    document.getElementById('close-password-modal').addEventListener('click', closePasswordModal);
    document.getElementById('cancel-password-btn').addEventListener('click', closePasswordModal);

    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) closePasswordModal();
    });

    // Make openPasswordModal available globally
    window.openPasswordModal = openPasswordModal;
}

// Initialize
loadAssistants();

// After sidebar is loaded
document.addEventListener('sidebarLoaded', () => {
    // Sidebar is now available
});
