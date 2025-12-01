// Admin Dashboard JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

// Display user info
document.getElementById('user-name').textContent = user.name;
document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

// Display personalized greeting
document.getElementById('user-greeting').textContent = user.name.split(' ')[0];

// Logout functionality
document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        window.api.removeToken();
        window.location.href = 'index.html';
    }
});

// Alert function
function showAlert(message, type = 'error') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Animated counter function
function animateCounter(element, targetValue, duration = 2000) {
    const startValue = 0;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);

        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = targetValue;
        }
    }

    requestAnimationFrame(updateCounter);
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await window.api.makeRequest('GET', '/admin/dashboard');

        if (response.success) {
            const stats = response.data;

            // Update statistics cards with animation
            animateCounter(document.getElementById('total-attendance'), stats.totalAttendanceToday || 0);
            animateCounter(document.getElementById('late-arrivals'), stats.lateArrivals || 0);
            animateCounter(document.getElementById('active-sessions'), stats.activeSessions || 0);
            animateCounter(document.getElementById('total-centers'), stats.totalCenters || 0);

            // Load recent attendance
            loadRecentAttendance(stats.recentAttendance || []);

            // Load activity timeline
            loadActivityTimeline();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Failed to load dashboard data');
    }
}

// Load activity timeline (mock data for now - in real app, this would come from API)
function loadActivityTimeline() {
    const timelineContainer = document.getElementById('activity-timeline');

    // Mock activity data - replace with real API call
    const activities = [
        {
            icon: 'user-plus',
            title: 'New assistant registered',
            time: '2 minutes ago',
            type: 'user'
        },
        {
            icon: 'calendar',
            title: 'Session completed at Cairo Center',
            time: '15 minutes ago',
            type: 'session'
        },
        {
            icon: 'database',
            title: 'Backup completed successfully',
            time: '1 hour ago',
            type: 'backup'
        },
        {
            icon: 'user-check',
            title: 'Attendance marked for Mathematics session',
            time: '2 hours ago',
            type: 'attendance'
        }
    ];

    timelineContainer.innerHTML = activities.map((activity, index) => `
        <div class="timeline-item" style="animation-delay: ${index * 0.1}s">
            <div class="timeline-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${getActivityIcon(activity.icon)}
                </svg>
            </div>
            <div class="timeline-content">
                <div class="timeline-title">${activity.title}</div>
                <div class="timeline-meta">${activity.time}</div>
            </div>
        </div>
    `).join('');
}

// Get activity icon SVG path
function getActivityIcon(iconType) {
    const icons = {
        'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line>',
        'calendar': '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
        'database': '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>',
        'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline>'
    };
    return icons[iconType] || icons['user-check'];
}

// Load recent attendance
function loadRecentAttendance(attendanceRecords) {
    const tbody = document.getElementById('recent-attendance');

    if (!attendanceRecords || attendanceRecords.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No attendance records for today</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = attendanceRecords.map(record => {
        const delayMinutes = record.delay_minutes || 0;
        const isLate = delayMinutes > 10;
        const statusClass = isLate ? 'late' : 'on-time';
        const statusText = isLate ? `Late ${delayMinutes} min` : 'On Time';

        // Format time
        const time = new Date(record.time_recorded).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr>
                <td>${record.assistant_name || 'N/A'}</td>
                <td>${record.subject || 'N/A'}</td>
                <td>${record.center_name || 'N/A'}</td>
                <td>${time}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <span class="status-dot"></span>
                        ${statusText}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Initialize dashboard with loading states
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sidebar functionality
    initializeSidebar();

    // Show skeleton loading initially
    showSkeletonLoading();

    // Load dashboard data
    loadDashboardStats();

    // Add hover effects to quick actions
    addQuickActionEffects();

    // Refresh dashboard every 30 seconds
    setInterval(loadDashboardStats, 30000);
});

// Sidebar functionality
function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content');

    // Touch/swipe variables
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;

    // Auto-hide sidebar on page load for larger screens
    if (window.innerWidth > 768) {
        sidebar.classList.add('collapsed');
        sidebarToggle.classList.add('show');
    }

    // Toggle sidebar on button click
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        sidebarToggle.classList.toggle('show');
    });

    // Show sidebar on hover when collapsed (desktop only)
    if (window.innerWidth > 768) {
        let hoverTimeout;

        sidebar.addEventListener('mouseenter', () => {
            if (sidebar.classList.contains('collapsed')) {
                clearTimeout(hoverTimeout);
                sidebar.classList.remove('collapsed');
            }
        });

        sidebar.addEventListener('mouseleave', () => {
            if (!sidebar.classList.contains('collapsed')) {
                hoverTimeout = setTimeout(() => {
                    sidebar.classList.add('collapsed');
                    sidebarToggle.classList.add('show');
                }, 300);
            }
        });
    }

    // Touch event handlers for swipe gestures
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });

    // Handle swipe gestures
    function handleSwipe() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(touchEndY - touchStartY);

        // Only handle horizontal swipes (ignore vertical swipes)
        if (deltaY > maxVerticalDistance) return;

        // Swipe right to show sidebar
        if (deltaX > minSwipeDistance) {
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                sidebarToggle.classList.remove('show');
            }
        }
        // Swipe left to hide sidebar
        else if (deltaX < -minSwipeDistance) {
            if (!sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('collapsed');
                sidebarToggle.classList.add('show');
            }
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('collapsed');
            sidebarToggle.classList.add('show');
        } else {
            sidebar.classList.add('collapsed');
            sidebarToggle.classList.add('show');
        }
    });

    // Close sidebar when clicking outside (desktop only)
    document.addEventListener('click', (e) => {
        // Mobile behavior - close when clicking outside and sidebar is active
        if (window.innerWidth <= 768 &&
            !sidebar.contains(e.target) &&
            !sidebarToggle.contains(e.target) &&
            sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
        // Desktop behavior - auto-hide sidebar when clicking outside
        else if (window.innerWidth > 768 &&
                 !sidebar.contains(e.target) &&
                 !sidebarToggle.contains(e.target) &&
                 !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            sidebarToggle.classList.add('show');
        }
    });
}

// Show skeleton loading states
function showSkeletonLoading() {
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        const valueEl = card.querySelector('.stat-value');
        if (valueEl) {
            valueEl.innerHTML = '<div class="skeleton skeleton-text" style="width: 60px; height: 28px;"></div>';
        }
    });

}

// Add interactive effects to quick actions
function addQuickActionEffects() {
    const actionCards = document.querySelectorAll('.action-card');

    actionCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px) scale(1.02)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });

        // Add ripple effect on click
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255, 255, 255, 0.6)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.left = (e.offsetX - 10) + 'px';
            ripple.style.top = (e.offsetY - 10) + 'px';
            ripple.style.width = '20px';
            ripple.style.height = '20px';

            this.style.position = 'relative';
            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// Add ripple animation to CSS (we'll add this to the CSS file)
const rippleStyle = `
@keyframes ripple {
    to {
        transform: scale(4);
        opacity: 0;
    }
}
`;

// Inject ripple animation
const styleSheet = document.createElement('style');
styleSheet.textContent = rippleStyle;
document.head.appendChild(styleSheet);
