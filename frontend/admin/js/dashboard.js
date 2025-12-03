// Admin Dashboard JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

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

            // Activity timeline removed
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Failed to load dashboard data');
    }
}

// Activity timeline removed — no-op placeholder left intentionally

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
    // Show skeleton loading initially
    showSkeletonLoading();

    // Load dashboard data
    loadDashboardStats();

    // Add hover effects to quick actions
    addQuickActionEffects();

    // Refresh dashboard every 30 seconds
    setInterval(loadDashboardStats, 30000);
});

// After sidebar is loaded
document.addEventListener('sidebarLoaded', () => {
    // Display personalized greeting
    const user = window.api.getUser();
    if (user) {
        document.getElementById('user-greeting').textContent = user.name.split(' ')[0];
    }

    // Initialize sidebar functionality
    initializeSidebar();
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

    // Keep sidebar visible by default on larger screens; just show toggle
    if (window.innerWidth > 768) {
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
