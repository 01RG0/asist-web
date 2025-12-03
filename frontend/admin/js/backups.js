document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentTab = 'manual';
    let manualBackups = [];
    let deletedItems = [];

    // DOM Elements
    const manualTabBtn = document.querySelector('[data-tab="manual"]');
    const deletedTabBtn = document.querySelector('[data-tab="deleted"]');
    const manualCard = document.getElementById('manual-backups-card');
    const deletedCard = document.getElementById('deleted-items-card');
    const backupsTableBody = document.getElementById('backups-table-body');
    const deletedItemsTableBody = document.getElementById('deleted-items-table-body');
    const refreshBtn = document.getElementById('refresh-backups-btn');
    const sectionTitle = document.getElementById('section-title');
    const createBackupBtn = document.getElementById('create-backup-btn');
    const createBackupModal = document.getElementById('create-backup-modal');
    const closeCreateModal = document.getElementById('close-create-modal');
    const cancelCreateBtn = document.getElementById('cancel-create-btn');
    const createBackupForm = document.getElementById('create-backup-form');
    const backupTypeSelect = document.getElementById('backup-type');
    const tablesGroup = document.getElementById('tables-group');

    // Initialize
    loadManualBackups();

    // Event Listeners
    window.switchTab = (tab) => {
        currentTab = tab;

        // Update tabs UI
        if (tab === 'manual') {
            manualTabBtn.classList.add('active');
            deletedTabBtn.classList.remove('active');

            // Show/Hide content
            manualCard.style.display = 'block';
            deletedCard.style.display = 'none';
            sectionTitle.textContent = 'Backup Files';

            loadManualBackups();
        } else {
            deletedTabBtn.classList.add('active');
            manualTabBtn.classList.remove('active');

            // Show/Hide content
            manualCard.style.display = 'none';
            deletedCard.style.display = 'block';
            sectionTitle.textContent = 'Deleted Items';

            loadDeletedItems();
        }
    };

    refreshBtn.addEventListener('click', () => {
        if (currentTab === 'manual') {
            loadManualBackups();
        } else {
            loadDeletedItems();
        }
    });

    // Create Backup Modal
    createBackupBtn.addEventListener('click', () => {
        createBackupModal.classList.add('active');
    });

    closeCreateModal.addEventListener('click', () => {
        createBackupModal.classList.remove('active');
    });

    cancelCreateBtn.addEventListener('click', () => {
        createBackupModal.classList.remove('active');
    });

    // Backup type change handler
    backupTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'partial') {
            tablesGroup.style.display = 'block';
            loadAvailableTables();
        } else {
            tablesGroup.style.display = 'none';
        }
    });

    // Create Backup Form Submit
    createBackupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createBackup();
    });

    // Close modal when clicking outside
    createBackupModal.addEventListener('click', (e) => {
        if (e.target === createBackupModal) {
            createBackupModal.classList.remove('active');
        }
    });

    // Delete Backup Modal
    const deleteBackupModal = document.getElementById('delete-backup-modal');
    const closeDeleteModal = document.getElementById('close-delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    let currentDeleteFilename = null;

    closeDeleteModal?.addEventListener('click', () => {
        deleteBackupModal?.classList.remove('active');
    });

    cancelDeleteBtn?.addEventListener('click', () => {
        deleteBackupModal?.classList.remove('active');
    });

    deleteBackupModal?.addEventListener('click', (e) => {
        if (e.target === deleteBackupModal) {
            deleteBackupModal.classList.remove('active');
        }
    });

    // Update deleteBackup to use modal
    window.deleteBackup = async (filename) => {
        currentDeleteFilename = filename;
        const deleteBackupName = document.getElementById('delete-backup-name');
        if (deleteBackupName) {
            deleteBackupName.textContent = `Backup: ${filename}`;
        }
        deleteBackupModal?.classList.add('active');
    };

    confirmDeleteBtn?.addEventListener('click', async () => {
        if (!currentDeleteFilename) return;

        // Require password for deletion
        const password = prompt('Enter admin password to confirm deletion:');
        if (password !== 'ahmed2626') {
            showNotification('Incorrect password. Deletion cancelled.', 'error');
            deleteBackupModal?.classList.remove('active');
            return;
        }

        const originalText = confirmDeleteBtn.textContent;
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';

        try {
            const response = await window.api.makeRequest('DELETE', `/admin/backups/${currentDeleteFilename}`);

            if (response.success) {
                loadManualBackups();
                showNotification('Backup deleted successfully', 'success');
                deleteBackupModal?.classList.remove('active');
                currentDeleteFilename = null;
            } else {
                throw new Error(response.message || 'Failed to delete backup');
            }
        } catch (error) {
            console.error('Error deleting backup:', error);
            showNotification(error.message || 'Failed to delete backup', 'error');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = originalText;
        }
    });

    // Load Manual Backups
    async function loadManualBackups() {
        try {
            backupsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="loading-spinner"></div>
                        Loading backup files...
                    </td>
                </tr>
            `;

            const response = await window.api.makeRequest('GET', '/admin/backups');

            if (!response.success) throw new Error(response.message || 'Failed to fetch backups');

            const data = response;
            manualBackups = data.data;
            renderManualBackups(manualBackups);
            updateStats(manualBackups);

        } catch (error) {
            console.error('Error loading backups:', error);
            backupsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        Error loading backups: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    // Render Manual Backups
    function renderManualBackups(backups) {
        if (backups.length === 0) {
            backupsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No backup files found</td>
                </tr>
            `;
            return;
        }

        backupsTableBody.innerHTML = backups.map(backup => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.2rem;">${getFileIcon(backup.filename)}</span>
                        ${backup.filename}
                    </div>
                </td>
                <td>
                    <span class="badge badge-${getBadgeType(backup.type)}">${backup.type}</span>
                </td>
                <td>${formatBytes(backup.size)}</td>
                <td>${new Date(backup.created_at).toLocaleString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="downloadBackup('${backup.filename}')" title="Download">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                        <button class="btn-icon delete-btn" onclick="deleteBackup('${backup.filename}')" title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Load Deleted Items
    async function loadDeletedItems() {
        try {
            deletedItemsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="loading-spinner"></div>
                        Loading deleted items...
                    </td>
                </tr>
            `;

            const response = await window.api.makeRequest('GET', '/admin/backups/deleted');

            if (!response.success) throw new Error(response.message || 'Failed to fetch deleted items');

            const data = response;
            deletedItems = data.data;
            renderDeletedItems(deletedItems);

        } catch (error) {
            console.error('Error loading deleted items:', error);
            deletedItemsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        Error loading deleted items: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    // Render Deleted Items
    function renderDeletedItems(items) {
        if (items.length === 0) {
            deletedItemsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No deleted items found</td>
                </tr>
            `;
            return;
        }

        deletedItemsTableBody.innerHTML = items.map(item => `
            <tr>
                <td>
                    <span class="badge badge-info">${item.item_type}</span>
                </td>
                <td>${item.item_id}</td>
                <td>
                    <div>${item.deleted_by?.name || 'Unknown'}</div>
                    <small class="text-muted">${item.deleted_by?.email || ''}</small>
                </td>
                <td>${new Date(item.deleted_at).toLocaleString()}</td>
                <td>${item.deletion_reason || '-'}</td>
                <td>
                    <div class="action-buttons">
                        ${item.can_restore ? `
                        <button class="btn-icon" onclick="restoreItem('${item._id}')" title="Restore" style="color: var(--success-color);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="1 4 1 10 7 10"></polyline>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                            </svg>
                        </button>
                        ` : '<span class="badge badge-success">Restored</span>'}
                        
                        <button class="btn-icon delete-btn" onclick="permanentlyDeleteItem('${item._id}')" title="Permanently Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Helper Functions
    function getFileIcon(filename) {
        if (filename.endsWith('.json')) return '📄';
        if (filename.endsWith('.zip')) return '📦';
        if (filename.endsWith('.gz')) return '🗜️';
        return 'Aq';
    }

    function getBadgeType(type) {
        switch (type) {
            case 'full': return 'primary';
            case 'attendance': return 'success';
            case 'partial': return 'warning';
            default: return 'secondary';
        }
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Create Backup
    async function createBackup() {
        try {
            const type = backupTypeSelect.value;
            const description = document.getElementById('backup-description').value;
            let collections = null;

            if (type === 'partial') {
                const checkboxes = document.querySelectorAll('#tables-list input[type="checkbox"]:checked');
                collections = Array.from(checkboxes).map(cb => cb.value);

                if (collections.length === 0) {
                    showNotification('Please select at least one table', 'error');
                    return;
                }
            }

            // Show loading overlay
            const loadingOverlay = document.getElementById('loading-overlay');
            loadingOverlay.classList.add('active');
            createBackupModal.classList.remove('active'); // Close modal immediately

            const response = await window.api.makeRequest('POST', '/admin/backups', {
                type,
                description,
                collections
            });

            if (!response.success) {
                throw new Error(response.message || 'Failed to create backup');
            }

            const data = response;
            showNotification(data.message || 'Backup created successfully', 'success');
            createBackupForm.reset();
            loadManualBackups();

        } catch (error) {
            console.error('Error creating backup:', error);
            showNotification(error.message, 'error');
            // Re-open modal if error occurred so user can try again
            createBackupModal.classList.add('active');
        } finally {
            // Hide loading overlay
            const loadingOverlay = document.getElementById('loading-overlay');
            loadingOverlay.classList.remove('active');
        }
    }

    // Load Available Tables for Partial Backup
    function loadAvailableTables() {
        const tablesList = document.getElementById('tables-list');
        const tables = [
            { name: 'users', label: 'Users' },
            { name: 'centers', label: 'Centers' },
            { name: 'sessions', label: 'Sessions' },
            { name: 'attendance', label: 'Attendance Records' },
            { name: 'auditlogs', label: 'Audit Logs' }
        ];

        tablesList.innerHTML = tables.map(table => `
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" value="${table.name}" style="cursor: pointer;">
                    <span>${table.label}</span>
                </label>
            </div>
        `).join('');
    }

    function updateStats(backups) {
        document.getElementById('total-backups').textContent = backups.length;

        const totalSize = backups.reduce((acc, curr) => acc + curr.size, 0);
        document.getElementById('total-size').textContent = formatBytes(totalSize);

        if (backups.length > 0) {
            const lastBackup = new Date(backups[0].created_at);
            document.getElementById('last-backup').textContent = lastBackup.toLocaleDateString();
        } else {
            document.getElementById('last-backup').textContent = 'Never';
        }
    }

    // Global Actions
    window.downloadBackup = async (filename) => {
        try {
            // Use direct download link with token
            const token = localStorage.getItem('authToken');
            window.location.href = `/api/admin/backups/${filename}/download?token=${token}`;
        } catch (error) {
            console.error('Error downloading backup:', error);
            showNotification(error.message || 'Failed to download backup', 'error');
        }
    };

    // deleteBackup is now handled by the modal above

    window.restoreItem = async (id) => {
        if (!confirm('Are you sure you want to restore this item?')) return;

        try {
            const response = await window.api.makeRequest('POST', `/admin/backups/deleted/${id}/restore`);

            if (response.success) {
                loadDeletedItems();
                showNotification('Item restored successfully', 'success');
            } else {
                throw new Error(response.message || 'Failed to restore item');
            }
        } catch (error) {
            console.error('Error restoring item:', error);
            showNotification(error.message, 'error');
        }
    };

    window.permanentlyDeleteItem = async (id) => {
        if (!confirm('Are you sure you want to PERMANENTLY delete this backup? This cannot be undone.')) return;

        try {
            const response = await window.api.makeRequest('DELETE', `/admin/backups/deleted/${id}`);

            if (response.success) {
                loadDeletedItems();
                showNotification('Backup permanently deleted', 'success');
            } else {
                throw new Error(response.message || 'Failed to delete backup');
            }
        } catch (error) {
            console.error('Error deleting backup:', error);
            showNotification(error.message, 'error');
        }
    };

    function showNotification(message, type = 'info') {
        const container = document.getElementById('alert-container');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;

        container.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 3000);
    }
});