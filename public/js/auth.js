/**
 * AuraCare Medical Center - Frontend Auth Client & Route Guard
 */
const Auth = (() => {
  const ROLE_DASHBOARDS = {
    super_admin: '/admin/dashboard',
    hospital_admin: '/admin/dashboard',
    doctor: '/doctor/dashboard',
    receptionist: '/reception/dashboard',
    nurse: '/nurse/dashboard',
    lab_technician: '/lab/dashboard',
    pharmacist: '/pharmacy/dashboard',
    accountant: '/billing/dashboard',
    patient: '/patient/dashboard'
  };

  function getUser() {
    try {
      const userStr = localStorage.getItem('auth_user') || localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  function setUser(user) {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('user');
    }
  }

  function getToken() {
    if (typeof API !== 'undefined' && typeof API.getToken === 'function') {
      return API.getToken();
    }
    try {
      return localStorage.getItem('auth_token') || localStorage.getItem('token');
    } catch {
      return null;
    }
  }

  function isAuthenticated() {
    const token = getToken();
    const user = getUser();
    return Boolean(token && user);
  }

  function getDashboardUrl(role) {
    return ROLE_DASHBOARDS[role] || '/patient/dashboard';
  }

  async function login(email, password) {
    const res = await API.post('/auth/login', { email, password });
    if (res.success && res.data) {
      API.setToken(res.data.token);
      setUser(res.data.user);
      updatePublicHeaderNav();
      return res.data.user;
    }
    throw new Error(res.message || 'Login failed.');
  }

  async function register(userData) {
    const res = await API.post('/auth/register', userData);
    if (res.success && res.data) {
      API.setToken(res.data.token);
      setUser(res.data.user);
      updatePublicHeaderNav();
      return res.data.user;
    }
    throw new Error(res.message || 'Registration failed.');
  }

  function logout(redirect = true) {
    // 1. Immediately purge all local authentication credentials and storage
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('jwt');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('cachedUser');
      localStorage.setItem('auth_logout_time', Date.now().toString());
      sessionStorage.clear();
      document.cookie = 'token=; Max-Age=0; path=/;';
      document.cookie = 'auth_token=; Max-Age=0; path=/;';
      document.cookie = 'jwt=; Max-Age=0; path=/;';
    } catch (_) {}

    // 2. Fire backend notification without blocking
    try {
      fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (_) {}

    // 3. Update public header immediately if on page
    updatePublicHeaderNav();

    // 4. Direct, instant navigation
    if (redirect) {
      // If currently on a portal page or admin/doctor/patient area, navigate to homepage
      window.location.href = '/?logged_out=1';
    }
  }

  async function fetchProfile() {
    try {
      const res = await API.get('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn('[AUTH] Session validation failed:', err.message);
      if (err.statusCode === 401) {
        logout(true);
      }
    }
    return null;
  }

  async function guardPage(allowedRoles = []) {
    const user = getUser();
    const token = getToken();

    if (!token || !user) {
      logout(false);
      const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/pages/login.html?redirect=${currentPath}&session_expired=1`;
      return false;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert(`Unauthorized Access. Your role (${user.roleDisplayName || user.role}) is not permitted to access this area.`);
      window.location.href = getDashboardUrl(user.role);
      return false;
    }

    updateDashboardHeader(user);
    return true;
  }

  function updateDashboardHeader(user) {
    const nameEl = document.querySelectorAll('[data-user-name]');
    const roleEl = document.querySelectorAll('[data-user-role]');
    const emailEl = document.querySelectorAll('[data-user-email]');
    const avatarEl = document.querySelectorAll('[data-user-avatar]');
    const roleBadgeEl = document.querySelectorAll('[data-user-role-badge]');

    nameEl.forEach(el => el.textContent = user.fullName || 'Staff User');
    roleEl.forEach(el => el.textContent = user.roleDisplayName || user.role);
    emailEl.forEach(el => el.textContent = user.email || '');
    avatarEl.forEach(el => {
      if (user.avatarUrl) el.src = user.avatarUrl;
    });
    roleBadgeEl.forEach(el => {
      el.textContent = user.roleDisplayName || user.role;
    });
  }

  // Master Global Delegated Listener: Clicking any logout button / link signs out immediately
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('[data-action-logout], .btn-logout, #btn-logout, a[href="#logout"], a[href="/logout"], button[data-logout]');
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      logout(true);
    }
  });

  // Cross-tab synchronization
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'auth_token' || e.key === 'auth_user' || e.key === 'auth_logout_time') {
        updatePublicHeaderNav();
      }
    });
  }

  function updatePublicHeaderNav() {
    const authActionsContainer = document.getElementById('header-auth-actions');
    const mobileAuthContainer = document.getElementById('mobile-nav-auth');
    const user = getUser();
    const token = getToken();
    const isAuth = Boolean(user && token);

    if (authActionsContainer) {
      if (isAuth && user) {
        const shortRole = user.role === 'super_admin' ? 'Admin' :
                          user.role === 'hospital_admin' ? 'Admin' :
                          user.role === 'doctor' ? 'Doctor' :
                          user.role === 'patient' ? 'Patient' :
                          user.role === 'receptionist' ? 'Reception' :
                          user.role === 'nurse' ? 'Nurse' :
                          user.role === 'lab_technician' ? 'Lab' :
                          user.role === 'pharmacist' ? 'Pharmacy' :
                          user.role === 'accountant' ? 'Billing' : 'Dashboard';
        const dashboardUrl = getDashboardUrl(user.role);
        authActionsContainer.innerHTML = `
          <a href="${dashboardUrl}" class="btn btn-primary btn-sm" title="Logged in as ${user.fullName} (${user.roleDisplayName || user.role})">
            <i class="fa-solid fa-gauge"></i> <span>${shortRole} Hub</span>
          </a>
          <button class="btn btn-outline-danger btn-sm" data-action-logout title="Sign Out">
            <i class="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
          </button>
        `;
      } else {
        authActionsContainer.innerHTML = `
          <button class="btn btn-outline-primary btn-sm" data-modal-target="modal-login">
            <i class="fa-solid fa-user-lock"></i> <span>Sign In</span>
          </button>
          <a href="/appointments" class="btn btn-primary btn-sm">
            <i class="fa-regular fa-calendar-check"></i> <span>Book Visit</span>
          </a>
        `;
      }
    }

    if (mobileAuthContainer) {
      if (isAuth && user) {
        const shortRole = user.role === 'super_admin' ? 'Admin' :
                          user.role === 'hospital_admin' ? 'Admin' :
                          user.role === 'doctor' ? 'Doctor' :
                          user.role === 'patient' ? 'Patient' :
                          user.role === 'receptionist' ? 'Reception' :
                          user.role === 'nurse' ? 'Nurse' :
                          user.role === 'lab_technician' ? 'Lab' :
                          user.role === 'pharmacist' ? 'Pharmacy' :
                          user.role === 'accountant' ? 'Billing' : 'Dashboard';
        const dashboardUrl = getDashboardUrl(user.role);
        mobileAuthContainer.innerHTML = `
          <div style="padding: 6px 12px; background: var(--color-slate-100); border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600; color: var(--color-navy-900); margin-bottom: 8px; text-align: center;">
            <i class="fa-solid fa-user-check" style="color: var(--color-success);"></i> ${user.fullName} (${user.roleDisplayName || user.role})
          </div>
          <a href="${dashboardUrl}" class="btn btn-primary btn-block mb-2">
            <i class="fa-solid fa-gauge"></i> Go to ${shortRole} Hub
          </a>
          <button class="btn btn-outline-danger btn-block" data-action-logout>
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        `;
      } else {
        mobileAuthContainer.innerHTML = `
          <button class="btn btn-outline-primary btn-block mb-2" data-modal-target="modal-login">
            <i class="fa-solid fa-user-lock"></i> Staff / Patient Sign In
          </button>
          <a href="/appointments" class="btn btn-primary btn-block">
            <i class="fa-regular fa-calendar-check"></i> Request Consultation
          </a>
        `;
      }
    }
  }

  function initLoginModal() {
    const form = document.getElementById('form-modal-login');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-modal-login-submit');
      const originalText = submitBtn.innerHTML;

      const email = form.email.value.trim();
      const password = form.password.value;
      const alertBox = document.getElementById('modal-auth-alert-box');

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
        if (alertBox) alertBox.classList.add('hidden');

        const user = await login(email, password);
        Toast.success(`Welcome back, ${user.fullName}!`);
        Modal.close('modal-login');

        const urlParams = new URLSearchParams(window.location.search);
        const redirectTarget = urlParams.get('redirect') || getDashboardUrl(user.role);

        setTimeout(() => {
          window.location.href = redirectTarget;
        }, 400);
      } catch (err) {
        if (alertBox) {
          alertBox.classList.remove('hidden');
          alertBox.style.background = 'var(--color-danger-light)';
          alertBox.style.color = 'var(--color-danger-hover)';
          alertBox.style.border = '1px solid var(--color-danger-border)';
          alertBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Invalid email or password.'}`;
        }
        Toast.error(err.message || 'Login failed.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    updatePublicHeaderNav();
    initLoginModal();
  });

  return {
    getUser,
    setUser,
    isAuthenticated,
    getDashboardUrl,
    login,
    register,
    logout,
    fetchProfile,
    guardPage,
    updatePublicHeaderNav,
    initLoginModal
  };
})();

// Global Helper: Toggle Password Visibility Eye Icon
window.togglePasswordVisibility = function(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  if (btnEl) {
    btnEl.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    btnEl.title = isPassword ? 'Hide password' : 'Show password';
  }
};

function triggerFillEffect(input) {
  if (!input) return;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  input.style.borderColor = 'var(--color-primary)';
  input.style.backgroundColor = 'var(--color-primary-light)';
  input.style.boxShadow = '0 0 0 3px var(--color-primary-border)';
  setTimeout(() => {
    input.style.borderColor = '';
    input.style.backgroundColor = '';
    input.style.boxShadow = '';
  }, 700);
}

// Master Universal Autofill Helper for Demo Role Credentials
function fillDemoCredentials(email, btnEl, password = 'Clinic2026!') {
  if (!email) return;

  // 1. Locate container context if clicked inside a modal or card
  const container = btnEl ? btnEl.closest('.modal-dialog, .modal, .card, form, body') : document;

  // 2. Find Email Input with multi-strategy resolution
  const emailInput = document.getElementById('modal-login-email') ||
                     document.getElementById('login-email') ||
                     (container && container.querySelector('input[type="email"], input[name="email"], #email')) ||
                     document.querySelector('#modal-login input[type="email"], #form-login input[type="email"], input[type="email"], input[name="email"]');

  // 3. Find Password Input with multi-strategy resolution
  const passwordInput = document.getElementById('modal-login-password') ||
                        document.getElementById('login-password') ||
                        (container && container.querySelector('input[type="password"], input[name="password"], #password')) ||
                        document.querySelector('#modal-login input[type="password"], #form-login input[type="password"], input[type="password"], input[name="password"]');

  if (emailInput) {
    emailInput.value = email;
    triggerFillEffect(emailInput);
  }

  if (passwordInput) {
    passwordInput.value = password;
    triggerFillEffect(passwordInput);
  }

  // 4. Highlight the active role pill button
  const pillContainer = (btnEl && typeof btnEl.closest === 'function') ? btnEl.closest('.role-pills-grid, .modal-body, .card-body, body') : document;
  if (pillContainer && typeof pillContainer.querySelectorAll === 'function') {
    pillContainer.querySelectorAll('.role-pill-btn').forEach(b => {
      if (b.classList && typeof b.classList.remove === 'function') b.classList.remove('is-active');
    });
  } else if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    document.querySelectorAll('.role-pill-btn').forEach(b => {
      if (b.classList && typeof b.classList.remove === 'function') b.classList.remove('is-active');
    });
  }
  if (btnEl && btnEl.classList && typeof btnEl.classList.add === 'function') {
    btnEl.classList.add('is-active');
  }

  // 5. Safe User Feedback
  if (typeof Toast !== 'undefined' && typeof Toast.success === 'function') {
    Toast.success(`Autofilled: ${email} | Password: ${password}`);
  }
}

// Expose globally for both inline onclick handlers and programmatic calls
window.fillModalCredentials = fillDemoCredentials;
window.fillCredentials = fillDemoCredentials;
window.fillDemoCredentials = fillDemoCredentials;

// Global Event Delegation for all demo role pills across the application
document.addEventListener('click', (e) => {
  const demoBtn = e.target.closest('[data-demo-email], .role-pill-btn');
  if (demoBtn) {
    let email = demoBtn.getAttribute('data-demo-email');
    if (!email) {
      const onclickAttr = demoBtn.getAttribute('onclick');
      if (onclickAttr) {
        const match = onclickAttr.match(/['"]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})['"]/);
        if (match) email = match[1];
      }
    }
    if (email) {
      e.preventDefault();
      fillDemoCredentials(email, demoBtn);
    }
  }
});
