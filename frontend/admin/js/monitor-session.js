// Monitor Session JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

// Global state
let currentSessionId = null;
let currentSessionData = null;
let currentStudents = []; // Array of student objects
let roundTwoEnabled = false; // Track if round two is active

// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
currentSessionId = urlParams.get('session');

if (!currentSessionId) {
    alert('No session ID provided');
    window.location.href = 'call-sessions.html';
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

// Get color for homework status
function getHomeworkColor(status) {
    if (!status) return 'var(--text-primary)';

    const s = status.toLowerCase();

    if (s.includes('done') || s.includes('completed') || s === 'yes') {
        return '#10b981'; // Green
    } else if (s.includes('not completed') || s.includes('incomplete') || s === 'no') {
        return '#ef4444'; // Red
    } else if (s.includes('not evaluated') || s.includes('pending')) {
        return '#f59e0b'; // Orange
    } else {
        return 'var(--text-primary)';
    }
}

// Format filter status for display
function formatFilterStatus(status) {
    if (!status) return 'Pending';

    const statusMap = {
        'present': 'Present (حاضر)',
        'wrong-number': 'Wrong Number',
        'no-answer': 'No Answer',
        'online-makeup': 'Online Makeup',
        'left-teacher': 'Left Teacher',
        'other-makeup': 'Other Makeup',
        'tired': 'Tired'
    };

    return statusMap[status] || status;
}

// Get color for filter status
function getFilterStatusColor(status) {
    if (!status) return { bg: '#f3f4f6', text: '#374151' };

    // Present status gets special green styling
    if (status === 'present') {
        return { bg: '#dcfce7', text: '#166534' };
    }

    // Other statuses use the same styling as before
    return { bg: '#dcfce7', text: '#166534' };
}

// Initialize
async function init() {
    await loadSessionDetails();
    await loadStudents();
    setupEventListeners();
}

// Load Session Details
async function loadSessionDetails() {
    try {
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${currentSessionId}`);
        if (response.success) {
            currentSessionData = response.data;
            document.getElementById('session-name').textContent = currentSessionData.name;
            document.getElementById('session-date').textContent = currentSessionData.date;

            // Status badge
            const statusEl = document.getElementById('session-status');
            const status = currentSessionData.status;
            statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            if (status === 'completed') statusEl.style.color = 'var(--accent-green)';
            else statusEl.style.color = 'var(--accent-blue)';

            // Round two button is always visible and clickable
            const roundTwoBtn = document.getElementById('round-two-btn');
            if (roundTwoBtn) {
                // Always enable the button
                roundTwoBtn.disabled = false;
                roundTwoBtn.style.opacity = '1';
                roundTwoBtn.style.cursor = 'pointer';
            }

            // Hide/show attendance column header based on session type
            const attendanceHeader = document.getElementById('attendance-header-column');
            if (attendanceHeader && currentSessionData.session_type === 'marketing') {
                attendanceHeader.style.display = 'none';
            } else if (attendanceHeader) {
                attendanceHeader.style.display = '';
            }

            // Hide/show homework column header based on session type
            const homeworkHeader = document.getElementById('homework-header-column');
            if (homeworkHeader && currentSessionData.session_type === 'marketing') {
                homeworkHeader.style.display = 'none';
            } else if (homeworkHeader) {
                homeworkHeader.style.display = '';
            }
        }
    } catch (error) {
        console.error('Error loading session:', error);
        showAlert('Failed to load session details', 'error');
    }
}

// Load Students
async function loadStudents() {
    const tbody = document.getElementById('students-table-body');
    const sessionType = currentSessionData?.session_type || 'normal';
    const isMarketing = sessionType === 'marketing';
    const baseColspan = isMarketing ? 12 : 14;
    const colspan = roundTwoEnabled ? baseColspan + 2 : baseColspan;
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">Loading students...</td></tr>`;

    try {
        const response = await window.api.makeRequest('GET', `/activities/call-sessions/${currentSessionId}/students`);
        if (response.success) {
            currentStudents = response.data;
            populateFilters();
            applyFilters();
            updateStats();
        } else {
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">Failed to load students</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading students:', error);
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">Error loading students</td></tr>`;
    }
}

// Render Table
function renderStudentsTable(students) {
    const tbody = document.getElementById('students-table-body');
    const sessionType = currentSessionData?.session_type || 'normal';
    const isMarketing = sessionType === 'marketing';
    
    // Adjust colspan: subtract 2 if marketing (no attendance and homework columns), then add round two columns if enabled
    const baseColspan = isMarketing ? 12 : 14;
    const colspan = roundTwoEnabled ? baseColspan + 2 : baseColspan;
    
    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">No students found. Import or add some!</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map((s, index) => {
        // Find last comment
        const lastComment = s.comments && s.comments.length > 0
            ? s.comments[s.comments.length - 1].text
            : '-';

        const assigned = s.assignedTo
            ? `<span style="color: var(--accent-orange); font-weight: 500;">${s.assignedTo} (Active)</span>`
            : (s.lastCalledBy || '-');

        // Build attendance cell only for non-marketing sessions
        const attendanceCell = isMarketing ? '' : `
                <td>
                    ${s.attendanceStatus ? `<span style="color: ${s.attendanceStatus.toLowerCase().includes('absent') ? '#ef4444' : '#10b981'}; font-weight: 600;">${s.attendanceStatus}</span>` : '-'}
                </td>`;

        // Build homework cell only for non-marketing sessions
        const homeworkCell = isMarketing ? '' : `
                <td>
                    ${s.homeworkStatus ? `<span style="color: ${getHomeworkColor(s.homeworkStatus)}; font-weight: 600;">${s.homeworkStatus}</span>` : '-'}
                </td>`;

        return `
            <tr data-student-id="${s.id || s._id}">
                <td>${s.studentId || '-'}</td>
                <td>${s.name}</td>
                <td>${s.studentPhone || '-'}</td>
                <td>${s.parentPhone || '-'}</td>
                <td>${s.center || '-'}</td>
                <td>${s.examMark !== undefined && s.examMark !== null && s.examMark !== '' ? s.examMark : '-'}</td>
                ${attendanceCell}
                ${homeworkCell}
                <td>
                    <span class="badge" style="background: ${getFilterStatusColor(s.filterStatus).bg}; color: ${getFilterStatusColor(s.filterStatus).text};">
                        ${formatFilterStatus(s.filterStatus)}
                    </span>
                </td>
                <td>${assigned}</td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${lastComment}">${lastComment}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon edit-btn" data-student-id="${s.id || s._id}" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete-btn" data-student-id="${s.id || s._id}" title="Remove" style="color: var(--accent-red);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                ${roundTwoEnabled ? `
                <td>
                    ${s.filterStatus === 'no-answer' ? '<span style="color: var(--accent-orange); font-weight: 600;">Eligible</span>' : '<span style="color: var(--text-secondary);">Not Eligible</span>'}
                </td>
                <td>
                    ${s.roundTwoAssignedTo ? `<span style="color: var(--accent-purple); font-weight: 500;">${s.roundTwoAssignedTo}</span>` : '-'}
                </td>
                ` : ''}
            </tr>
        `;
    }).join('');

    // Attach listeners - use student ID instead of index
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.dataset.studentId;
            openEditModalById(studentId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.dataset.studentId;
            deleteStudentById(studentId);
        });
    });
}

function updateStats() {
    const total = currentStudents.length;
    const completed = currentStudents.filter(s => s.filterStatus).length;
    const pending = total - completed;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-pending').textContent = pending;
}

// Import & Merge Logic
function handleImport(file) {
    // Validate file
    if (!file) {
        showAlert('No file selected', 'error');
        return;
    }

    // Check file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValidFile = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidFile) {
        showAlert('Invalid file type. Please select an Excel file (.xlsx, .xls) or CSV file.', 'error');
        document.getElementById('import-file').value = ''; // Reset
        return;
    }

    const reader = new FileReader();
    
    reader.onerror = (error) => {
        console.error('FileReader error:', error);
        showAlert('Failed to read file. Please try again.', 'error');
        document.getElementById('import-file').value = ''; // Reset
    };

    reader.onload = async (e) => {
        try {
            const data = e.target.result;
            
            if (!data) {
                throw new Error('File is empty or could not be read');
            }

            let workbook;
            try {
                workbook = XLSX.read(data, { type: 'binary', cellDates: true });
            } catch (xlsxError) {
                throw new Error('Invalid Excel file format: ' + xlsxError.message);
            }

            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('Excel file has no sheets');
            }

            const sheetName = workbook.SheetNames[0];
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

            if (!jsonData || jsonData.length === 0) {
                throw new Error('Excel file is empty or has no data rows');
            }

            const importType = document.getElementById('import-type-monitor').value;

            // Normalize new data
            let newStudents = jsonData.map(row => {
                const normRow = {};
                Object.keys(row).forEach(key => {
                    const cleanKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    const val = row[key];
                    if (!val && val !== 0) return;

                    if (['name', 'studentname', 'student'].includes(cleanKey)) normRow.name = val;
                    else if (['studentphone', 'phone', 'mobile', 'studentmobile'].includes(cleanKey)) {
                        normRow.studentPhone = String(val).replace(/[^0-9+]/g, '');
                        // Add +20 prefix if missing and doesn't start with +
                        if (normRow.studentPhone && !normRow.studentPhone.startsWith('+')) {
                            // Remove leading 0 if present
                            if (normRow.studentPhone.startsWith('0')) {
                                normRow.studentPhone = normRow.studentPhone.substring(1);
                            }
                            normRow.studentPhone = '+20' + normRow.studentPhone;
                        }
                    }
                    else if (['parentphone', 'fatherphone', 'motherphone', 'parentmobile'].includes(cleanKey)) {
                        normRow.parentPhone = String(val).replace(/[^0-9+]/g, '');
                        // Add +20 prefix if missing and doesn't start with +
                        if (normRow.parentPhone && !normRow.parentPhone.startsWith('+')) {
                            // Remove leading 0 if present
                            if (normRow.parentPhone.startsWith('0')) {
                                normRow.parentPhone = normRow.parentPhone.substring(1);
                            }
                            normRow.parentPhone = '+20' + normRow.parentPhone;
                        }
                    }
                    else if (['exammark', 'mark', 'score', 'degree', 'grade', 'exam'].includes(cleanKey)) normRow.examMark = val;
                    else if (['center', 'location', 'branch', 'group'].includes(cleanKey)) normRow.center = val;
                    else if (['studentid', 'id', 'code', 'studentcode'].includes(cleanKey)) normRow.studentId = val;
                    else if (['attendancestatus', 'attendance', 'status', 'present', 'absent'].includes(cleanKey)) normRow.attendanceStatus = val;
                    else if (['homeworkstatus', 'homework', 'hw', 'hwstatus', 'assignment', 'assignmentstatus'].includes(cleanKey)) normRow.homeworkStatus = val;
                });

                // Apply override status if selected
                if (importType === 'absent') normRow.attendanceStatus = 'Absent';
                else if (importType === 'present') normRow.attendanceStatus = 'Present';

                return normRow.name ? normRow : null;
            }).filter(r => r !== null);

            // Deduplicate within the file itself
            const uniqueStudents = [];
            const seen = new Set();
            newStudents.forEach(s => {
                const key = s.studentPhone ? s.studentPhone.replace(/[^0-9]/g, '') : s.name.toLowerCase().trim();
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueStudents.push(s);
                }
            });

            if (newStudents.length > uniqueStudents.length) {
                console.log(`Filtered ${newStudents.length - uniqueStudents.length} duplicates from imported file.`);
            }
            newStudents = uniqueStudents;

            // MERGE LOGIC
            let addedCount = 0;
            let updatedCount = 0;
            const finalStudents = [...currentStudents];
            const newlyAddedIndices = []; // Track indices of newly added students

            newStudents.forEach((newS, index) => {
                // Find match by Phone (preferred) or Name
                let existingIndex = -1;

                if (newS.studentPhone && newS.studentPhone.length > 5) {
                    existingIndex = finalStudents.findIndex(s => s.studentPhone === newS.studentPhone);
                }

                if (existingIndex === -1 && newS.name) {
                    // Fallback to name match if phones don't match or exist
                    existingIndex = finalStudents.findIndex(s => s.name.toLowerCase() === newS.name.toLowerCase());
                }

                if (existingIndex > -1) {
                    // Update existing
                    const existing = finalStudents[existingIndex];

                    // Check if we have new substantial info to update
                    // We update contact info, identifiers, AND attendance/homework if provided
                    finalStudents[existingIndex] = {
                        ...existing,
                        name: newS.name,
                        studentPhone: newS.studentPhone || existing.studentPhone,
                        parentPhone: newS.parentPhone || existing.parentPhone,
                        examMark: newS.examMark || existing.examMark,
                        center: newS.center || existing.center,
                        studentId: newS.studentId || existing.studentId,
                        attendanceStatus: newS.attendanceStatus || existing.attendanceStatus, // Update if new has value
                        homeworkStatus: newS.homeworkStatus || existing.homeworkStatus // Update if new has value
                    };
                    updatedCount++; // Note: This increments even if nothing effectively changed, simplified for now
                } else {
                    // Add new
                    const newStudentIndex = finalStudents.length;
                    finalStudents.push({
                        name: newS.name,
                        studentPhone: newS.studentPhone || '',
                        parentPhone: newS.parentPhone || '',
                        examMark: newS.examMark || '',
                        center: newS.center || '',
                        studentId: newS.studentId || '',
                        attendanceStatus: newS.attendanceStatus || '',
                        homeworkStatus: newS.homeworkStatus || '',
                        filterStatus: '',
                        comments: []
                    });
                    newlyAddedIndices.push(newStudentIndex);
                    addedCount++;
                }
            });

            if (addedCount === 0 && updatedCount === 0) {
                showAlert('No new or updated students found in file.', 'info');
                document.getElementById('import-file').value = ''; // Reset
                return;
            }

            // Validate that we have at least some valid students
            if (finalStudents.length === 0) {
                showAlert('No valid students to import. Please check your file format.', 'error');
                document.getElementById('import-file').value = ''; // Reset
                return;
            }

            if (!confirm(`Found ${addedCount} new students and ${updatedCount} updates. Proceed with merge?`)) {
                document.getElementById('import-file').value = ''; // Reset
                return;
            }

            // Send to backend
            // Since we need to update the FULL list essentially to handle the adds/updates properly and ensure ID consistency if backend replaces
            // However, usually backend POST appends. 
            // Strategy: We will send the whole merged list via a PUT (if exists, to replace) or just send the list to the endpoint.
            // Assumption: The backend POST /students replaces or appends? 
            // In most simplified backends for this project, it seems to accept a list.
            // Let's safe bet: Send the `students` array to the current endpoint. 
            // If the backend is smart, it handles IDs. If it replaces, we are sending everything so it's fine.
            // NOTE: Ideally we want to keep _ids of existing students. The 'finalStudents' array has objects with _ids for existing ones.
            // New ones don't have _ids. The backend SHOULD handle this (update if _id exists, create if not).

            // Let's strip _id for NEW ones just in case, but keep for existing.

            try {
                await saveStudentsList(finalStudents);
                showAlert(`Successfully merged: ${addedCount} added, ${updatedCount} updated.`);
            } catch (saveError) {
                // Error is already handled in saveStudentsList and shown to user
                throw saveError; // Re-throw to be caught by outer catch
            } finally {
                document.getElementById('import-file').value = ''; // Reset file input
            }

        } catch (error) {
            console.error('Import error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                response: error.response
            });
            
            // Show more detailed error message
            let errorMessage = 'Failed to process file';
            if (error.message) {
                errorMessage += ': ' + error.message;
            } else if (error.response && error.response.data) {
                errorMessage += ': ' + (error.response.data.message || error.response.data.error || 'Unknown error');
            }
            
            showAlert(errorMessage, 'error');
        }
    };
    reader.readAsBinaryString(file);
}

async function saveStudentsList(studentsList) {
    try {
        // Clean and format the students data before sending
        const cleanedStudents = studentsList.map(student => {
            const cleaned = {
                name: student.name || '',
                studentPhone: student.studentPhone || '',
                parentPhone: student.parentPhone || '',
                studentId: student.studentId || '',
                center: student.center || '',
                examMark: student.examMark !== undefined && student.examMark !== null && student.examMark !== '' ? student.examMark : '',
                attendanceStatus: student.attendanceStatus || '',
                homeworkStatus: student.homeworkStatus || '',
                filterStatus: student.filterStatus || '',
                adminComment: student.adminComment || ''
            };

            // Include MongoDB _id or id if it exists (for existing students)
            if (student._id) {
                cleaned._id = student._id;
            } else if (student.id) {
                cleaned.id = student.id;
            }

            return cleaned;
        });

        console.log('Sending students to backend:', {
            count: cleanedStudents.length,
            sample: cleanedStudents.slice(0, 2)
        });

        const response = await window.api.makeRequest('POST', `/activities/call-sessions/${currentSessionId}/students`, {
            students: cleanedStudents
        });

        if (response.success) {
            await loadStudents(); // Reload from server to get new IDs etc.

            // Show undo button if undo data is available
            if (response.data && response.data.undo_token) {
                showUndoButton(response.data.undo_token, response.data.undo_expires_in, response.data.backupId);
            }
        } else {
            throw new Error(response.message || 'Save failed');
        }
    } catch (error) {
        console.error('Error in saveStudentsList:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response,
            status: error.status
        });
        
        // Extract more detailed error message
        let errorMessage = 'Failed to save students';
        if (error.response) {
            // Error response from makeRequest (has response property)
            errorMessage = error.response.message || error.response.error || error.message || errorMessage;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
    }
}

// Undo Import Functionality
function showUndoButton(undoToken, expiresInMs, backupId) {
    console.log('showUndoButton called with token:', undoToken, 'expires in:', expiresInMs, 'backupId:', backupId);

    // Remove any existing undo button
    const existingUndo = document.getElementById('undo-import-btn');
    if (existingUndo) {
        existingUndo.remove();
    }

    // Generate unique IDs to avoid conflicts
    const buttonId = 'undo-import-btn';
    const timerId = 'undo-timer-' + Date.now();

    // Create undo button
    const undoBtn = document.createElement('button');
    undoBtn.id = buttonId;
    undoBtn.className = 'btn btn-sm btn-outline undo-btn';
    undoBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,12 9,6 21,18"></polyline>
            <path d="m3,12 9,6 9-6"></path>
        </svg>
        Undo Import (<span id="${timerId}">10:00</span>)
    `;

    // Insert after the import button
    const importBtn = document.getElementById('import-btn');
    if (importBtn && importBtn.parentNode) {
        importBtn.parentNode.insertBefore(undoBtn, importBtn.nextSibling);
        console.log('Undo button inserted after import button');
    } else {
        console.error('Import button not found for undo button insertion');
        return;
    }

    // Start countdown timer
    let timeLeft = Math.floor(expiresInMs / 1000);
    const timerElement = document.getElementById(timerId);

    const countdown = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(countdown);
            undoBtn.remove();
        }
    }, 1000);

    // Add click handler
    undoBtn.addEventListener('click', async () => {
        console.log('Undo button clicked, token:', undoToken, 'sessionId:', currentSessionId);

        if (!confirm('Are you sure you want to undo the last import? This will remove the recently added students.')) {
            return;
        }

        try {
            undoBtn.disabled = true;
            undoBtn.textContent = 'Undoing...';

            console.log('Making undo request to:', `/activities/call-sessions/${currentSessionId}/undo-import`);

            const response = await window.api.makeRequest('POST', `/activities/call-sessions/${currentSessionId}/undo-import`, {
                undo_token: undoToken,
                backupId: backupId
            });

            console.log('Undo response:', response);

            if (response.success) {
                const restoredCount = response.data.restored_count || 0;
                showAlert(`Successfully restored ${restoredCount} students from backup`);
                await loadStudents(); // Reload the students list
                clearInterval(countdown); // Stop the timer
                undoBtn.remove(); // Remove the button
            } else {
                throw new Error(response.message || 'Undo failed');
            }
        } catch (error) {
            console.error('Undo error:', error);
            console.error('Error details:', error.response || error);
            showAlert('Failed to undo import: ' + (error.response?.data?.message || error.message), 'error');
            undoBtn.disabled = false;
            undoBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,12 9,6 21,18"></polyline>
                    <path d="m3,12 9,6 9-6"></path>
                </svg>
                Undo Import (<span id="${timerId}">${timeLeft > 0 ? Math.floor(timeLeft / 60) + ':' + (timeLeft % 60).toString().padStart(2, '0') : '00:00'}</span>)
            `;
        }
    });
}

// Round Two Functions
async function startRoundTwo(event) {
    // Prevent default and stop propagation
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('Round two button clicked!');
    
    if (!confirm('Are you sure you want to start Round Two? This will create a new separate call session with all "no-answer" students from this session.')) {
        return;
    }

    try {
        const response = await window.api.makeRequest('POST', `/activities/call-sessions/${currentSessionId}/start-round-two`);

        if (response.success) {
            const newSessionId = response.data.new_session_id;
            const newSessionName = response.data.new_session_name;
            const studentsCount = response.data.students_count;
            
            // Show success message with option to navigate to new session
            const message = `Round Two session created successfully!\n\n${studentsCount} students imported to new session: "${newSessionName}"\n\nWould you like to open the new session?`;
            
            if (confirm(message)) {
                // Navigate to the new session's monitor page
                window.location.href = `/admin/monitor-session.html?session=${newSessionId}`;
            } else {
                showAlert(`Round Two session created! ${studentsCount} students imported. Session ID: ${newSessionId}`, 'success');
                await loadStudents(); // Reload current session data
            }
        } else {
            showAlert('Failed to start round two', 'error');
        }
    } catch (error) {
        console.error('Error starting round two:', error);
        showAlert('Error starting round two: ' + (error.message || 'Unknown error'), 'error');
    }
}

function showRoundTwoColumns() {
    document.getElementById('round-two-header').style.display = 'table-cell';
    document.getElementById('round-two-assigned-header').style.display = 'table-cell';

    // Update colspan for loading/error messages
    const tbody = document.getElementById('students-table-body');
    const loadingRow = tbody.querySelector('tr td[colspan]');
    if (loadingRow) {
        const sessionType = currentSessionData?.session_type || 'normal';
        const isMarketing = sessionType === 'marketing';
        const baseColspan = isMarketing ? 12 : 14;
        loadingRow.setAttribute('colspan', String(baseColspan + 2));
    }
}

function hideRoundTwoColumns() {
    document.getElementById('round-two-header').style.display = 'none';
    document.getElementById('round-two-assigned-header').style.display = 'none';

    // Update colspan for loading/error messages
    const tbody = document.getElementById('students-table-body');
    const loadingRow = tbody.querySelector('tr td[colspan]');
    if (loadingRow) {
        const sessionType = currentSessionData?.session_type || 'normal';
        const isMarketing = sessionType === 'marketing';
        const baseColspan = isMarketing ? 12 : 14;
        loadingRow.setAttribute('colspan', String(baseColspan));
    }
}

// Edit Modal
const studentModal = document.getElementById('student-modal');
const studentForm = document.getElementById('student-form');

// Find student by ID in currentStudents array
function findStudentById(studentId) {
    return currentStudents.find(s => (s.id && s.id.toString() === studentId.toString()) || (s._id && s._id.toString() === studentId.toString()));
}

// Find student index by ID in currentStudents array
function findStudentIndexById(studentId) {
    return currentStudents.findIndex(s => (s.id && s.id.toString() === studentId.toString()) || (s._id && s._id.toString() === studentId.toString()));
}

function openEditModal(index) {
    const student = currentStudents[index];
    if (!student) {
        console.error('Student not found at index:', index);
        showAlert('Student not found', 'error');
        return;
    }
    document.getElementById('student-index').value = index;
    document.getElementById('student-name').value = student.name;
    document.getElementById('student-phone').value = student.studentPhone || '';
    document.getElementById('parent-phone').value = student.parentPhone || '';
    document.getElementById('student-id-edit').value = student.studentId || '';
    document.getElementById('center-edit').value = student.center || '';
    document.getElementById('exam-mark-edit').value = student.examMark !== undefined && student.examMark !== null && student.examMark !== '' ? student.examMark : '';
    document.getElementById('attendance-status-edit').value = student.attendanceStatus || '';
    document.getElementById('homework-status-edit').value = student.homeworkStatus || '';
    document.getElementById('student-status').value = student.filterStatus || '';
    document.getElementById('modal-title').textContent = index === -1 ? 'Add Student' : 'Edit Student';

    studentModal.classList.add('active');
}

// Open edit modal by student ID
function openEditModalById(studentId) {
    const student = findStudentById(studentId);
    if (!student) {
        console.error('Student not found with ID:', studentId);
        showAlert('Student not found', 'error');
        return;
    }
    const index = findStudentIndexById(studentId);
    openEditModal(index);
}

function closeEditModal() {
    studentModal.classList.remove('active');
}

// Save Single Student (Add/Edit)
studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('student-index').value);

    const newName = document.getElementById('student-name').value;
    const newSPhone = document.getElementById('student-phone').value;
    const newPPhone = document.getElementById('parent-phone').value;
    const newStudentId = document.getElementById('student-id-edit').value;
    const newCenter = document.getElementById('center-edit').value;
    const newExamMark = document.getElementById('exam-mark-edit').value;
    const newAttendanceStatus = document.getElementById('attendance-status-edit').value;
    const newHomeworkStatus = document.getElementById('homework-status-edit').value;
    const newStatus = document.getElementById('student-status').value;

    if (index > -1) {
        // Edit existing
        const student = currentStudents[index];
        // We can use a specific endpoint for single student update if available, 
        // OR just updat the list locally and save ALL.
        // API usually has PUT /students/:id for status...
        // Let's try to update just this student via the API if they have an ID.

        if (student._id || student.id) {
            try {
                const sId = student._id || student.id;
                await window.api.makeRequest('PUT', `/activities/call-sessions/students/${sId}`, {
                    name: newName,
                    studentPhone: newSPhone,
                    parentPhone: newPPhone,
                    studentId: newStudentId,
                    center: newCenter,
                    examMark: newExamMark,
                    attendanceStatus: newAttendanceStatus,
                    homeworkStatus: newHomeworkStatus,
                    filterStatus: newStatus
                });
                showAlert('Student updated');
                loadStudents();
                closeEditModal();
            } catch (err) {
                console.error(err);
                showAlert('Update failed', 'error');
            }
        } else {
            // Fallback if no ID (shouldn't happen for loaded students)
            student.name = newName;
            student.studentPhone = newSPhone;
            student.parentPhone = newPPhone;
            student.studentId = newStudentId;
            student.center = newCenter;
            student.examMark = newExamMark;
            student.attendanceStatus = newAttendanceStatus;
            student.homeworkStatus = newHomeworkStatus;
            student.filterStatus = newStatus;
            await saveStudentsList(currentStudents);
            closeEditModal();
        }

    } else {
        // Add New - send only the new student to backend
        const newStudent = {
            name: newName.trim(),
            studentPhone: newSPhone.trim(),
            parentPhone: newPPhone.trim(),
            studentId: newStudentId.trim(),
            center: newCenter.trim(),
            examMark: newExamMark.trim() || null,
            attendanceStatus: newAttendanceStatus || '',
            homeworkStatus: newHomeworkStatus || '',
            filterStatus: newStatus || '',
            comments: []
        };

        // Validate required fields
        if (!newStudent.name) {
            showAlert('Student name is required', 'error');
            return;
        }

        try {
            // Send only the new student to the backend
            const response = await window.api.makeRequest('POST', `/activities/call-sessions/${currentSessionId}/students`, {
                students: [newStudent] // Send as array with single student
            });

            if (response.success) {
                showAlert('Student added successfully');
                await loadStudents(); // Reload to get the new student with ID
                closeEditModal();
            } else {
                throw new Error(response.message || 'Failed to add student');
            }
        } catch (error) {
            console.error('Error adding student:', error);
            showAlert('Failed to add student: ' + (error.message || 'Unknown error'), 'error');
        }
    }
});

// Delete Student by ID
async function deleteStudentById(studentId) {
    const student = findStudentById(studentId);
    if (!student) {
        console.error('Student not found with ID:', studentId);
        showAlert('Student not found', 'error');
        return;
    }
    await deleteStudent(student);
}

// Delete Student (internal function)
async function deleteStudent(student) {
    if (!confirm(`Remove "${student.name}" from the session?`)) return;

    console.log('Student to delete:', student);
    console.log('Student ID fields:', { _id: student._id, id: student.id });

    // If has ID, call DELETE endpoint if exists, or update list.
    // Likely DELETE /activities/call-sessions/students/:id ? Or generic list update.
    // I'll try to remove from list and save list (the 'replace' mode I hope for).

    // Actually, `call-sessions.js` shows PUT to students...
    // Let's assume I need to edit the backend to support 'replace' encoded in POST/PUT
    // OR create a delete endpoint.

    // For now, let's try the "Update List" strategy effectively.
    // BUT, the backend might only support ADDING.
    // I will implementation a DELETE call assuming standard REST: DELETE .../students/:id

    if (student._id || student.id) {
        const sId = student._id || student.id;
        console.log('Student to delete:', student);
        console.log('Student ID:', sId);
        console.log('Making DELETE request to:', `/activities/call-sessions/students/${sId}`);

        try {
            const res = await window.api.makeRequest('DELETE', `/activities/call-sessions/students/${sId}`);
            console.log('DELETE response:', res);
            if (res.success) {
                showAlert('Student removed');
                loadStudents();
            } else {
                console.warn('DELETE failed with response:', res);
                showAlert('Failed to remove: ' + res.message, 'error');
            }
        } catch (err) {
            console.error('DELETE error:', err);

            // Show detailed error message
            let errorMsg = 'Failed to remove student';
            if (err.message.includes('fetch')) {
                errorMsg += ': Network error (check server connection)';
            } else if (err.message.includes('401')) {
                errorMsg += ': Authentication required';
            } else if (err.message.includes('403')) {
                errorMsg += ': Access denied';
            } else if (err.message.includes('404')) {
                errorMsg += ': Student not found';
            } else {
                errorMsg += ': ' + err.message;
            }
            showAlert(errorMsg, 'error');
        }
    } else {
        console.error('Student has no _id or id field:', student);
        showAlert('Cannot delete student: missing ID', 'error');
    }
}


// Export Students
function exportStudents() {
    if (!currentStudents || currentStudents.length === 0) {
        showAlert('No students to export', 'warning');
        return;
    }

    try {
        // Map data for export
        const exportData = currentStudents.map(s => {
            const lastComment = s.comments && s.comments.length > 0
                ? s.comments[s.comments.length - 1].text
                : '';

            return {
                'Name': s.name,
                'Student ID': s.studentId || '',
                'Student Phone': s.studentPhone,
                'Parent Phone': s.parentPhone,
                'Center': s.center || '',
                'Exam Mark': s.examMark !== undefined && s.examMark !== null && s.examMark !== '' ? s.examMark : '',
                'Attendance Status': s.attendanceStatus || '',
                'Homework Status': s.homeworkStatus || '',
                'Status': formatFilterStatus(s.filterStatus),
                'Last Called By': s.lastCalledBy || '',
                'Assigned To': s.assignedTo || '',
                'Last Comment': lastComment
            };
        });

        // Create workbook
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");

        // Filename
        const sessionName = currentSessionData ? currentSessionData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'session';
        const date = new Date().toISOString().split('T')[0];
        const filename = `${sessionName}_${date}.xlsx`;

        // Save
        XLSX.writeFile(wb, filename);
        showAlert('Export started');

    } catch (error) {
        console.error('Export error:', error);
        showAlert('Failed to export students', 'error');
    }
}

// Populate dynamic filters (Assistants, Centers)
function populateFilters() {
    const assistantsSet = new Set();
    const centersSet = new Set();

    currentStudents.forEach(s => {
        if (s.lastCalledBy) assistantsSet.add(s.lastCalledBy);
        if (s.assignedTo) assistantsSet.add(s.assignedTo);
        if (s.center) centersSet.add(s.center);
    });

    // Populate Assistant Filter
    const assistantSelect = document.getElementById('filter-assistant');
    // Keep first option (All)
    const currentAssistant = assistantSelect.value;
    assistantSelect.innerHTML = '<option value="">All Assistants</option>';

    Array.from(assistantsSet).sort().forEach(a => {
        const option = document.createElement('option');
        option.value = a;
        option.textContent = a;
        assistantSelect.appendChild(option);
    });
    assistantSelect.value = currentAssistant; // Restore selection

    // Populate Center Filter
    const centerSelect = document.getElementById('filter-center');
    const currentCenter = centerSelect.value;
    centerSelect.innerHTML = '<option value="">All Centers</option>';

    Array.from(centersSet).sort().forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        centerSelect.appendChild(option);
    });
    centerSelect.value = currentCenter; // Restore selection
}

// Helper: Get Student Priority for Sorting
function getStudentPriority(student) {
    // 1. Absent (Top Priority - 0)
    const attendance = (student.attendanceStatus || '').toLowerCase();
    if (attendance.includes('absent')) return 0;

    // From here on, we assume Present (or at least not Absent)
    // 2. Exam Mark 1-3 (Priority 1)
    const mark = parseFloat(student.examMark);
    if (!isNaN(mark) && mark >= 1 && mark <= 3) return 1;

    // 3. Homework Checks
    const hw = (student.homeworkStatus || '').toLowerCase().trim();

    // Priority 2: Not Done / No
    if (hw.includes('not done') || hw === 'no') return 2;

    // Priority 3: Not Evaluated / Pending
    if (hw.includes('not evaluated') || hw.includes('pending')) return 3;

    // Priority 4: Not Complete / Incomplete
    if (hw.includes('not complete') || hw.includes('incomplete')) return 4;

    // Priority 5: Empty / No Data
    if (hw === '') return 5;

    // 4. Default / Rest (Priority 10)
    return 10;
}

// Apply Filters
function applyFilters() {
    const searchTerm = document.getElementById('filter-search').value.toLowerCase();
    const assistantFilter = document.getElementById('filter-assistant').value;
    const statusFilter = document.getElementById('filter-status').value;
    const attendanceFilter = document.getElementById('filter-attendance').value;
    const homeworkFilter = document.getElementById('filter-homework').value;
    const centerFilter = document.getElementById('filter-center').value;
    const examMarkFilter = document.getElementById('filter-exam-mark').value.toLowerCase();

    const filteredStudents = currentStudents.filter(s => {
        // Search (Name/Phone)
        if (searchTerm) {
            const name = (s.name || '').toLowerCase();
            const sPhone = (s.studentPhone || '').toLowerCase();
            const pPhone = (s.parentPhone || '').toLowerCase();
            if (!name.includes(searchTerm) && !sPhone.includes(searchTerm) && !pPhone.includes(searchTerm)) {
                return false;
            }
        }

        // Assistant
        if (assistantFilter) {
            const calledBy = s.lastCalledBy || '';
            const assignedTo = s.assignedTo || '';
            if (calledBy !== assistantFilter && assignedTo !== assistantFilter) {
                return false;
            }
        }

        // Status
        if (statusFilter) {
            const status = (s.filterStatus || 'pending').toLowerCase();
            if (status !== statusFilter) return false;
        }

        // Attendance
        if (attendanceFilter) {
            const att = (s.attendanceStatus || '').toLowerCase();
            if (!att.includes(attendanceFilter)) return false;
        }

        // Homework
        if (homeworkFilter) {
            const hw = (s.homeworkStatus || '').toLowerCase().trim();
            if (homeworkFilter === 'done') {
                if (!hw.includes('done') && !hw.includes('completed') && hw !== 'yes') return false;
            } else if (homeworkFilter === 'not evaluated') {
                if (!hw.includes('not evaluated') && !hw.includes('pending')) return false;
            } else if (homeworkFilter === 'not complete') {
                if (!hw.includes('not complete') && !hw.includes('incomplete') && hw !== 'no') return false;
            } else if (homeworkFilter === 'empty') {
                if (hw !== '') return false;
            }
        }

        // Center
        if (centerFilter) {
            if (s.center !== centerFilter) return false;
        }

        // Exam Mark
        if (examMarkFilter) {
            const mark = String(s.examMark || '').toLowerCase();
            if (!mark.includes(examMarkFilter)) return false;
        }

        return true;
    });


    // Sort logic
    filteredStudents.sort((a, b) => {
        const pA = getStudentPriority(a);
        const pB = getStudentPriority(b);
        return pA - pB;
    });

    renderStudentsTable(filteredStudents);
}

// Setup Listeners
function setupEventListeners() {
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    
    if (importBtn && importFile) {
        // Ensure button is enabled and clickable
        importBtn.disabled = false;
        importBtn.style.pointerEvents = 'auto';
        importBtn.style.cursor = 'pointer';
        
        importBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Import button clicked');
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                console.log('File selected:', e.target.files[0].name);
                handleImport(e.target.files[0]);
            }
        });
    } else {
        console.error('Import button or file input not found when setting up event listener');
    }

    document.getElementById('export-btn').addEventListener('click', exportStudents);

    const roundTwoBtn = document.getElementById('round-two-btn');
    if (roundTwoBtn) {
        roundTwoBtn.addEventListener('click', startRoundTwo);
        // Ensure button is always enabled and clickable
        roundTwoBtn.disabled = false;
        roundTwoBtn.style.pointerEvents = 'auto';
        roundTwoBtn.style.cursor = 'pointer';
    } else {
        console.error('Round two button not found when setting up event listener');
    }

    // Filter Listeners
    const filterInputs = [
        'filter-search', 'filter-assistant', 'filter-status',
        'filter-attendance', 'filter-homework', 'filter-center', 'filter-exam-mark'
    ];

    filterInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', applyFilters);
        document.getElementById(id).addEventListener('change', applyFilters);
    });

    document.getElementById('add-student-btn').addEventListener('click', () => {
        document.getElementById('student-index').value = -1;
        document.getElementById('student-form').reset();
        // Explicitly clear all fields to ensure clean state
        document.getElementById('student-name').value = '';
        document.getElementById('student-phone').value = '';
        document.getElementById('parent-phone').value = '';
        document.getElementById('student-id-edit').value = '';
        document.getElementById('center-edit').value = '';
        document.getElementById('exam-mark-edit').value = '';
        document.getElementById('attendance-status-edit').value = '';
        document.getElementById('homework-status-edit').value = '';
        document.getElementById('student-status').value = '';
        document.getElementById('modal-title').textContent = 'Add Student';
        studentModal.classList.add('active');
    });

    document.getElementById('close-student-modal').addEventListener('click', closeEditModal);
    document.getElementById('cancel-student-btn').addEventListener('click', closeEditModal);
    studentModal.addEventListener('click', (e) => { if (e.target === studentModal) closeEditModal(); });
}

// Init
init();
