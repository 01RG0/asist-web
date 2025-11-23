// Backup Management JavaScript

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

let allBackups = [];
let filteredBackups = [];

// Alert function
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Load backup files
async function loadBackups() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/backups');

        if (response.success) {
            allBackups = response.data;
            filteredBackups = [...allBackups];
            displayBackups(filteredBackups);
            updateBackupStats(allBackups);
        }
    } catch (error) {
        console.error('Error loading backups:', error);
        showAlert('Failed to load backup files', 'error');
    }
}

// Update backup statistics
function updateBackupStats(backups) {
    const totalBackups = backups.length;
    const totalSize = backups.reduce((sum, backup) => sum + (backup.size || 0), 0);
    const lastBackup = backups.length > 0 ? formatDate(backups[0].created_at) : 'Never';

    document.getElementById('total-backups').textContent = totalBackups;
    document.getElementById('total-size').textContent = formatFileSize(totalSize);
    document.getElementById('last-backup').textContent = lastBackup;
    document.getElementById('backup-status').textContent = 'Healthy';
}

// Display backups in table
function displayBackups(backups) {
    const tbody = document.getElementById('backups-table');

    if (!backups || backups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No backup files found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = backups.map(backup => {
        const typeBadge = backup.type === 'full' ? 'badge-primary' :
                         backup.type === 'attendance' ? 'badge-warning' : 'badge-secondary';

        const actions = `
            <div class="btn-group">
                <button class="btn-icon" onclick="downloadBackup('${backup.filename}')" title="Download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
                <button class="btn-icon delete-btn" onclick="confirmDeleteBackup('${backup.filename}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
        `;

        return `
            <tr>
                <td><strong>${backup.filename}</strong></td>
                <td><span class="badge ${typeBadge}">${backup.type || 'unknown'}</span></td>
                <td>${formatFileSize(backup.size || 0)}</td>
                <td>${formatDate(backup.created_at)}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

// Download backup
async function downloadBackup(filename) {
    try {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = `/api/admin/backups/${filename}/download`;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showAlert(`Downloading ${filename}...`);
    } catch (error) {
        console.error('Error downloading backup:', error);
        showAlert('Failed to download backup', 'error');
    }
}

// Confirm delete backup
function confirmDeleteBackup(filename) {
    document.getElementById('delete-backup-name').textContent = `File: ${filename}`;
    document.getElementById('delete-backup-modal').style.display = 'flex';
    document.getElementById('delete-backup-modal').classList.add('active');

    // Store filename for deletion
    document.getElementById('confirm-delete-btn').dataset.filename = filename;
}

// Delete backup
async function deleteBackup(filename) {
    try {
        const response = await window.api.makeRequest('DELETE', `/admin/backups/${filename}`);

        if (response.success) {
            showAlert(response.message, 'success');
            closeDeleteModal();
            loadBackups(); // Refresh the list
        }
    } catch (error) {
        showAlert(error.message || 'Failed to delete backup', 'error');
    }
}

// Search backups
function searchBackups(query) {
    if (!query.trim()) {
        filteredBackups = [...allBackups];
    } else {
        filteredBackups = allBackups.filter(backup =>
            backup.filename.toLowerCase().includes(query.toLowerCase()) ||
            (backup.type && backup.type.toLowerCase().includes(query.toLowerCase()))
        );
    }
    displayBackups(filteredBackups);
}

// Create backup modal functions
function openCreateBackupModal() {
    document.getElementById('create-backup-modal').style.display = 'flex';
    document.getElementById('create-backup-modal').classList.add('active');
    loadTablesList();
}

function closeCreateModal() {
    const modal = document.getElementById('create-backup-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('create-backup-form').reset();
        document.getElementById('tables-group').style.display = 'none';
    }, 300);
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-backup-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Load tables list for partial backup
async function loadTablesList() {
    try {
        // This would need a new API endpoint to get table list
        // For now, we'll use a predefined list
        const tables = ['users', 'centers', 'sessions', 'attendance', 'assistants_centers', 'audit_log'];
        const tablesList = document.getElementById('tables-list');

        tablesList.innerHTML = tables.map(table => `
            <label style="display: block; margin-bottom: 0.5rem;">
                <input type="checkbox" name="tables" value="${table}" style="margin-right: 0.5rem;">
                ${table}
            </label>
        `).join('');
    } catch (error) {
        console.error('Error loading tables list:', error);
    }
}

// Handle backup type change
document.getElementById('backup-type').addEventListener('change', (e) => {
    const tablesGroup = document.getElementById('tables-group');
    tablesGroup.style.display = e.target.value === 'partial' ? 'block' : 'none';
});

// Create backup
async function createBackup(e) {
    e.preventDefault();

    const type = document.getElementById('backup-type').value;
    const description = document.getElementById('backup-description').value;
    let tables = null;

    if (type === 'partial') {
        const selectedTables = Array.from(document.querySelectorAll('input[name="tables"]:checked')).map(cb => cb.value);
        if (selectedTables.length === 0) {
            showAlert('Please select at least one table for partial backup', 'error');
            return;
        }
        tables = selectedTables;
    }

    const createBtn = document.getElementById('start-backup-btn');
    const originalText = createBtn.textContent;
    createBtn.disabled = true;
    createBtn.textContent = 'Creating Backup...';

    try {
        const response = await window.api.makeRequest('POST', '/admin/backups', {
            type,
            tables,
            description: description || undefined
        });

        if (response.success) {
            showAlert(response.message, 'success');
            closeCreateModal();
            loadBackups(); // Refresh the list
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create backup', 'error');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = originalText;
    }
}

// Event listeners
document.getElementById('refresh-backups-btn').addEventListener('click', loadBackups);
document.getElementById('create-backup-btn').addEventListener('click', openCreateBackupModal);
document.getElementById('close-create-modal').addEventListener('click', closeCreateModal);
document.getElementById('cancel-create-btn').addEventListener('click', closeCreateModal);
document.getElementById('create-backup-form').addEventListener('submit', createBackup);

document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
document.getElementById('confirm-delete-btn').addEventListener('click', (e) => {
    const filename = e.target.dataset.filename;
    if (filename) {
        deleteBackup(filename);
    }
});

// Search functionality
let searchTimeout;
document.getElementById('search-backups').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchBackups(e.target.value);
    }, 300);
});

// Close modals when clicking outside
document.getElementById('create-backup-modal').addEventListener('click', (e) => {
    if (e.target.id === 'create-backup-modal') {
        closeCreateModal();
    }
});

document.getElementById('delete-backup-modal').addEventListener('click', (e) => {
    if (e.target.id === 'delete-backup-modal') {
        closeDeleteModal();
    }
});

// Initialize
loadBackups();