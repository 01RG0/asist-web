// Merge Files JavaScript

// Check authentication
const user = window.api.getUser();
if (!window.api.isAuthenticated() || !user || user.role !== 'admin') {
    window.location.href = 'index.html';
}

// Global state
let absentStudents = [];
let attendanceStudents = [];
let mergedData = [];

// Alert function
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    alertContainer.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Parse Excel/CSV file
function parseFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                // Normalize data
                const normalizedData = jsonData.map(row => {
                    const normRow = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                        const val = row[key];
                        if (!val && val !== 0) return;

                        // Name
                        if (['name', 'studentname', 'student'].includes(cleanKey)) normRow.name = val;
                        // Phone
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
                        // Optional fields
                        else if (['exammark', 'mark', 'score', 'degree', 'grade', 'exam'].includes(cleanKey)) normRow.examMark = val;
                        else if (['center', 'location', 'branch', 'group'].includes(cleanKey)) normRow.center = val;
                        else if (['studentid', 'id', 'code', 'studentcode'].includes(cleanKey)) normRow.studentId = val;
                        // Homework
                        else if (['homeworkstatus', 'homework', 'hw', 'hwstatus', 'assignment', 'assignmentstatus'].includes(cleanKey)) normRow.homeworkStatus = val;
                    });
                    return normRow.name ? normRow : null;
                }).filter(r => r !== null);

                resolve(normalizedData);
            } catch (error) {
                console.error('Parse error:', error);
                reject(new Error('Failed to parse file. Please check the format.'));
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
}

// Handle file uploads
document.getElementById('absent-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        absentStudents = await parseFile(file);

        const box = document.getElementById('absent-box');
        const info = document.getElementById('absent-info');

        box.classList.add('has-file');
        info.style.display = 'block';
        info.innerHTML = `
            <strong>${file.name}</strong><br>
            ${absentStudents.length} students found
        `;

        checkMergeReady();
        showAlert(`Loaded ${absentStudents.length} absent students`);
    } catch (error) {
        console.error('Error loading absent file:', error);
        showAlert('Failed to load absent file: ' + error.message, 'error');
    }
});

document.getElementById('attendance-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        attendanceStudents = await parseFile(file);

        const box = document.getElementById('attendance-box');
        const info = document.getElementById('attendance-info');

        box.classList.add('has-file');
        info.style.display = 'block';
        info.innerHTML = `
            <strong>${file.name}</strong><br>
            ${attendanceStudents.length} students found
        `;

        checkMergeReady();
        showAlert(`Loaded ${attendanceStudents.length} attending students`);
    } catch (error) {
        console.error('Error loading attendance file:', error);
        showAlert('Failed to load attendance file: ' + error.message, 'error');
    }
});

// Check if ready to merge
function checkMergeReady() {
    const mergeBtn = document.getElementById('merge-btn');
    if (absentStudents.length > 0 && attendanceStudents.length > 0) {
        mergeBtn.disabled = false;
    } else {
        mergeBtn.disabled = true;
    }
}

// Merge files
document.getElementById('merge-btn').addEventListener('click', () => {
    if (absentStudents.length === 0 || attendanceStudents.length === 0) {
        showAlert('Please upload both files first', 'error');
        return;
    }

    // Create merged data: Absent students first, then attendance students
    mergedData = [];

    // Add absent students with status
    absentStudents.forEach(student => {
        mergedData.push({
            ...student,
            attendanceStatus: 'Absent'
        });
    });

    // Add attendance students with status
    attendanceStudents.forEach(student => {
        mergedData.push({
            ...student,
            attendanceStatus: 'Present'
        });
    });

    // Update stats
    document.getElementById('stat-absent').textContent = absentStudents.length;
    document.getElementById('stat-present').textContent = attendanceStudents.length;
    document.getElementById('stat-total').textContent = mergedData.length;

    // Show preview
    renderPreview();
    document.getElementById('preview-section').style.display = 'block';

    showAlert(`Successfully merged ${mergedData.length} students!`);
});

// Render preview table
function renderPreview() {
    const thead = document.getElementById('preview-thead');
    const tbody = document.getElementById('preview-tbody');

    // Get all possible columns
    const columns = ['name', 'studentId', 'studentPhone', 'parentPhone', 'center', 'examMark', 'attendanceStatus', 'homeworkStatus'];
    const columnLabels = {
        name: 'Name',
        studentId: 'Student ID',
        studentPhone: 'Student Phone',
        parentPhone: 'Parent Phone',
        center: 'Center',
        examMark: 'Exam Mark',
        attendanceStatus: 'Attendance Status',
        homeworkStatus: 'Homework Status'
    };

    // Build header
    thead.innerHTML = `
        <tr>
            ${columns.map(col => `<th>${columnLabels[col]}</th>`).join('')}
        </tr>
    `;

    // Build body (first 10 rows)
    const previewData = mergedData.slice(0, 10);
    tbody.innerHTML = previewData.map(student => `
        <tr>
            ${columns.map(col => {
        const value = student[col] || '-';
        if (col === 'attendanceStatus') {
            const color = value === 'Absent' ? '#ef4444' : '#10b981';
            return `<td><span style="color: ${color}; font-weight: 600;">${value}</span></td>`;
        }
        if (col === 'homeworkStatus') {
            let color = 'var(--text-primary)';
            const s = String(value).toLowerCase();
            if (s.includes('done') || s.includes('completed') || s === 'yes') color = '#10b981';
            else if (s.includes('not') || s.includes('incomplete') || s === 'no') color = '#ef4444';
            else if (s.includes('eval') || s.includes('pending')) color = '#f59e0b';

            return `<td><span style="color: ${color}; font-weight: 600;">${value}</span></td>`;
        }
        return `<td>${value}</td>`;
    }).join('')}
        </tr>
    `).join('');
}

// Download merged file
document.getElementById('download-btn').addEventListener('click', () => {
    if (mergedData.length === 0) {
        showAlert('No data to download', 'error');
        return;
    }

    try {
        // Prepare export data
        const exportData = mergedData.map(s => ({
            'Name': s.name,
            'Student ID': s.studentId || '',
            'Student Phone': s.studentPhone || '',
            'Parent Phone': s.parentPhone || '',
            'Center': s.center || '',
            'Exam Mark': s.examMark !== undefined && s.examMark !== null && s.examMark !== '' ? s.examMark : '',
            'Attendance Status': s.attendanceStatus,
            'Homework Status': s.homeworkStatus || ''
        }));

        // Create workbook
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Merged Students");

        // Filename
        const date = new Date().toISOString().split('T')[0];
        const filename = `merged_students_${date}.xlsx`;

        // Save
        XLSX.writeFile(wb, filename);
        showAlert('File downloaded successfully!');
    } catch (error) {
        console.error('Download error:', error);
        showAlert('Failed to download file', 'error');
    }
});

// Upload to call session (redirect to call-sessions page with data)
document.getElementById('upload-to-session-btn').addEventListener('click', () => {
    if (mergedData.length === 0) {
        showAlert('No data to upload', 'error');
        return;
    }

    // Store merged data in sessionStorage for use in call-sessions page
    sessionStorage.setItem('mergedStudentsData', JSON.stringify(mergedData));

    // Redirect to call sessions page
    window.location.href = 'call-sessions.html?autoCreate=true';
});
