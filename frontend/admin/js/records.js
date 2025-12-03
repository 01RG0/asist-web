// Activity Records JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

let allRecords = [];
let filteredRecords = [];
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};
let isLoading = false;
let currentEditingRecordId = null;
let currentDeletingRecordId = null;
let allUsers = [];
let allSessions = [];

// Alert function
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Load users for filter dropdowns
async function loadUsers() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/users');
        if (response.success) {
            allUsers = response.data.filter(u => u.role === 'assistant');
            populateUserDropdowns();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function populateUserDropdowns() {
    const filterSelect = document.getElementById('filter-user');
    const editSelect = document.getElementById('edit-user');
    const addSelect = document.getElementById('add-user');

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Users</option>' +
            allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    }

    if (editSelect) {
        editSelect.innerHTML = '<option value="">Select User</option>' +
            allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    }

    if (addSelect) {
        addSelect.innerHTML = '<option value="">Select User</option>' +
            allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    }
}

// Load sessions for dropdown (not needed for records, but keeping for potential future use)
async function loadSessions() {
    // Not needed for activity records, but keeping function for consistency
}

// Load activity records with filters and pagination
async function loadRecords(filters = {}, page = 1) {
    if (isLoading) return;
    isLoading = true;

    try {
        const params = new URLSearchParams({
            page: page,
            limit: 50,
            ...filters
        });

        const response = await window.api.makeRequest('GET', `/activities/logs?${params}`);

        if (response.success) {
            allRecords = response.data;
            filteredRecords = [...allRecords];
            currentPage = response.pagination.page;
            totalPages = response.pagination.pages;

            displayRecords(filteredRecords);
            updatePagination(response.pagination);
            updateRecordsCount(response.pagination.total);
        }
    } catch (error) {
        console.error('Error loading records:', error);
        showAlert('Failed to load activity records', 'error');
    } finally {
        isLoading = false;
    }
}

// Display records in table
function displayRecords(records) {
    const tbody = document.getElementById('records-table');

    if (!records || records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No activity records found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = records.map(record => {
        const startDate = new Date(record.start_time);
        const endDate = record.end_time ? new Date(record.end_time) : null;

        const startTimeStr = startDate.toLocaleString();
        const endTimeStr = endDate ? endDate.toLocaleString() : '<span style="color: #666;">Ongoing</span>';

        const durationStr = record.duration_minutes > 0
            ? formatDuration(record.duration_minutes)
            : '<span style="color: #666;">-</span>';

        const typeBadge = record.type === 'whatsapp'
            ? '<span class="badge badge-primary">WhatsApp</span>'
            : '<span class="badge badge-success">Call</span>';

        return `
            <tr data-id="${record.id}">
                <td>${record.user_name || 'Unknown'}</td>
                <td>${typeBadge}</td>
                <td>${startTimeStr}</td>
                <td>${endTimeStr}</td>
                <td>${durationStr}</td>
                <td>
                    <div class="table-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon edit-record-btn" data-id="${record.id}" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete-record-btn" data-id="${record.id}" title="Delete">
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
    document.querySelectorAll('.edit-record-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    document.querySelectorAll('.delete-record-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });
}

// Format duration
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes}m`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
}

// Update pagination
function updatePagination(pagination) {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.pages;
    pageInfo.textContent = `Page ${pagination.page} of ${pagination.pages}`;
}

// Update records count
function updateRecordsCount(total) {
    const countEl = document.getElementById('records-count');
    countEl.textContent = `Total: ${total} records`;
}

// Search functionality
document.getElementById('search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filteredRecords = allRecords.filter(record =>
        record.user_name?.toLowerCase().includes(searchTerm)
    );
    displayRecords(filteredRecords);
});

// Filter functionality
document.getElementById('apply-filters-btn').addEventListener('click', () => {
    const filters = {
        user_id: document.getElementById('filter-user').value || undefined,
        type: document.getElementById('filter-type').value || undefined,
        start_date: document.getElementById('filter-date-from').value || undefined,
        end_date: document.getElementById('filter-date-to').value || undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    currentFilters = filters;
    loadRecords(filters, 1);
});

document.getElementById('reset-filters-btn').addEventListener('click', () => {
    document.getElementById('filter-user').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('search-input').value = '';
    currentFilters = {};
    loadRecords({}, 1);
});

// Pagination
document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
        loadRecords(currentFilters, currentPage - 1);
    }
});

document.getElementById('next-page-btn').addEventListener('click', () => {
    if (currentPage < totalPages) {
        loadRecords(currentFilters, currentPage + 1);
    }
});

// ============================================
// Edit Modal
// ============================================

const editModal = document.getElementById('edit-modal');

function openEditModal(recordId) {
    currentEditingRecordId = recordId;
    editModal.style.display = 'flex';
    loadRecordData(recordId);
}

function closeEditModal() {
    editModal.style.display = 'none';
    document.getElementById('edit-form').reset();
    currentEditingRecordId = null;
}

async function loadRecordData(recordId) {
    try {
        const response = await window.api.makeRequest('GET', `/activities/logs/${recordId}`);

        if (response.success) {
            const record = response.data;

            // Format datetime for input
            const startTime = new Date(record.start_time);
            const endTime = record.end_time ? new Date(record.end_time) : null;

            startTime.setMinutes(startTime.getMinutes() - startTime.getTimezoneOffset());
            if (endTime) {
                endTime.setMinutes(endTime.getMinutes() - endTime.getTimezoneOffset());
            }

            document.getElementById('edit-id').value = record.id;
            document.getElementById('edit-user').value = record.user_id;
            document.getElementById('edit-type').value = record.type;
            document.getElementById('edit-start-time').value = startTime.toISOString().slice(0, 16);
            document.getElementById('edit-end-time').value = endTime ? endTime.toISOString().slice(0, 16) : '';
            document.getElementById('edit-duration').value = record.duration_minutes || 0;
            document.getElementById('edit-notes').value = record.notes || '';
        }
    } catch (error) {
        console.error('Error loading record data:', error);
        showAlert('Failed to load record data', 'error');
        closeEditModal();
    }
}

// Calculate duration when start/end times change
document.getElementById('edit-start-time').addEventListener('change', calculateDuration);
document.getElementById('edit-end-time').addEventListener('change', calculateDuration);

function calculateDuration() {
    const startTime = document.getElementById('edit-start-time').value;
    const endTime = document.getElementById('edit-end-time').value;

    if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        document.getElementById('edit-duration').value = diffMinutes > 0 ? diffMinutes : 0;
    } else {
        document.getElementById('edit-duration').value = 0;
    }
}

// Save edit
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('edit-user').value;
    const type = document.getElementById('edit-type').value;
    const startTime = document.getElementById('edit-start-time').value;
    const endTime = document.getElementById('edit-end-time').value;
    const notes = document.getElementById('edit-notes').value;

    if (!userId || !type || !startTime) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-edit-btn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Updating...';

    try {
        const updateData = {
            user_id: userId,
            type: type,
            start_time: startTime,
            notes: notes || ''
        };

        if (endTime) {
            updateData.end_time = endTime;
        }

        const response = await window.api.makeRequest('PUT', `/activities/logs/${currentEditingRecordId}`, updateData);

        if (response.success) {
            showAlert('Record updated successfully', 'success');
            closeEditModal();
            loadRecords(currentFilters, currentPage);
        } else {
            showAlert(response.message || 'Failed to update record', 'error');
        }
    } catch (error) {
        showAlert(error.message || 'Failed to update record', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
});

// ============================================
// Delete Modal
// ============================================

const deleteModal = document.getElementById('delete-modal');

function openDeleteModal(recordId) {
    currentDeletingRecordId = recordId;
    deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
    deleteModal.style.display = 'none';
    document.getElementById('delete-reason').value = '';
    currentDeletingRecordId = null;
}

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (!currentDeletingRecordId) return;

    const reason = document.getElementById('delete-reason').value.trim();

    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';

    try {
        const response = await window.api.makeRequest('DELETE', `/activities/logs/${currentDeletingRecordId}`, {
            reason: reason || 'No reason provided'
        });

        if (response.success) {
            showAlert('Record deleted successfully', 'success');
            closeDeleteModal();
            loadRecords(currentFilters, currentPage);
        } else {
            showAlert(response.message || 'Failed to delete record', 'error');
        }
    } catch (error) {
        showAlert(error.message || 'Failed to delete record', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
    }
});

// ============================================
// Add Modal
// ============================================

const addModal = document.getElementById('add-modal');

function openAddModal() {
    addModal.style.display = 'flex';
    document.getElementById('add-form').reset();
    
    // Set current date/time as default
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('add-start-time').value = localDateTime;
    document.getElementById('add-duration').value = 0;
}

function closeAddModal() {
    addModal.style.display = 'none';
    document.getElementById('add-form').reset();
}

// Calculate duration when start/end times change
document.getElementById('add-start-time').addEventListener('change', calculateAddDuration);
document.getElementById('add-end-time').addEventListener('change', calculateAddDuration);

function calculateAddDuration() {
    const startTime = document.getElementById('add-start-time').value;
    const endTime = document.getElementById('add-end-time').value;

    if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        document.getElementById('add-duration').value = diffMinutes > 0 ? diffMinutes : 0;
    } else {
        document.getElementById('add-duration').value = 0;
    }
}

// Save add
document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('add-user').value;
    const type = document.getElementById('add-type').value;
    const startTime = document.getElementById('add-start-time').value;
    const endTime = document.getElementById('add-end-time').value;
    const notes = document.getElementById('add-notes').value;

    if (!userId || !type || !startTime) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-add-btn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Creating...';

    try {
        const createData = {
            user_id: userId,
            type: type,
            start_time: startTime,
            notes: notes || ''
        };

        if (endTime) {
            createData.end_time = endTime;
        }

        const response = await window.api.makeRequest('POST', '/activities/logs', createData);

        if (response.success) {
            showAlert('Record created successfully', 'success');
            closeAddModal();
            loadRecords(currentFilters, currentPage);
        } else {
            showAlert(response.message || 'Failed to create record', 'error');
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create record', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
});

// Event listeners
document.getElementById('add-record-btn').addEventListener('click', openAddModal);
document.getElementById('close-add-modal').addEventListener('click', closeAddModal);
document.getElementById('cancel-add-btn').addEventListener('click', closeAddModal);
document.getElementById('close-edit-modal').addEventListener('click', closeEditModal);
document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);

// Close modals on overlay click
addModal.addEventListener('click', (e) => {
    if (e.target === addModal) closeAddModal();
});

editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

// Initialize
loadUsers();
loadRecords({}, 1);

