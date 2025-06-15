document.addEventListener('DOMContentLoaded', () => {
    // Form elements
    const loginForm = document.getElementById('login');
    const registerForm = document.getElementById('register');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const deleteAccountForm = document.getElementById('deleteAccountForm');
    const verificationCodeSection = document.getElementById('verificationCodeSection');
    const newPasswordSection = document.getElementById('newPasswordSection');

    // Button elements
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const sendCodeBtn = document.getElementById('sendCodeBtn');

    // Show/Hide form functions
    const showForm = (formToShow, ...formsToHide) => {
        formToShow.classList.remove('hidden');
        formsToHide.forEach(form => form.classList.add('hidden'));
    };

    // Event Listeners for form switching
    showLoginBtn.addEventListener('click', () => {
        showLoginBtn.classList.add('text-blue-600', 'border-blue-600');
        showRegisterBtn.classList.remove('text-blue-600', 'border-blue-600');
        showForm(loginForm, registerForm, resetPasswordForm, deleteAccountForm);
    });

    showRegisterBtn.addEventListener('click', () => {
        showRegisterBtn.classList.add('text-blue-600', 'border-blue-600');
        showLoginBtn.classList.remove('text-blue-600', 'border-blue-600');
        showForm(registerForm, loginForm, resetPasswordForm, deleteAccountForm);
    });

    forgotPasswordBtn.addEventListener('click', () => {
        showForm(resetPasswordForm, loginForm, registerForm, deleteAccountForm);
        verificationCodeSection.classList.add('hidden');
        newPasswordSection.classList.add('hidden');
    });

    deleteAccountBtn.addEventListener('click', () => {
        showForm(deleteAccountForm, loginForm, registerForm, resetPasswordForm);
    });

    backToLoginBtn.addEventListener('click', () => {
        showForm(loginForm, resetPasswordForm, registerForm, deleteAccountForm);
    });

    cancelDeleteBtn.addEventListener('click', () => {
        showForm(loginForm, deleteAccountForm, registerForm, resetPasswordForm);
    });

    // Store email for password reset flow
    let resetEmail = '';

    // Handle password reset flow
    sendCodeBtn.addEventListener('click', async () => {
        const email = document.getElementById('resetEmail').value;
        resetEmail = email; // Store email for later use
        
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                verificationCodeSection.classList.remove('hidden');
                sendCodeBtn.disabled = true;
                sendCodeBtn.classList.add('opacity-50');
                sendCodeBtn.textContent = 'Đã gửi';
                setTimeout(() => {
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.classList.remove('opacity-50');
                    sendCodeBtn.textContent = 'Gửi lại';
                }, 60000); // Enable resend after 1 minute
            } else {
                const data = await response.json();
                alert(data.message || 'Không thể gửi mã xác nhận');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Handle password reset form submission
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('verificationCode').value;
        const newPassword = document.getElementById('newPassword').value;

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: code,
                    newPassword,
                    email: resetEmail
                })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Đặt lại mật khẩu thành công');
                showForm(loginForm, resetPasswordForm);
                // Reset form
                resetPasswordForm.reset();
                verificationCodeSection.classList.add('hidden');
                newPasswordSection.classList.add('hidden');
                resetEmail = '';
            } else {
                alert(data.message || 'Không thể đặt lại mật khẩu');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Handle delete account form submission
    deleteAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('deleteAccountPassword').value;

        if (!confirm('Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác.')) {
            return;
        }

        try {
            const response = await fetch('/api/auth/delete-account', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Tài khoản đã được xóa thành công');
                localStorage.removeItem('token');
                window.location.reload();
            } else {
                alert(data.message || 'Không thể xóa tài khoản');
            }
        } catch (error) {
            alert('Lỗi kết nối: ' + error.message);
        }
    });

    // Handle verification code entry
    document.getElementById('verificationCode').addEventListener('input', (e) => {
        if (e.target.value.length === 6) { // Assuming 6-digit code
            newPasswordSection.classList.remove('hidden');
        }
    });
});
