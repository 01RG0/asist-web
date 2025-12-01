/**
 * Mock API for testing without database
 * Simulates API responses without hitting real endpoints
 */

const TEST_CONFIG = require('./test-config');

// Mock data storage (in-memory)
const mockData = {
    users: [
        {
            id: 'test-user-1',
            name: 'Test Admin',
            email: TEST_CONFIG.TEST_ADMIN_EMAIL,
            role: 'admin',
            password: TEST_CONFIG.TEST_ADMIN_PASSWORD
        },
        {
            id: 'test-user-2',
            name: 'Test Assistant',
            email: 'test-assistant@test.com',
            role: 'assistant'
        }
    ],
    sessions: [],
    attendance: [],
    centers: [
        {
            id: 'test-center-1',
            name: 'Test Center',
            address: 'Test Address',
            latitude: 30.0444,
            longitude: 31.2357
        }
    ],
    tokens: {}
};

/**
 * Mock API request handler
 */
async function mockRequest(method, endpoint, data = {}, token = null) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Normalize endpoint (remove /api prefix if present)
    const normalizedEndpoint = endpoint.replace(/^\/api/, '');
    
    // Auth endpoints
    if (normalizedEndpoint === '/auth/login' && method === 'POST') {
        // Allow any email/password in mock mode, or match test credentials
        const isTestAdmin = data.email === TEST_CONFIG.TEST_ADMIN_EMAIL || 
                           data.email === 'admin@example.com' ||
                           data.email.includes('admin');
        
        if (isTestAdmin || data.email) {
            const mockUser = mockData.users.find(u => u.email === data.email) || {
                id: 'mock-user-' + Date.now(),
                name: data.email.split('@')[0],
                email: data.email,
                role: isTestAdmin ? 'admin' : 'assistant'
            };
            
            const mockToken = `mock-token-${mockUser.id}-${Date.now()}`;
            mockData.tokens[mockToken] = mockUser;
            return {
                success: true,
                token: mockToken,
                user: { id: mockUser.id, name: mockUser.name, email: mockUser.email, role: mockUser.role }
            };
        }
        return { success: false, message: 'Invalid credentials' };
    }

    // Verify token
    if (token && !mockData.tokens[token]) {
        return { success: false, message: 'Invalid token' };
    }

    const currentUser = mockData.tokens[token];

    // Get centers (public endpoint, but requires auth)
    if (normalizedEndpoint === '/centers' && method === 'GET') {
        if (!currentUser) {
            return { success: false, message: 'Unauthorized' };
        }
        return { success: true, data: mockData.centers };
    }

    // Admin endpoints
    if (normalizedEndpoint.startsWith('/admin/')) {
        if (!currentUser || currentUser.role !== 'admin') {
            return { success: false, message: 'Unauthorized' };
        }

        // Get users
        if (normalizedEndpoint === '/admin/users' && method === 'GET') {
            return { success: true, data: mockData.users.map(u => ({ ...u, password: undefined })) };
        }

        // Create session
        if (normalizedEndpoint === '/admin/sessions' && method === 'POST') {
            const session = {
                id: `test-session-${Date.now()}`,
                subject: data.subject || 'Test Session',
                start_time: data.start_time || new Date().toISOString(),
                center_id: data.center_id || mockData.centers[0]?.id,
                assistant_id: data.assistant_id || null,
                recurrence_type: data.recurrence_type || 'one_time',
                day_of_week: data.day_of_week || null,
                is_active: data.is_active !== false,
                created_at: new Date().toISOString()
            };
            mockData.sessions.push(session);
            return { success: true, data: session };
        }

        // Get sessions
        if (normalizedEndpoint === '/admin/sessions' && method === 'GET') {
            return { success: true, data: mockData.sessions };
        }

        // Get session by ID
        if (normalizedEndpoint.match(/^\/admin\/sessions\/[^\/]+$/) && method === 'GET') {
            const id = normalizedEndpoint.split('/').pop();
            const session = mockData.sessions.find(s => s.id === id);
            if (session) {
                return { success: true, data: session };
            }
            return { success: false, message: 'Session not found' };
        }

        // Delete session
        if (normalizedEndpoint.match(/^\/admin\/sessions\/[^\/]+$/) && method === 'DELETE') {
            const id = normalizedEndpoint.split('/').pop();
            const index = mockData.sessions.findIndex(s => s.id === id);
            if (index !== -1) {
                mockData.sessions.splice(index, 1);
                return { success: true, message: 'Session deleted' };
            }
            return { success: false, message: 'Session not found' };
        }

        // Get attendance
        if (normalizedEndpoint === '/admin/attendance' && method === 'GET') {
            // If no attendance, create a test one
            if (mockData.attendance.length === 0) {
                const testAttendance = {
                    id: 'test-attendance-1',
                    assistant_id: mockData.users.find(u => u.role === 'assistant')?.id || 'test-user-2',
                    session_id: 'test-session-1',
                    center_id: mockData.centers[0]?.id || 'test-center-1',
                    time_recorded: new Date().toISOString(),
                    delay_minutes: 0,
                    notes: 'Test attendance',
                    session_subject: 'Test Session'
                };
                mockData.attendance.push(testAttendance);
            }
            // Format attendance for list view (include subject field)
            const formattedAttendance = mockData.attendance.map(a => ({
                ...a,
                subject: a.session_subject || 'Unknown'
            }));
            return { success: true, data: formattedAttendance };
        }

        // Get attendance by ID
        if (normalizedEndpoint.match(/^\/admin\/attendance\/[^\/]+$/) && method === 'GET') {
            const id = normalizedEndpoint.split('/').pop();
            const attendance = mockData.attendance.find(a => a.id === id);
            if (attendance) {
                return { success: true, data: attendance };
            }
            return { success: false, message: 'Attendance not found' };
        }

        // Create attendance
        if (normalizedEndpoint === '/admin/attendance/manual' && method === 'POST') {
            // Get session subject from session if session_id is provided
            let sessionSubject = 'Test Session';
            if (data.session_id) {
                const session = mockData.sessions.find(s => s.id === data.session_id);
                if (session) {
                    sessionSubject = session.subject;
                }
            }
            
            const attendance = {
                id: `test-attendance-${Date.now()}`,
                ...data,
                time_recorded: data.time_recorded || new Date().toISOString(),
                session_subject: sessionSubject,
                created_at: new Date().toISOString()
            };
            mockData.attendance.push(attendance);
            return { success: true, data: attendance };
        }

        // Update attendance
        if (normalizedEndpoint.match(/^\/admin\/attendance\/[^\/]+$/) && method === 'PUT') {
            const id = normalizedEndpoint.split('/').pop();
            const index = mockData.attendance.findIndex(a => a.id === id);
            if (index !== -1) {
                mockData.attendance[index] = { ...mockData.attendance[index], ...data };
                return { success: true, data: mockData.attendance[index] };
            }
            return { success: false, message: 'Attendance not found' };
        }

        // Delete attendance
        if (normalizedEndpoint.match(/^\/admin\/attendance\/[^\/]+$/) && method === 'DELETE') {
            const id = normalizedEndpoint.split('/').pop();
            const index = mockData.attendance.findIndex(a => a.id === id);
            if (index !== -1) {
                mockData.attendance.splice(index, 1);
                return { success: true, message: 'Attendance deleted' };
            }
            return { success: false, message: 'Attendance not found' };
        }

        // Error logs
        if (normalizedEndpoint === '/admin/error-logs' && method === 'GET') {
            return {
                success: true,
                data: [],
                pagination: { page: 1, limit: 50, total: 0, pages: 1 }
            };
        }
    }

    return { success: false, message: 'Endpoint not found' };
}

/**
 * Clear mock data
 */
function clearMockData() {
    mockData.sessions = [];
    mockData.attendance = [];
    mockData.tokens = {};
}

module.exports = {
    mockRequest,
    clearMockData,
    mockData
};

