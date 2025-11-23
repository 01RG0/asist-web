// Check if already logged in
if (window.api.isAuthenticated()) {
    window.location.href = '/assistant/sessions.html';
}

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const alertContainer = document.getElementById('alert-container');

// Show alert message
function showAlert(message, type = 'error') {
    const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
    alertContainer.innerHTML = `
    <div class="alert ${alertClass}">
      ${message}
    </div>
  `;
}

// Clear alert
function clearAlert() {
    alertContainer.innerHTML = '';
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Disable button and show spinner
    loginBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
        const response = await window.api.makeRequest('POST', '/auth/login', {
            email,
            password
        });

        if (response.success) {
            // Save token and user data
            window.api.saveToken(response.data.token);
            window.api.saveRefreshToken(response.data.refreshToken);
            window.api.saveUser(response.data.user);

            // Redirect to sessions page
            window.location.href = '/assistant/sessions.html';
        }
    } catch (error) {
        showAlert(error.message || 'Login failed. Please check your credentials.');

        // Re-enable button
        loginBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
});
