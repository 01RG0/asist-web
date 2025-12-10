// Check authentication
if (!window.api.isAuthenticated()) {
    window.location.href = '/assistant/index.html';
}

const user = window.api.getUser();

// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
    alert('No session ID provided');
    window.location.href = '/assistant/sessions.html';
}

// DOM Elements
const sessionNameEl = document.getElementById('session-name');
const sessionTitleEl = document.getElementById('session-title');
const sessionDateEl = document.getElementById('session-date');
const sessionTimeEl = document.getElementById('session-time');
const sessionProgressEl = document.getElementById('session-progress');

const studentNameEl = document.getElementById('student-name');
const studentPhoneEl = document.getElementById('student-phone');
const parentPhoneEl = document.getElementById('parent-phone');
const howManyCheckEl = document.getElementById('how-many-check');
const totalTestCheckEl = document.getElementById('total-test-check');

const currentStudentEl = document.getElementById('current-student');
const totalStudentsEl = document.getElementById('total-students');

const callStudentBtn = document.getElementById('call-student');
const whatsappStudentBtn = document.getElementById('whatsapp-student');
const callParentBtn = document.getElementById('call-parent');
const whatsappParentBtn = document.getElementById('whatsapp-parent');

const addCommentBtn = document.getElementById('add-comment-btn');
const commentModal = document.getElementById('comment-modal');
const closeCommentModal = document.getElementById('close-comment-modal');
const cancelCommentBtn = document.getElementById('cancel-comment');
const saveCommentBtn = document.getElementById('save-comment');
const commentTextEl = document.getElementById('comment-text');
const commentsListEl = document.getElementById('comments-list');

const prevStudentBtn = document.getElementById('prev-student');
const nextStudentBtn = document.getElementById('next-student');

const roundOneBtn = document.getElementById('round-one-btn');
const roundTwoBtn = document.getElementById('round-two-btn');
const recallBtn = document.getElementById('recall-student-btn');

const filterButtons = document.querySelectorAll('.filter-btn');

// Data
let sessionData = null;
let students = []; // Holds current student (length 1) normally
let currentStudentIndex = 0;
let historyMode = false;
let historyOffset = 0; // 0 = last processed, 1 = one before that, etc.
let isOnline = navigator.onLine;
let isRoundTwoMode = false; // Track if we're in round two mode
const STORAGE_KEY = `call_session_${sessionId}`;

// Connection Status Management
function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    if (navigator.onLine) {
        statusEl.classList.remove('offline');
        statusEl.classList.add('online');
        statusEl.title = 'Connected';
        isOnline = true;
    } else {
        statusEl.classList.remove('online');
        statusEl.classList.add('offline');
        statusEl.title = 'No Connection';
        isOnline = false;
        showToast('Connection lost. Please reconnect to continue.', 'error');
    }
}

// Listen for online/offline events
window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast('Connection restored!', 'success');
});

window.addEventListener('offline', () => {
    updateConnectionStatus();
});

// Round Mode Functions
function setRoundMode(isRoundTwo) {
    isRoundTwoMode = isRoundTwo;

    // Update button styles
    if (isRoundTwo) {
        roundOneBtn.classList.remove('active');
        roundOneBtn.style.background = 'white';
        roundOneBtn.style.color = 'var(--text-secondary)';

        roundTwoBtn.classList.add('active');
        roundTwoBtn.style.background = 'var(--primary)';
        roundTwoBtn.style.color = 'white';

        // Show recall button, hide next student button
        recallBtn.style.display = 'inline-block';
        nextStudentBtn.style.display = 'none';
    } else {
        roundTwoBtn.classList.remove('active');
        roundTwoBtn.style.background = 'white';
        roundTwoBtn.style.color = 'var(--text-secondary)';

        roundOneBtn.classList.add('active');
        roundOneBtn.style.background = 'var(--primary)';
        roundOneBtn.style.color = 'white';

        // Show next student button, hide recall button
        nextStudentBtn.style.display = 'inline-block';
        recallBtn.style.display = 'none';
    }

    // Clear current student when switching modes
    students = [];
    currentStudentIndex = 0;
    showNoStudentsMessage();
    saveSessionState();
}

// Recall No-Answer Student Function
async function recallNoAnswerStudent() {
    if (!sessionId) {
        showToast('No active session', 'error');
        return;
    }

    // Disable button during loading
    recallBtn.disabled = true;
    recallBtn.textContent = 'Recalling...';

    try {
        const response = await window.api.makeRequest('POST', `/activities/call-sessions/${sessionId}/assign-round-two`);

        if (response.success) {
            if (response.data) {
                // Found a student
                const student = response.data;

                // We keep students array just to play nice with existing "currentStudentIndex" logic if needed,
                // but really we only have ONE current student now.
                students = [student]; // Just one
                currentStudentIndex = 0;

                displayStudent(student);
                saveSessionState(); // Save state after loading student

                if (response.message) showToast(response.message); // "New student assigned" or "Continued with..."

                // Update stats
                if (response.stats) {
                    document.getElementById('remaining-count').textContent = response.stats.remaining;
                    document.getElementById('completed-count').textContent = response.stats.completed;
                }
            } else {
                // No more students
                showNoStudentsMessage();
                // Update stats even if no student found (should vary likely optionally be 0)
                if (response.stats) {
                    document.getElementById('remaining-count').textContent = 0; // Or from response
                    document.getElementById('completed-count').textContent = response.stats.completed;
                }
                showToast(response.message || 'All no-answer students completed!', 'success');
            }
        } else {
            showToast(response.message || 'Failed to recall student', 'error');
        }
    } catch (error) {
        console.error('Error recalling no-answer student:', error);
        showToast('Failed to recall student', 'error');
    } finally {
        // Re-enable button
        recallBtn.disabled = false;
        recallBtn.textContent = 'Recall No-Answer Student';
    }
}

async function checkRoundTwoAvailability() {
    try {
        // Check if round two is enabled for this session
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${sessionId}`);
        if (response.success && response.data.status === 'active') {
            // Only show round two button if admin has actually started round two
            // Check if there are any no-answer students assigned for round two
            try {
                const studentsResponse = await window.api.makeRequest('GET', `/activities/call-sessions/${sessionId}/students`);
                if (studentsResponse.success && studentsResponse.data) {
                    // Check if any students have round two assignments (meaning round two was started)
                    const hasRoundTwoStudents = studentsResponse.data.some(student =>
                        student.filterStatus === 'no-answer' && student.round_two_assigned_to
                    );

                    if (hasRoundTwoStudents) {
                        roundTwoBtn.style.display = 'inline-block';
                    } else {
                        roundTwoBtn.style.display = 'none';
                    }
                }
            } catch (studentsError) {
                console.error('Error checking students for round two:', studentsError);
                roundTwoBtn.style.display = 'none';
            }
        } else {
            roundTwoBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking round two availability:', error);
        roundTwoBtn.style.display = 'none';
    }
}

// State Persistence Functions
function saveSessionState() {
    try {
        const state = {
            sessionId,
            sessionData,
            currentStudent: students[0] || null,
            historyMode,
            historyOffset,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('Error saving session state:', error);
    }
}

function restoreSessionState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);
            // Check if state is recent (within 24 hours)
            const age = Date.now() - state.timestamp;
            if (age < 24 * 60 * 60 * 1000) {
                sessionData = state.sessionData;
                if (state.currentStudent) {
                    students = [state.currentStudent];
                    displayStudent(state.currentStudent);
                }
                historyMode = state.historyMode;
                historyOffset = state.historyOffset;
                return true;
            }
        }
    } catch (error) {
        console.error('Error restoring session state:', error);
    }
    return false;
}

function clearSessionState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing session state:', error);
    }
}

// Initialize page
async function init() {
    updateConnectionStatus();

    // Try to restore state first
    const restored = restoreSessionState();

    // Always load session data to get latest info
    await loadSessionData();

    // Check if round two is available
    await checkRoundTwoAvailability();

    if (restored && students.length > 0 && students[0]) {
        // Check if the restored student already has a filter status (completed)
        const restoredStudent = students[0];
        if (restoredStudent.filterStatus && restoredStudent.filterStatus !== '') {
            // Student is already completed, load a new one instead
            console.log('Restored student is already completed, loading new student...');
            await loadNextStudent();
        }
        // else: Student is not completed, keep showing it
    } else {
        // No state restored or invalid state, load next student
        await loadNextStudent();
    }

    setupEventListeners();
}

// Load PREVIOUS student (History)
async function loadPreviousStudent() {
    try {
        // Fetch history for this user
        // We want the Nth most recent student processed by this user
        const offset = historyMode ? historyOffset + 1 : 0;

        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${sessionId}/students?assigned_to=me&has_status=true&limit=1&offset=${offset}`);

        if (response.success && response.data && response.data.length > 0) {
            const student = response.data[0]; // The student from history

            historyMode = true;
            historyOffset = offset;

            // Map backend fields to frontend model
            // Backend returns: { _id, name, student_phone, parent_phone, filter_status, comments, ... }
            // Frontend expects: { id, name, studentPhone, parentPhone, filterStatus, comments: [ {text, timestamp, author} ] }

            // Standardize object
            const mappedStudent = {
                id: student._id,
                name: student.name,
                studentPhone: student.student_phone,
                parentPhone: student.parent_phone,
                studentId: student.studentId || student.student_id || '',
                center: student.center || '',
                examMark: student.examMark || student.exam_mark || '',
                attendanceStatus: student.attendanceStatus || student.attendance_status || '',
                filterStatus: student.filter_status,
                comments: student.comments || [],
                howMany: student.how_many,
                totalTest: student.total_test
            };

            students = [mappedStudent];
            currentStudentIndex = 0;

            displayStudent(mappedStudent);
            saveSessionState();
            showToast(`Viewing history (${historyOffset + 1} back)`, 'info');
        } else {
            showToast('No previous students found', 'info');
        }
    } catch (error) {
        console.error('Error loading previous student:', error);
        showToast('Failed to load history', 'error');
    }
}

// Load session data from API
async function loadSessionData() {
    try {
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${sessionId}`);
        if (response.success) {
            sessionData = response.data;
            sessionNameEl.textContent = sessionData.name;

            // update stats if available
            if (sessionData.stats) {
                document.getElementById('remaining-count').textContent = sessionData.stats.remaining;
                document.getElementById('completed-count').textContent = sessionData.stats.completed;
            }
        } else {
            showToast('Failed to load session data', 'error');
        }
    } catch (error) {
        console.error('Error loading session:', error);
        showToast('Error loading session', 'error');
    }
}

// Load NEXT available student (Locking)
async function loadNextStudent() {
    // If we are in history mode and user clicks Next
    if (historyMode) {
        if (historyOffset > 0) {
            // Move forward in history (towards the present)
            historyOffset--;
            const response = await window.api.makeRequest('GET', `/activities/call-sessions/${sessionId}/students?assigned_to=me&has_status=true&limit=1&offset=${historyOffset}`);
            if (response.success && response.data && response.data.length > 0) {
                const student = response.data[0];
                const mappedStudent = {
                    id: student._id,
                    name: student.name,
                    studentPhone: student.student_phone,
                    parentPhone: student.parent_phone,
                    filterStatus: student.filter_status,
                    comments: student.comments || [],
                    howMany: student.how_many,
                    totalTest: student.total_test
                };
                students = [mappedStudent];
                currentStudentIndex = 0;
                displayStudent(mappedStudent);
                showToast(`Viewing history (${historyOffset + 1} back)`, 'info');
                return;
            }
        } else {
            // If offset is 0, we are at the latest history item. Next click should exit history and resume work.
            historyMode = false;
            // Fall through to normal loadNextStudent logic below...
        }
    }

    try {
        // Show loading state
        studentNameEl.value = 'Loading next student...';
        studentPhoneEl.value = '';
        parentPhoneEl.value = '';
        commentsListEl.innerHTML = '';
        filterButtons.forEach(b => b.classList.remove('active'));

        // Only assign regular students in round one mode
        // Round two requires explicit recall button click
        const endpoint = `/activities/call-sessions/${sessionId}/assign`;
        const response = await window.api.makeRequest('POST', endpoint);

        if (response.success) {
            if (response.data) {
                // Found a student
                const student = response.data;

                // We keep students array just to play nice with existing "currentStudentIndex" logic if needed,
                // but really we only have ONE current student now.
                students = [student]; // Just one
                currentStudentIndex = 0;

                displayStudent(student);
                saveSessionState(); // Save state after loading student

                if (response.message) showToast(response.message); // "New student assigned" or "Continued with..."

                // Update stats
                if (response.stats) {
                    document.getElementById('remaining-count').textContent = response.stats.remaining;
                    document.getElementById('completed-count').textContent = response.stats.completed;
                }
            } else {
                // No more students
                showNoStudentsMessage();
                // Update stats even if no student found (should vary likely optionally be 0)
                if (response.stats) {
                    document.getElementById('remaining-count').textContent = 0; // Or from response
                    document.getElementById('completed-count').textContent = response.stats.completed;
                }
                showToast(response.message || 'All students completed!', 'success');
            }
        } else {
            showToast(response.message || 'Failed to assign student', 'error');
        }
    } catch (error) {
        console.error('Error loading next student:', error);
        // Log more details if available
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        showToast(`Error loading student: ${error.message}`, 'error');
    }
}

// Show message when no students
function showNoStudentsMessage() {
    studentNameEl.value = 'ALL COMPLETED! 🎉';
    studentPhoneEl.value = '';
    parentPhoneEl.value = '';
    currentStudentEl.textContent = '-';
    totalStudentsEl.textContent = '-';

    // Disable call buttons
    callStudentBtn.disabled = true;
    callParentBtn.disabled = true;

    // Enable Previous button so user can access history
    if (prevStudentBtn) {
        prevStudentBtn.disabled = false;
        prevStudentBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            View History
        `;
    }

    // Disable Next button
    if (nextStudentBtn) nextStudentBtn.disabled = true;
}

function displayStudent(student) {
    studentNameEl.value = student.name;
    studentPhoneEl.value = student.studentPhone;
    parentPhoneEl.value = student.parentPhone;

    // We don't know total count easily here without another API call, so maybe just show "Current"
    currentStudentEl.textContent = 'Active';
    totalStudentsEl.textContent = isRoundTwoMode ? 'Round 2' : 'Session';

    // Display optional fields if they exist
    const studentIdEl = document.getElementById('student-id');
    const centerEl = document.getElementById('center');
    const examMarkEl = document.getElementById('exam-mark');
    const studentIdGroup = document.getElementById('student-id-group');
    const centerGroup = document.getElementById('center-group');
    const examMarkGroup = document.getElementById('exam-mark-group');
    const optionalSection = document.getElementById('optional-info-section');

    let hasOptionalInfo = false;

    if (student.studentId) {
        studentIdEl.value = student.studentId;
        studentIdGroup.style.display = 'block';
        hasOptionalInfo = true;
    } else {
        studentIdGroup.style.display = 'none';
    }

    if (student.center) {
        centerEl.value = student.center;
        centerGroup.style.display = 'block';
        hasOptionalInfo = true;
    } else {
        centerGroup.style.display = 'none';
    }

    if (student.examMark !== undefined && student.examMark !== null && student.examMark !== '') {
        examMarkEl.value = student.examMark;
        examMarkGroup.style.display = 'block';
        hasOptionalInfo = true;
    } else {
        examMarkGroup.style.display = 'none';
    }

    // Attendance Status
    const attendanceStatusEl = document.getElementById('attendance-status');
    const attendanceStatusGroup = document.getElementById('attendance-status-group');

    if (student.attendanceStatus) {
        attendanceStatusEl.value = student.attendanceStatus;
        attendanceStatusGroup.style.display = 'block';
        hasOptionalInfo = true;

        // Color code based on status
        if (student.attendanceStatus.toLowerCase().includes('absent')) {
            attendanceStatusEl.style.color = '#ef4444'; // Red for absent
        } else if (student.attendanceStatus.toLowerCase().includes('present')) {
            attendanceStatusEl.style.color = '#10b981'; // Green for present
        } else {
            attendanceStatusEl.style.color = 'var(--text-primary)';
        }
    } else {
        attendanceStatusGroup.style.display = 'none';
    }

    // Homework Status
    const homeworkStatusEl = document.getElementById('homework-status');
    const homeworkStatusGroup = document.getElementById('homework-status-group');

    if (student.homeworkStatus) {
        homeworkStatusEl.value = student.homeworkStatus;
        homeworkStatusGroup.style.display = 'block';
        hasOptionalInfo = true;

        // Color code based on homework status
        const hwLower = student.homeworkStatus.toLowerCase();
        if (hwLower.includes('done') || hwLower.includes('completed') || hwLower === 'yes') {
            homeworkStatusEl.style.color = '#10b981'; // Green for done
        } else if (hwLower.includes('not completed') || hwLower.includes('incomplete') || hwLower === 'no') {
            homeworkStatusEl.style.color = '#ef4444'; // Red for not completed
        } else if (hwLower.includes('not evaluated') || hwLower.includes('pending')) {
            homeworkStatusEl.style.color = '#f59e0b'; // Orange for not evaluated
        } else {
            homeworkStatusEl.style.color = 'var(--text-primary)';
        }
    } else {
        homeworkStatusGroup.style.display = 'none';
    }

    // Show optional section only if at least one field has data
    optionalSection.style.display = hasOptionalInfo ? 'block' : 'none';

    // Load comments
    loadComments(student.comments);

    // Update checkboxes
    if (howManyCheckEl) howManyCheckEl.checked = student.howMany || false;
    if (totalTestCheckEl) totalTestCheckEl.checked = student.totalTest || false;

    // Update navigation buttons - "Previous" is disabled in this flow
    if (prevStudentBtn) prevStudentBtn.disabled = true;
    if (nextStudentBtn) nextStudentBtn.disabled = false; // "Next" fetches new one

    // Update filter button states
    filterButtons.forEach(btn => {
        if (btn.dataset.filter === student.filterStatus) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Check validation state
    updateNextButtonState();
}

function updateNextButtonState() {
    if (!students || students.length === 0 || !students[currentStudentIndex]) return;

    const student = students[currentStudentIndex];
    const hasStatus = student.filterStatus && student.filterStatus !== '';
    const hasComments = student.comments && student.comments.length > 0;

    // Visual feedback for disabled state
    // Don't validate/disable if in history mode (we are just browsing)
    if (!historyMode && !hasStatus && !hasComments) {
        nextStudentBtn.style.opacity = '0.5';
        nextStudentBtn.style.cursor = 'not-allowed';
    } else {
        nextStudentBtn.style.opacity = '1';
        nextStudentBtn.style.cursor = 'pointer';
    }
}

// Setup event listeners
function setupEventListeners() {
    // End session button
    const endSessionBtn = document.getElementById('end-session-btn');
    if (endSessionBtn) {
        endSessionBtn.addEventListener('click', endSession);
    }

    // Previous student button
    if (prevStudentBtn) {
        prevStudentBtn.addEventListener('click', loadPreviousStudent);
    }

    // Mode toggle buttons
    roundOneBtn.addEventListener('click', () => {
        setRoundMode(false);
    });

    roundTwoBtn.addEventListener('click', () => {
        setRoundMode(true);
    });

    // Recall button for round two
    if (recallBtn) {
        recallBtn.addEventListener('click', recallNoAnswerStudent);
    }

    // Phone actions
    callStudentBtn.addEventListener('click', () => {
        const phone = studentPhoneEl.value.replace(/\s/g, '');
        if (phone) window.location.href = `tel:${phone}`;
    });

    whatsappStudentBtn.addEventListener('click', () => {
        const phone = studentPhoneEl.value.replace(/[^0-9]/g, '');
        if (phone) window.open(`https://wa.me/${phone}`, '_blank');
    });

    // Click to copy for student phone
    studentPhoneEl.addEventListener('click', () => {
        if (studentPhoneEl.value) copyToClipboard(studentPhoneEl.value);
    });

    callParentBtn.addEventListener('click', () => {
        const phone = parentPhoneEl.value.replace(/\s/g, '');
        if (phone) window.location.href = `tel:${phone}`;
    });

    whatsappParentBtn.addEventListener('click', () => {
        const phone = parentPhoneEl.value.replace(/[^0-9]/g, '');
        if (phone) window.open(`https://wa.me/${phone}`, '_blank');
    });

    // Click to copy for parent phone
    parentPhoneEl.addEventListener('click', () => {
        if (parentPhoneEl.value) copyToClipboard(parentPhoneEl.value);
    });

    // Comment modal
    addCommentBtn.addEventListener('click', openCommentModal);
    closeCommentModal.addEventListener('click', closeModal);
    cancelCommentBtn.addEventListener('click', closeModal);
    saveCommentBtn.addEventListener('click', saveComment);

    commentModal.addEventListener('click', (e) => {
        if (e.target === commentModal) closeModal();
    });

    // Navigation - ONLY Next is supported now
    if (nextStudentBtn) {
        nextStudentBtn.addEventListener('click', () => {
            const student = students[currentStudentIndex];
            if (!student) {
                loadNextStudent();
                return;
            }
            const hasStatus = student.filterStatus && student.filterStatus !== '';
            const hasComments = student.comments && student.comments.length > 0;

            if (!hasStatus && !hasComments) {
                showToast('Please select a status or add a comment first', 'warning');
                return;
            }

            loadNextStudent();
        });
    }

    // Filters
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!isOnline) {
                showToast('Cannot update status while offline', 'error');
                return;
            }

            const filter = btn.dataset.filter;
            if (!filter) return;

            const student = students[currentStudentIndex];
            if (!student) return;

            const oldStatus = student.filterStatus;

            // Toggle
            const newStatus = (btn.classList.contains('active')) ? '' : filter;

            // UI Update first (optimistic)
            filterButtons.forEach(b => b.classList.remove('active'));
            if (newStatus) btn.classList.add('active');

            student.filterStatus = newStatus;

            // Validation update
            updateNextButtonState();

            // API Call
            try {
                const response = await window.api.makeRequest('PUT', `/activities/call-sessions/students/${student.id}`, {
                    filterStatus: newStatus
                });

                if (!response.success) {
                    // Revert on failure
                    student.filterStatus = oldStatus;
                    updateNextButtonState(); // Revert validation
                    displayStudent(student); // Reset UI
                    showToast('Failed to save status', 'error');
                } else {
                    saveSessionState(); // Save state after successful update
                }
            } catch (error) {
                console.error('Save status error:', error);
                student.filterStatus = oldStatus;
                updateNextButtonState(); // Revert validation
                displayStudent(student);
                showToast('Failed to save status', 'error');
            }
        });
    });

    // Checkboxes (How Many / Total Test)
    if (howManyCheckEl) {
        howManyCheckEl.addEventListener('change', async (e) => {
            if (!isOnline) {
                showToast('Cannot update while offline', 'error');
                e.target.checked = !e.target.checked;
                return;
            }
            const student = students[currentStudentIndex];
            if (!student) return;
            const val = e.target.checked;
            student.howMany = val;

            try {
                await window.api.makeRequest('PUT', `/activities/call-sessions/students/${student.id}`, { howMany: val });
            } catch (error) {
                console.error('Save checkbox error:', error);
                showToast('Failed to save', 'error');
                e.target.checked = !val; // Revert
            }
        });
    }

    if (totalTestCheckEl) {
        totalTestCheckEl.addEventListener('change', async (e) => {
            if (!isOnline) {
                showToast('Cannot update while offline', 'error');
                e.target.checked = !e.target.checked;
                return;
            }
            const student = students[currentStudentIndex];
            if (!student) return;
            const val = e.target.checked;
            student.totalTest = val;

            try {
                await window.api.makeRequest('PUT', `/activities/call-sessions/students/${student.id}`, { totalTest: val });
            } catch (error) {
                console.error('Save checkbox error:', error);
                showToast('Failed to save', 'error');
                e.target.checked = !val; // Revert
            }
        });
    }

    // Auto-save before leaving page
    window.addEventListener('beforeunload', () => {
        if (students.length > 0 && students[0]) {
            saveSessionState();
        }
    });
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy', 'error');
    });
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Comment modal functions
function openCommentModal() {
    commentTextEl.value = '';
    commentModal.classList.add('active');
}

function closeModal() {
    commentModal.classList.remove('active');
}

async function saveComment() {
    const text = commentTextEl.value.trim();
    if (!text) {
        showToast('Please enter a comment', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-comment');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const student = students[currentStudentIndex];

    try {
        const response = await window.api.makeRequest('PUT', `/activities/call-sessions/students/${student.id}`, {
            comment: text
        });

        if (response.success) {
            // Update local model
            const comment = {
                timestamp: new Date().toISOString(),
                text: text
            };
            student.comments.push(comment);

            // Update UI
            loadComments(student.comments);

            // Update validation
            updateNextButtonState();

            saveSessionState(); // Save state after adding comment
            closeModal();
            showToast('Comment added successfully!');
        } else {
            showToast('Failed to save comment', 'error');
        }
    } catch (error) {
        console.error('Save comment error:', error);
        showToast('Failed to save comment', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// Render comments
function loadComments(comments) {
    commentsListEl.innerHTML = '';
    if (!comments || comments.length === 0) {
        commentsListEl.innerHTML = '<div class="no-comments" style="color: #64748b; font-style: italic; font-size: 0.9rem;">No comments yet</div>';
        return;
    }

    // Sort by timestamp descending (newest first)
    const sortedComments = [...comments].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedComments.forEach(comment => {
        const div = document.createElement('div');
        div.className = 'comment-item';
        div.style.cssText = `
            background: #f8fafc;
            padding: 0.75rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border: 1px solid #e2e8f0;
        `;

        const dateStr = new Date(comment.timestamp).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });

        div.innerHTML = `
            <div class="comment-text" style="color: #334155; margin-bottom: 0.25rem;">${comment.text}</div>
            <div class="comment-meta" style="font-size: 0.75rem; color: #94a3b8;">
                ${dateStr} ${comment.author ? ` • ${comment.author}` : ''}
            </div>
        `;
        commentsListEl.appendChild(div);
    });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// End Session Function
async function endSession() {
    if (!isOnline) {
        showToast('Cannot end session while offline. Please reconnect.', 'error');
        return;
    }

    const confirmed = confirm('Are you sure you want to end this call session?\n\nYour progress will be saved.');
    if (!confirmed) return;

    const endBtn = document.getElementById('end-session-btn');
    const originalText = endBtn.textContent;
    endBtn.disabled = true;
    endBtn.textContent = 'Ending...';

    try {
        const response = await window.api.makeRequest('POST', `/activities/call-sessions/${sessionId}/stop`);

        if (response.success) {
            clearSessionState();
            showToast('✅ Session ended successfully!', 'success');

            // Redirect after 2 seconds
            setTimeout(() => {
                window.location.href = 'sessions.html';
            }, 2000);
        } else {
            showToast(response.message || 'Failed to end session', 'error');
            endBtn.disabled = false;
            endBtn.textContent = originalText;
        }
    } catch (error) {
        console.error('Error ending session:', error);
        showToast('Error ending session: ' + error.message, 'error');
        endBtn.disabled = false;
        endBtn.textContent = originalText;
    }
}

// Initialize on page load
init();
