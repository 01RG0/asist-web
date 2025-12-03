// Wrap initialization in a function and call immediately if document already parsed
function initSidebar() {
    // Support multiple possible container IDs used across pages
    const containerIds = ['sidebar-container', 'admin-sidebar-container', 'assistant-sidebar-container'];
    let sidebarContainer = null;
    for (const id of containerIds) {
        const el = document.getElementById(id);
        if (el) {
            sidebarContainer = el;
            break;
        }
    }

    if (!sidebarContainer) return;

    // Try multiple candidate paths for sidebar.html to handle different page locations
    const candidatePaths = [
        'sidebar.html', // same folder
        './sidebar.html',
        '../sidebar.html', // parent folder
        '/admin/sidebar.html', // absolute admin path
        '/frontend/admin/sidebar.html'
    ];

    async function tryLoadSidebar() {
        // If a global template is provided, use it first (fast, no fetch)
        try {
            if (typeof window !== 'undefined' && window.SIDEBAR_TEMPLATE) {
                sidebarContainer.innerHTML = window.SIDEBAR_TEMPLATE;
                console.info('Sidebar injected from window.SIDEBAR_TEMPLATE');
                initializeAfterLoad(sidebarContainer);
                return;
            }
        } catch (e) {
            console.warn('Sidebar template check failed', e);
        }
        for (const path of candidatePaths) {
            try {
                const response = await fetch(path);
                if (!response.ok) continue;
                const html = await response.text();
                sidebarContainer.innerHTML = html;
                console.info('Sidebar injected from fetched path:', path);
                try {
                    initializeAfterLoad(sidebarContainer); // Call the new helper function
                } catch (e) {
                    console.warn('initializeAfterLoad failed', e);
                }
                return;
            } catch (err) {
                // try next path
                continue;
            }
        }
        console.error('Error loading sidebar: sidebar.html not found in candidate paths');
    }

    // Helper to run initialization after injecting HTML
    function initializeAfterLoad(sidebarContainer) {
        // Set user info (guarded because `api.js` may not be loaded yet)
        try {
            if (window && window.api && typeof window.api.getUser === 'function') {
                const user = window.api.getUser();
                if (user) {
                    const userNameEl = sidebarContainer.querySelector('#user-name');
                    const userAvatarEl = sidebarContainer.querySelector('#user-avatar');
                    if (userNameEl) userNameEl.textContent = user.name;
                    if (userAvatarEl) userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
                }
            }
        } catch (e) {
            console.warn('Failed to set user info on sidebar', e);
        }

        // Logout
        const logoutBtn = sidebarContainer.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                try {
                    if (confirm('Are you sure you want to logout?')) {
                        if (window && window.api && typeof window.api.removeToken === 'function') {
                            window.api.removeToken();
                        }
                        window.location.href = 'index.html';
                    }
                } catch (e) {
                    console.warn('Logout handler error', e);
                    window.location.href = 'index.html';
                }
            });
        }

        // Set active link
        const path = window.location.pathname.split('/').pop();
        const activeLink = sidebarContainer.querySelector(`a[href="${path}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            const category = activeLink.closest('.nav-category');
            if (category) category.classList.add('expanded');
        }

        // Add toggle listeners for categories
        sidebarContainer.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', function () {
                const category = this.parentElement;
                category.classList.toggle('expanded');
            });
        });

        // Ensure sidebar is visible on desktop after injection (avoid unexpected collapsed state)
        try {
            const injectedSidebar = sidebarContainer.querySelector('.sidebar');
            if (injectedSidebar && window.innerWidth > 768) {
                injectedSidebar.classList.remove('collapsed');
                document.body.classList.remove('sidebar-collapsed');
                injectedSidebar.style.transform = 'none';
                injectedSidebar.style.zIndex = '2000';
            }
        } catch (e) {
            console.warn('Failed to force-show sidebar after injection', e);
        }

        initializeSidebarCollapse();
        document.dispatchEvent(new CustomEvent('sidebarLoaded'));
    }

    tryLoadSidebar();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
} else {
    initSidebar();
}

function initializeSidebarCollapse() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (!sidebarToggle || !sidebar) return;

    // Touch/swipe variables
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;

    // On desktop, start with sidebar visible and toggle button hidden
    // On mobile, start with sidebar collapsed and toggle button visible
    if (window.innerWidth > 768) {
        sidebar.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
        sidebarToggle.classList.remove('show');
    } else {
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
        sidebarToggle.classList.add('show');
    }

    // Toggle sidebar on button click
    sidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling to document
        sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed');
        sidebarToggle.classList.toggle('show');
    });


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
                document.body.classList.remove('sidebar-collapsed');
                sidebarToggle.classList.remove('show');
            }
        }
        // Swipe left to hide sidebar
        else if (deltaX < -minSwipeDistance) {
            if (!sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('collapsed');
                document.body.classList.add('sidebar-collapsed');
                sidebarToggle.classList.add('show');
            }
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            // Mobile: collapse sidebar and show toggle button
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
            sidebarToggle.classList.add('show');
        } else {
            // Desktop: expand sidebar and hide toggle button
            sidebar.classList.remove('collapsed');
            document.body.classList.remove('sidebar-collapsed');
            sidebarToggle.classList.remove('show');
        }
    });

}