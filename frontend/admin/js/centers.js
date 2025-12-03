// Centers Management JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

// Alert function
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Map variables
let map;
let markers = [];
let selectedMarker = null;
let currentCenterToDelete = null;
// Initialize Map
function initMap() {
    // Default to Cairo
    map = L.map('map').setView([30.0444, 31.2357], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Map click handler
    map.on('click', (e) => {
        updateSelectedLocation(e.latlng.lat, e.latlng.lng);
    });
}

function updateSelectedLocation(lat, lng) {
    const fixedLat = parseFloat(lat).toFixed(7);
    const fixedLng = parseFloat(lng).toFixed(7);

    document.getElementById('center-lat').value = fixedLat;
    document.getElementById('center-lng').value = fixedLng;

    // Remove existing selected marker
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
    }

    // Add draggable marker with popup
    selectedMarker = L.marker([lat, lng], { draggable: true })
        .addTo(map)
        .bindPopup('Click and drag to adjust location')
        .openPopup();

    // Handle drag end to update inputs
    selectedMarker.on('dragend', function (event) {
        const position = event.target.getLatLng();
        document.getElementById('center-lat').value = position.lat.toFixed(7);
        document.getElementById('center-lng').value = position.lng.toFixed(7);
        // Keep the floating button positioned correctly
        showAddCenterBtn(position.lat, position.lng);
    });

    // Show floating Add Center button at this location
    showAddCenterBtn(lat, lng);
}

// Map Search Functionality
const searchInput = document.getElementById('map-search-input');
const searchBtn = document.getElementById('map-search-btn');
const searchResults = document.getElementById('map-search-results');

async function searchLocation() {
    const query = searchInput.value.trim();
    if (!query) return;

    const originalBtnText = searchBtn.innerHTML;
    searchBtn.innerHTML = '<span class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></span>';
    searchBtn.disabled = true;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();

        searchResults.innerHTML = '';

        if (data.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        } else {
            data.forEach(place => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.textContent = place.display_name;
                item.addEventListener('click', () => {
                    const lat = parseFloat(place.lat);
                    const lon = parseFloat(place.lon);

                    map.setView([lat, lon], 16);
                    updateSelectedLocation(lat, lon);

                    searchResults.style.display = 'none';
                    searchInput.value = place.display_name;
                });
                searchResults.appendChild(item);
            });
        }

        searchResults.style.display = 'block';
    } catch (error) {
        console.error('Search error:', error);
        showAlert('Failed to search location', 'error');
    } finally {
        searchBtn.innerHTML = originalBtnText;
        searchBtn.disabled = false;
    }
}

if (searchBtn) {
    searchBtn.addEventListener('click', searchLocation);
}

if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchLocation();
    });
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (searchResults && !e.target.closest('.map-search-container')) {
        searchResults.style.display = 'none';
    }
});

// Load all centers
async function loadCenters() {
    try {
        const response = await window.api.makeRequest('GET', '/centers');

        if (response.success) {
            displayCenters(response.data);
            displayMarkersOnMap(response.data);
        }
    } catch (error) {
        console.error('Error loading centers:', error);
        showAlert('Failed to load centers', 'error');
    }
}

// Display centers in table
function displayCenters(centers) {
    const tbody = document.getElementById('centers-table');

    if (!centers || centers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No centers found. Click "Add Center" to create one.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = centers.map(center => {
        const createdDate = new Date(center.created_at).toLocaleDateString();
        return `
            <tr data-id="${center.id}">
                <td><strong>${center.name}</strong></td>
                <td>${center.latitude}, ${center.longitude}</td>
                <td>${center.radius_m || 30}m</td>
                <td>${createdDate}</td>
                <td>
                    <div class="table-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon edit-btn" data-id="${center.id}" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete-btn" data-id="${center.id}" title="Delete">
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
        btn.addEventListener('click', () => editCenter(btn.dataset.id));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });
}

// Display markers on map
function displayMarkersOnMap(centers) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    centers.forEach(center => {
        const marker = L.marker([center.latitude, center.longitude])
            .bindPopup(`
                <div style="text-align: center;">
                    <strong>${center.name}</strong><br>
                    <span style="font-size: 0.85em; color: #666;">Radius: ${center.radius_m || 30}m</span>
                    <div style="margin-top: 8px;">
                        <button onclick="editCenter(${center.id})" class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 11px;">
                            Edit Center
                        </button>
                    </div>
                </div>
            `)
            .addTo(map);

        // Add radius circle
        L.circle([center.latitude, center.longitude], {
            radius: center.radius_m || 30,
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.1
        }).addTo(map);

        markers.push(marker);
    });

    // Fit map to show all markers
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Modal functions
const centerModal = document.getElementById('center-modal');
const deleteModal = document.getElementById('delete-modal');

function openCenterModal(centerId = null) {
    if (centerId) {
        document.getElementById('modal-title').textContent = 'Edit Center';
        loadCenterData(centerId);
    } else {
        document.getElementById('modal-title').textContent = 'Add New Center';
        document.getElementById('center-form').reset();
        document.getElementById('center-id').value = '';
        document.getElementById('center-radius').value = '30';

        // If a location is selected on the map, populate it
        if (selectedMarker) {
            const latLng = selectedMarker.getLatLng();
            document.getElementById('center-lat').value = latLng.lat.toFixed(7);
            document.getElementById('center-lng').value = latLng.lng.toFixed(7);
        }
    }

    centerModal.classList.add('active');
}

// Expose to window for Leaflet popup
window.openCenterModal = openCenterModal;

function closeCenterModal() {
    centerModal.classList.remove('active');
    // We do NOT remove the selected marker here, so the user can see what they selected
    // if they cancel and want to try again, or if they just saved.
    // However, if we want to clear it on successful save, we can do that in the save handler.
}

async function loadCenterData(id) {
    try {
        const response = await window.api.makeRequest('GET', `/centers/${id}`);

        if (response.success) {
            const center = response.data;
            document.getElementById('center-id').value = center.id;
            document.getElementById('center-name').value = center.name;
            document.getElementById('center-lat').value = center.latitude;
            document.getElementById('center-lng').value = center.longitude;
            document.getElementById('center-radius').value = center.radius_m || 30;
        }
    } catch (error) {
        console.error('Error loading center:', error);
        showAlert('Failed to load center data', 'error');
    }
}

function editCenter(id) {
    openCenterModal(id);
}

// Expose to window
window.editCenter = editCenter;

// Save center (create or update)
document.getElementById('center-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('center-id').value;
    const lat = parseFloat(document.getElementById('center-lat').value);
    const lng = parseFloat(document.getElementById('center-lng').value);
    const name = document.getElementById('center-name').value;
    const radius = parseInt(document.getElementById('center-radius').value) || 30;

    if (!name) {
        showAlert('Please enter a center name', 'error');
        return;
    }

    if (isNaN(lat) || isNaN(lng)) {
        showAlert('Please select a valid location on the map', 'error');
        return;
    }

    const centerData = {
        name: name,
        latitude: lat,
        longitude: lng,
        radius_m: radius
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/centers/${id}` : '/centers';

        const response = await window.api.makeRequest(method, endpoint, centerData);

        if (response.success) {
            showAlert(id ? 'Center updated successfully' : 'Center created successfully');
            closeCenterModal();
            loadCenters();
        } else {
            showAlert(response.message || 'Failed to save center', 'error');
        }
    } catch (error) {
        console.error('Error saving center:', error);
        showAlert('Failed to save center', 'error');
    }
});

// Delete modal
function openDeleteModal(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const centerName = row.querySelector('strong').textContent;

    currentCenterToDelete = id;
    document.getElementById('delete-center-name').textContent = centerName;
    deleteModal.classList.add('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    currentCenterToDelete = null;
}

async function deleteCenter() {
    if (!currentCenterToDelete) return;

    try {
        const response = await window.api.makeRequest('DELETE', `/centers/${currentCenterToDelete}`);

        if (response.success) {
            showAlert('Center deleted successfully');
            closeDeleteModal();
            loadCenters();
        } else {
            showAlert(response.message || 'Failed to delete center', 'error');
        }
    } catch (error) {
        console.error('Error deleting center:', error);
        showAlert('Failed to delete center', 'error');
    }
}

// Search functionality for table
document.getElementById('search-input').addEventListener('input', async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#centers-table tr');

    rows.forEach(row => {
        const name = row.querySelector('strong')?.textContent.toLowerCase() || '';
        row.style.display = name.includes(searchTerm) ? '' : 'none';
    });
});

// Event listeners
document.getElementById('add-center-btn').addEventListener('click', () => openCenterModal());
document.getElementById('close-modal').addEventListener('click', closeCenterModal);
document.getElementById('cancel-btn').addEventListener('click', closeCenterModal);
document.getElementById('close-delete-modal').addEventListener('click', closeDeleteModal);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
document.getElementById('confirm-delete-btn').addEventListener('click', deleteCenter);

// Close modals on overlay click
centerModal.addEventListener('click', (e) => {
    if (e.target === centerModal) closeCenterModal();
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

// Pick on Map functionality
const pickOnMapBtn = document.getElementById('pick-on-map-btn');
if (pickOnMapBtn) {
    pickOnMapBtn.addEventListener('click', () => {
        const lat = parseFloat(document.getElementById('center-lat').value);
        const lng = parseFloat(document.getElementById('center-lng').value);

        // Close modal temporarily
        centerModal.classList.remove('active');

        // Focus map
        if (!isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 16);
            updateSelectedLocation(lat, lng);
        }

        // Show "Confirm Location" button
        showConfirmLocationBtn();
    });
}

function showConfirmLocationBtn() {
    // Remove existing button if any
    const existingBtn = document.getElementById('confirm-location-btn');
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'confirm-location-btn';
    btn.className = 'btn btn-primary';
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M5 13l4 4L19 7"></path>
        </svg>
        Confirm Location
    `;
    btn.style.position = 'absolute';
    btn.style.bottom = '30px';
    btn.style.left = '50%';
    btn.style.transform = 'translateX(-50%)';
    btn.style.zIndex = '1000';
    btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    btn.style.padding = '12px 24px';
    btn.style.borderRadius = '50px';
    btn.style.fontWeight = '600';
    btn.style.animation = 'fadeIn 0.3s ease';

    btn.addEventListener('click', () => {
        centerModal.classList.add('active');
        btn.remove();
    });

    // Append to map container wrapper (to be over the map)
    const mapContainer = document.getElementById('map').parentElement;
    mapContainer.style.position = 'relative'; // Ensure relative positioning
    mapContainer.appendChild(btn);
}

function showAddCenterBtn(lat, lng) {
    // Remove any existing button
    const existing = document.getElementById('add-center-map-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'add-center-map-btn';
    btn.className = 'btn btn-primary';
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
            <path d="M12 5v14M5 12h14"/>
        </svg>
        Add Center Here
    `;
    btn.style.position = 'absolute';
    btn.style.left = '50%';
    btn.style.bottom = '20px';
    btn.style.transform = 'translateX(-50%)';
    btn.style.zIndex = '1000';
    btn.style.padding = '8px 16px';
    btn.style.borderRadius = '8px';
    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    btn.addEventListener('click', () => {
        // Set inputs just in case they changed
        document.getElementById('center-lat').value = parseFloat(lat).toFixed(7);
        document.getElementById('center-lng').value = parseFloat(lng).toFixed(7);
        openCenterModal();
        btn.remove();
    });

    // Append to map container wrapper
    const mapContainer = document.getElementById('map').parentElement;
    mapContainer.style.position = 'relative';
    mapContainer.appendChild(btn);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadCenters();
});

// After sidebar is loaded
document.addEventListener('sidebarLoaded', () => {
    // Sidebar is now available
});

