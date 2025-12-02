// Check authentication
if (!window.api.isAuthenticated()) {
  window.location.href = '/assistant/index.html';
}

const user = window.api.getUser();
const userNameEl = document.getElementById('user-name');
const currentDateEl = document.getElementById('current-date');
const logoutBtn = document.getElementById('logout-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const sessionsContainer = document.getElementById('sessions-container');
const emptyState = document.getElementById('empty-state');
const alertContainer = document.getElementById('alert-container');

// Display user name
if (user) {
  userNameEl.textContent = user.name;
}

// Display current date in Egypt timezone
function getEgyptDate() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'Africa/Cairo'
  };
  return now.toLocaleDateString('en-US', options);
}
currentDateEl.textContent = getEgyptDate();

// Logout handler
logoutBtn.addEventListener('click', () => {
  window.api.logout();
});

// Show alert
function showAlert(message, type = 'error') {
  const alertClass = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-warning';
  alertContainer.innerHTML = `
    <div class="alert ${alertClass}">
      ${message}
    </div>
  `;

  // Auto hide after 5 seconds
  setTimeout(() => {
    alertContainer.innerHTML = '';
  }, 5000);
}

// Format time for display
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Render session card
function renderSessionCard(session) {
  const isAttended = session.attended;
  const canMark = session.can_mark_attendance;
  const badgeClass = isAttended ? 'badge-attended' : 'badge-pending';
  const badgeText = isAttended ? 'Attended' : 'Pending';
  const cardClass = isAttended ? 'session-card attended' : 'session-card';

  // Determine button state
  let buttonHtml;
  if (isAttended) {
    buttonHtml = '<button class="btn btn-secondary" disabled>✓ Attendance Recorded</button>';
  } else if (!canMark) {
    buttonHtml = '<button class="btn btn-secondary" disabled>⏱ Attendance Window Closed</button>';
  } else {
    buttonHtml = `<button class="btn btn-primary" onclick="goToAttendance('${session.id}')">Mark Attendance</button>`;
  }

  return `
    <div class="${cardClass}">
      <div class="session-header">
        <h3 class="session-subject">${session.subject}</h3>
        <span class="session-badge ${badgeClass}">${badgeText}</span>
      </div>
      
      <div class="session-info">
        <div class="session-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${session.center_name}
        </div>
        
        <div class="session-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${formatTime(session.start_time)}
        </div>
      </div>
      
      ${buttonHtml}
    </div>
  `;
}

// Navigate to attendance page
window.goToAttendance = function (sessionId) {
  window.location.href = `/assistant/attendance.html?session=${sessionId}`;
};

// Load today's sessions
async function loadSessions() {
  try {
    loadingSpinner.style.display = 'block';
    sessionsContainer.style.display = 'none';
    emptyState.style.display = 'none';

    const response = await window.api.makeRequest('GET', '/sessions/today');

    if (response.success && response.data.length > 0) {
      sessionsContainer.innerHTML = response.data.map(renderSessionCard).join('');
      sessionsContainer.style.display = 'grid';
    } else {
      emptyState.style.display = 'block';
    }

  } catch (error) {
    showAlert(error.message || 'Failed to load sessions');
  } finally {
    loadingSpinner.style.display = 'none';
  }
}

// Load sessions on page load
loadSessions();
