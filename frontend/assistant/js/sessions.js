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
const callSessionsContainer = document.getElementById('call-sessions-container');
const callEmptyState = document.getElementById('call-empty-state');

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

// Render call session card
function renderCallSessionCard(session) {
  const statusClass = session.status === 'active' ? 'badge-success' : 'badge-secondary';
  const statusText = session.status === 'active' ? 'Active' : session.status === 'completed' ? 'Completed' : 'Pending';
  const cardClass = session.status === 'active' ? 'session-card attended' : 'session-card';

  // Check if current user is in assistants array
  const assistants = session.assistants || [];
  const isJoined = assistants.some(a => String(a.id) === String(user.id));
  const isFirstAssistant = session.assistant_id && String(session.assistant_id) === String(user.id);
  const isInSession = isJoined || isFirstAssistant;

  // Check if end_time is set (admin scheduled end time)
  const hasScheduledEndTime = session.end_time && new Date(session.end_time) > new Date();
  const endTimeDisplay = session.end_time ? new Date(session.end_time).toLocaleString() : null;

  let buttonHtml;

  // Check if user has already completed their participation
  if (session.hasCompletedParticipation) {
    buttonHtml = '<button class="btn btn-secondary" disabled>✓ Participation Completed</button>';
  } else if (session.status === 'pending') {
    buttonHtml = `<button class="btn btn-primary" onclick="startCallSession('${session.id}')">Join Call</button>`;
  } else if (session.status === 'active' && session.isCurrentlyActive) {
    // User is actively in the session
    if (hasScheduledEndTime) {
      buttonHtml = `<button class="btn btn-secondary" disabled title="Scheduled to end at ${endTimeDisplay}">End Call (Scheduled)</button>`;
    } else {
      buttonHtml = `<button class="btn btn-danger" onclick="stopCallSession('${session.id}')">End Call</button>`;
    }
  } else if (session.status === 'active') {
    // Session is active but user is not in it - they can join
    buttonHtml = `<button class="btn btn-primary" onclick="startCallSession('${session.id}')">Join Call</button>`;
  } else {
    buttonHtml = '<button class="btn btn-secondary" disabled>Completed</button>';
  }

  return `
    <div class="${cardClass}">
      <div class="session-header">
        <h3 class="session-subject">${session.name}</h3>
        <span class="session-badge ${statusClass}">${statusText}</span>
      </div>
      
      <div class="session-info">
        <div class="session-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${new Date(session.date).toLocaleDateString()}
        </div>
        
        <div class="session-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${formatTime(session.start_time)}
        </div>
        
        ${(session.assistants && session.assistants.length > 0) || session.assistant_name ? `
        <div class="session-info-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          ${session.assistants && session.assistants.length > 0
        ? session.assistants.map(a => a.name || 'Unknown').join(', ')
        : session.assistant_name || 'Not started'}
        </div>
        ` : ''}
        
        ${hasScheduledEndTime ? `
        <div class="session-info-item" style="color: var(--accent-blue);">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Scheduled to end: ${endTimeDisplay}
        </div>
        ` : ''}
      </div>
      
      ${buttonHtml}
    </div>
  `;
}

// Start call session
window.startCallSession = async function (sessionId) {
  try {
    const response = await window.api.makeRequest('POST', `/activities/call-sessions/${sessionId}/start`);

    if (response.success) {
      showAlert('Call session started successfully', 'success');
      setTimeout(() => {
        window.location.href = `call-session.html?session=${sessionId}`;
      }, 1000);
    } else {
      // Check if user is already joined
      if (response.message && (response.message.includes('already joined') || response.message.includes('already in'))) {
        // Redirect anyway
        window.location.href = `call-session.html?session=${sessionId}`;
      } else {
        showAlert(response.message || 'Failed to start call session', 'error');
      }
    }
  } catch (error) {
    // Handle error response object if available
    if (error.response && error.response.data &&
      (error.response.data.message.includes('already joined') || error.response.data.message.includes('already in'))) {
      window.location.href = `call-session.html?session=${sessionId}`;
      return;
    }
    showAlert(error.message || 'Failed to start call session', 'error');
  }
};

// Stop call session
window.stopCallSession = async function (sessionId) {
  if (!confirm('Are you sure you want to end this call session?')) {
    return;
  }

  try {
    const response = await window.api.makeRequest('POST', `/activities/call-sessions/${sessionId}/stop`);

    if (response.success) {
      showAlert('Call session ended successfully', 'success');
      loadCallSessions();
    } else {
      showAlert(response.message || 'Failed to stop call session', 'error');
    }
  } catch (error) {
    showAlert(error.message || 'Failed to stop call session', 'error');
  }
};

// Load call sessions
async function loadCallSessions() {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
    const response = await window.api.makeRequest('GET', `/activities/call-sessions?date=${today}&status=pending,active`);

    if (response.success && response.data.length > 0) {
      callSessionsContainer.innerHTML = response.data.map(renderCallSessionCard).join('');
      callSessionsContainer.style.display = 'grid';
      callEmptyState.style.display = 'none';
    } else {
      callSessionsContainer.style.display = 'none';
      callEmptyState.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading call sessions:', error);
    showAlert('Failed to load call sessions', 'error');
  }
}

// Load sessions on page load
loadSessions();
loadCallSessions();
