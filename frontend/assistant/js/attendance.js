// Check authentication
if (!window.api.isAuthenticated()) {
    window.location.href = '/assistant/index.html';
}

// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
    window.location.href = '/assistant/sessions.html';
}

const loadingSpinner = document.getElementById('loading-spinner');
const attendanceContent = document.getElementById('attendance-content');
const alertContainer = document.getElementById('alert-container');
const gpsStatus = document.getElementById('gps-status');
const confirmBtn = document.getElementById('confirm-btn');
const sessionSubject = document.getElementById('session-subject');
const sessionCenter = document.getElementById('session-center');
const sessionTime = document.getElementById('session-time');
const sessionRadius = document.getElementById('session-radius');

let currentSession = null;
let isWithinRadius = false;

// Show alert
function showAlert(message, type = 'error') {
    const alertClass = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-warning';
    alertContainer.innerHTML = `
    <div class="alert ${alertClass}">
      ${message}
    </div>
  `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Format time
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Update GPS status UI
function updateGPSStatus(status, message, distance = null) {
    gpsStatus.className = `gps-status ${status}`;

    if (status === 'checking') {
        gpsStatus.innerHTML = `
      <strong>🔍 ${message}</strong>
    `;
    } else if (status === 'valid') {
        gpsStatus.innerHTML = `
      <strong>✅ ${message}</strong>
      ${distance !== null ? `<p>Distance: ${distance}m from center</p>` : ''}
    `;
        isWithinRadius = true;
        confirmBtn.disabled = false;
    } else if (status === 'invalid') {
        gpsStatus.innerHTML = `
      <strong>❌ ${message}</strong>
      ${distance !== null ? `<p>Distance: ${distance}m from center</p>` : ''}
    `;
        isWithinRadius = false;
        confirmBtn.disabled = true;
    }
}

// Load session details
async function loadSessionDetails() {
    try {
        loadingSpinner.style.display = 'block';

        const response = await window.api.makeRequest('GET', `/sessions/${sessionId}`);

        if (response.success) {
            currentSession = response.data;

            sessionSubject.textContent = currentSession.subject;
            sessionCenter.textContent = currentSession.center_name;
            sessionTime.textContent = `${formatTime(currentSession.start_time)} - ${formatTime(currentSession.end_time)}`;
            sessionRadius.textContent = `${currentSession.radius_m}m`;

            // Initialize map
            window.gps.initMap(
                currentSession.latitude,
                currentSession.longitude,
                currentSession.radius_m
            );

            // Request user location
            requestUserLocation();

            attendanceContent.style.display = 'block';
        }

    } catch (error) {
        showAlert(error.message || 'Failed to load session details');
        setTimeout(() => {
            window.location.href = '/assistant/sessions.html';
        }, 2000);
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Request user's GPS location
function requestUserLocation() {
    updateGPSStatus('checking', 'Getting your location...');

    window.gps.requestLocation(
        (lat, lng) => {
            // Update marker on map
            window.gps.updateUserMarker(lat, lng);

            // Calculate distance
            const distance = window.gps.calculateDistance(
                currentSession.latitude,
                currentSession.longitude,
                lat,
                lng
            );

            const distanceRounded = Math.round(distance);

            // Check if within radius
            if (distance <= currentSession.radius_m) {
                updateGPSStatus(
                    'valid',
                    'You are inside the center!',
                    distanceRounded
                );
            } else {
                updateGPSStatus(
                    'invalid',
                    `You are outside the center area. Please move closer.`,
                    distanceRounded
                );
            }
        },
        (error) => {
            updateGPSStatus('invalid', error);
            showAlert(error, 'error');
        }
    );
}

// Handle attendance confirmation
confirmBtn.addEventListener('click', async () => {
    if (!isWithinRadius) {
        showAlert('You must be within the center radius to mark attendance', 'error');
        return;
    }

    const userLoc = window.gps.getUserLocation();
    if (!userLoc) {
        showAlert('Unable to get your location. Please try again.', 'error');
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<div class="btn-spinner"></div> Recording...';

    try {
        const response = await window.api.makeRequest('POST', '/attendance/record', {
            session_id: sessionId,
            latitude: userLoc.lat,
            longitude: userLoc.lng
        });

        if (response.success) {
            showAlert(response.message, 'success');

            // Redirect back to sessions after 2 seconds
            setTimeout(() => {
                window.location.href = '/assistant/sessions.html';
            }, 2000);
        }

    } catch (error) {
        showAlert(error.message || 'Failed to record attendance', 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Confirm Attendance';
    }
});

// Load session on page load
loadSessionDetails();
