const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const adminDir = path.join(publicDir, 'admin');
if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true });

function getAdminSidebar(activePage) {
  const links = [
    { key: 'dashboard', href: '/admin/dashboard', icon: 'fa-chart-pie', label: 'Executive Overview' },
    { key: 'users', href: '/admin/users', icon: 'fa-users-gear', label: 'Users Directory' },
    { key: 'roles', href: '/admin/roles', icon: 'fa-user-shield', label: 'Roles & Permissions' },
    { key: 'patients', href: '/admin/patients', icon: 'fa-hospital-user', label: 'Patients Directory' },
    { key: 'doctors', href: '/admin/doctors', icon: 'fa-user-doctor', label: 'Doctors & Faculty' },
    { key: 'departments', href: '/admin/departments', icon: 'fa-building-shield', label: 'Clinical Divisions' },
    { key: 'appointments', href: '/admin/appointments', icon: 'fa-calendar-check', label: 'Appointments' },
    { key: 'opd', href: '/admin/opd', icon: 'fa-stethoscope', label: 'OPD Queue' },
    { key: 'ipd', href: '/admin/ipd', icon: 'fa-bed-pulse', label: 'Inpatient & Wards' },
    { key: 'laboratory', href: '/admin/laboratory', icon: 'fa-vial-virus', label: 'Lab & Pathology' },
    { key: 'radiology', href: '/admin/radiology', icon: 'fa-x-ray', label: 'Radiology Imaging' },
    { key: 'pharmacy', href: '/admin/pharmacy', icon: 'fa-pills', label: 'Pharmacy & Stock' },
    { key: 'billing', href: '/admin/billing', icon: 'fa-file-invoice-dollar', label: 'Billing Invoices' },
    { key: 'payments', href: '/admin/payments', icon: 'fa-money-bill-wave', label: 'Payments Ledger' },
    { key: 'staff', href: '/admin/staff', icon: 'fa-id-badge', label: 'Hospital Staff' },
    { key: 'reports', href: '/admin/reports', icon: 'fa-chart-line', label: 'Reports & Analytics' },
    { key: 'notifications', href: '/admin/notifications', icon: 'fa-bell', label: 'Notifications' },
    { key: 'audit-logs', href: '/admin/audit-logs', icon: 'fa-shield-halved', label: 'Security Audit Logs' },
    { key: 'settings', href: '/admin/settings', icon: 'fa-sliders', label: 'System Settings' }
  ];

  return `
  <aside class="dashboard-sidebar">
    <div>
      <a href="/" class="brand-logo-grid" style="color: white; margin-bottom: var(--space-4);">
        <div class="brand-icon-box"><i class="fa-solid fa-hospital"></i></div>
        <div>
          <span>AuraCare</span>
          <span style="display: block; font-size: 0.65rem; color: #2dd4bf; letter-spacing: 0.05em; font-weight: bold;">ADMIN CONSOLE</span>
        </div>
      </a>

      <ul class="sidebar-nav-grid" style="max-height: calc(100vh - 220px); overflow-y: auto;">
        ${links.map(l => `
          <li>
            <a href="${l.href}" class="btn ${activePage === l.key ? 'btn-primary' : 'btn-outline'} btn-block" style="justify-content: start; text-align: left; ${activePage === l.key ? '' : 'color: var(--color-slate-300); border-color: rgba(255,255,255,0.08);'}">
              <i class="fa-solid ${l.icon}"></i> ${l.label}
            </a>
          </li>
        `).join('')}
      </ul>
    </div>

    <div style="background: rgba(255,255,255,0.06); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.1);">
      <div style="font-size: var(--font-size-sm); font-weight: bold; color: white;" data-user-name>Administrator</div>
      <div style="font-size: var(--font-size-xs); color: #2dd4bf; margin-bottom: var(--space-2);" data-user-role>Admin</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
        <a href="/admin/settings" class="btn btn-outline btn-sm" style="color: white; border-color: rgba(255,255,255,0.2); text-align: center;"><i class="fa-solid fa-gear"></i></a>
        <button class="btn btn-danger btn-sm" data-action-logout><i class="fa-solid fa-power-off"></i> Out</button>
      </div>
    </div>
  </aside>
  `;
}

function wrapAdminPage(pageKey, pageTitle, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle} | AuraCare Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body class="dashboard-layout">
  ${getAdminSidebar(pageKey)}

  <div class="dashboard-main">
    <header class="dashboard-topbar-grid">
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <h3 style="font-size: var(--font-size-lg); margin: 0;">${pageTitle}</h3>
      </div>
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <div class="health-badge" id="admin-health-badge">
          <span class="health-dot online"></span>
          <span>Live API / MySQL Active</span>
        </div>
        <a href="/" class="btn btn-outline btn-sm">Public Site &rarr;</a>
      </div>
    </header>

    <main class="dashboard-content-grid">
      ${content}
    </main>
  </div>

  <div class="toast-container"></div>
  <script src="/js/api.js"></script>
  <script src="/js/toast.js"></script>
  <script src="/js/modal.js"></script>
  <script src="/js/auth.js"></script>
  <script src="/js/responsive.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', async () => {
      await Auth.guardPage(['super_admin', 'hospital_admin']);
    });
  </script>
</body>
</html>`;
}

// 1. DASHBOARD OVERVIEW (/admin/dashboard)
const dashboardContent = `
<div class="dashboard-stats-grid">
  <div class="stat-card">
    <div class="stat-icon-wrapper stat-icon-teal"><i class="fa-solid fa-users"></i></div>
    <div class="stat-info"><div class="stat-value" id="ov-users">--</div><div class="stat-label">Total Users</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon-wrapper stat-icon-blue"><i class="fa-solid fa-user-doctor"></i></div>
    <div class="stat-info"><div class="stat-value" id="ov-doctors">--</div><div class="stat-label">Active Doctors</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon-wrapper stat-icon-green"><i class="fa-solid fa-calendar-check"></i></div>
    <div class="stat-info"><div class="stat-value" id="ov-appts">--</div><div class="stat-label">Total Appointments</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon-wrapper stat-icon-amber"><i class="fa-solid fa-sack-dollar"></i></div>
    <div class="stat-info"><div class="stat-value" id="ov-revenue">--</div><div class="stat-label">Net Invoiced Revenue</div></div>
  </div>
</div>

<div class="grid-split-60-40">
  <div class="card">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h4 style="font-size: var(--font-size-base); margin: 0;">Recent Clinical Bookings (MySQL)</h4>
      <a href="/admin/appointments" class="btn btn-outline btn-sm">All Appointments &rarr;</a>
    </div>
    <div class="card-body" style="padding: 0;">
      <div class="table-responsive" style="border: none;">
        <table class="table-modern">
          <thead><tr><th>Date & Time</th><th>Patient</th><th>Department & Doctor</th><th>Status</th></tr></thead>
          <tbody id="ov-appts-tbody"><tr><td colspan="4" class="text-center text-muted" style="padding: var(--space-6);">Loading appointments...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Quick Module Links</h4></div>
    <div class="card-body" style="display: grid; gap: var(--space-2);">
      <a href="/admin/users" class="btn btn-outline btn-block" style="justify-content: start;"><i class="fa-solid fa-users-gear text-primary"></i> User Directory & Status</a>
      <a href="/admin/roles" class="btn btn-outline btn-block" style="justify-content: start;"><i class="fa-solid fa-user-shield text-info"></i> RBAC Permission Matrix</a>
      <a href="/admin/patients" class="btn btn-outline btn-block" style="justify-content: start;"><i class="fa-solid fa-hospital-user text-green"></i> Patient Health Records</a>
      <a href="/admin/billing" class="btn btn-outline btn-block" style="justify-content: start;"><i class="fa-solid fa-file-invoice-dollar text-amber"></i> Billing & Invoices</a>
      <a href="/admin/audit-logs" class="btn btn-outline btn-block" style="justify-content: start;"><i class="fa-solid fa-shield-halved text-danger"></i> Security Audit Trail</a>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/admin/overview');
      if (res.success && res.data) {
        const d = res.data;
        document.getElementById('ov-users').textContent = d.totalUsers;
        document.getElementById('ov-doctors').textContent = d.totalDoctors;
        document.getElementById('ov-appts').textContent = d.totalAppointments;
        document.getElementById('ov-revenue').textContent = '$' + d.totalRevenue.toFixed(2);

        const tbody = document.getElementById('ov-appts-tbody');
        if (d.recentAppointments && d.recentAppointments.length > 0) {
          tbody.innerHTML = '';
          d.recentAppointments.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td><strong>\${a.appointment_date}</strong><br><span class="text-xs text-muted">\${a.appointment_time}</span></td>
              <td><strong>\${a.first_name} \${a.last_name}</strong><br><span class="text-xs text-muted">\${a.patient_code}</span></td>
              <td>\${a.department_name}<br><span class="text-xs text-muted">\${a.doctor_name || 'Assigned Specialist'}</span></td>
              <td><span class="badge badge-info">\${a.status}</span></td>
            \`;
            tbody.appendChild(tr);
          });
        }
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'dashboard.html'), wrapAdminPage('dashboard', 'Executive Hospital Dashboard', dashboardContent));

// 2. USERS DIRECTORY (/admin/users)
const usersContent = `
<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h4 style="font-size: var(--font-size-base); margin: 0;">Hospital Staff & User Accounts</h4>
      <p class="text-muted text-xs" style="margin: 0;">Live database querying with sorting, filtering, and role switching</p>
    </div>
    <div style="display: flex; gap: var(--space-2);">
      <input type="text" id="admin-user-search" class="form-input" placeholder="Search accounts..." style="width: 240px;">
      <a href="/admin/roles" class="btn btn-outline btn-sm"><i class="fa-solid fa-user-shield"></i> Roles & Matrix</a>
    </div>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>ID</th><th>User Details</th><th>Role</th><th>Status</th><th>Created</th></tr></thead>
        <tbody id="admin-users-tbody"><tr><td colspan="5" class="text-center text-muted" style="padding: var(--space-6);">Loading users...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    loadAdminUsers();
    document.getElementById('admin-user-search').addEventListener('input', (e) => {
      loadAdminUsers(e.target.value);
    });
  });

  async function loadAdminUsers(search = '') {
    try {
      const res = await API.get('/admin/users', { search: search || undefined, limit: 20 });
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-users-tbody');
        tbody.innerHTML = '';
        res.data.forEach(u => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><code>#\${u.id}</code></td>
            <td><strong>\${u.full_name}</strong><br><span class="text-xs text-muted">\${u.email}</span></td>
            <td><span class="badge badge-primary">\${u.role_display_name || u.role_name}</span></td>
            <td><span class="badge \${u.status === 'active' ? 'badge-success' : 'badge-danger'}">\${u.status}</span></td>
            <td class="text-xs text-muted">\${new Date(u.created_at).toLocaleDateString()}</td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  }
</script>
`;
fs.writeFileSync(path.join(adminDir, 'users.html'), wrapAdminPage('users', 'System Users Management', usersContent));

// 3. ROLES & PERMISSIONS (/admin/roles)
const rolesContent = `
<div class="card" style="margin-bottom: var(--space-6);">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;">Configured System Roles</h4>
  </div>
  <div class="card-body">
    <div class="grid-cards-auto" id="admin-roles-grid">
      <p class="text-muted">Loading roles...</p>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h4 style="font-size: var(--font-size-base); margin: 0;">Interactive Role-Permission Matrix (RBAC)</h4>
      <p class="text-muted text-xs" style="margin: 0;">Real-time toggle and save permissions in MySQL</p>
    </div>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="max-height: 500px; overflow-y: auto; border: none;">
      <table class="table-modern" id="admin-matrix-table">
        <thead id="admin-matrix-thead"><tr><th>Permission / Module</th></tr></thead>
        <tbody id="admin-matrix-tbody"><tr><td class="text-center text-muted" style="padding: var(--space-6);">Building matrix...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    loadRolesAndMatrix();
  });

  async function loadRolesAndMatrix() {
    try {
      const res = await API.get('/admin/matrix');
      if (res.success && res.data) {
        const { roles, permissions, matrix } = res.data;
        const grid = document.getElementById('admin-roles-grid');
        grid.innerHTML = '';
        roles.forEach(r => {
          const c = document.createElement('div');
          c.className = 'card';
          c.style.padding = 'var(--space-4)';
          c.innerHTML = \`
            <h5 style="margin-bottom: 2px;">\${r.display_name}</h5>
            <code style="font-size: 0.75rem; color: var(--color-slate-400);">\${r.name}</code>
            <p class="text-xs text-muted" style="margin: var(--space-2) 0;">\${r.description || 'System Role'}</p>
            <div style="font-size: 0.75rem; font-weight: bold; color: var(--color-primary);">\${r.permission_count || 0} permissions assigned</div>
          \`;
          grid.appendChild(c);
        });

        // Matrix Header
        const thead = document.getElementById('admin-matrix-thead');
        thead.innerHTML = \`<tr><th>Permission Code</th>\${roles.map(r => \`<th style="text-align: center;">\${r.display_name}<br><button class="btn btn-outline-primary btn-sm" style="font-size: 0.65rem; padding: 2px 4px; margin-top: 4px;" onclick="saveMatrix(\${r.id})">Save</button></th>\`).join('')}</tr>\`;

        // Matrix Body
        const tbody = document.getElementById('admin-matrix-tbody');
        tbody.innerHTML = '';
        permissions.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><code>\${p.code}</code><br><span class="text-xs text-muted">\${p.description}</span></td>
            \${matrix.map(rm => {
              const isG = rm.permissions.some(rp => rp.code === p.code && rp.granted);
              return \`<td style="text-align: center;"><input type="checkbox" class="matrix-cb" data-role-id="\${rm.roleId}" data-perm-id="\${p.id}" \${isG ? 'checked' : ''} \${rm.name === 'super_admin' ? 'disabled' : ''}></td>\`;
            }).join('')}
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  }

  async function saveMatrix(roleId) {
    const cbs = document.querySelectorAll(\`input.matrix-cb[data-role-id="\${roleId}"]:checked\`);
    const pIds = Array.from(cbs).map(c => parseInt(c.getAttribute('data-perm-id'), 10));
    try {
      const res = await API.put('/admin/roles/' + roleId + '/permissions', { permission_ids: pIds });
      if (res.success) Toast.success('Role permissions saved to MySQL.');
    } catch (err) { Toast.error(err.message || 'Save failed.'); }
  }
</script>
`;
fs.writeFileSync(path.join(adminDir, 'roles.html'), wrapAdminPage('roles', 'Role & Permission RBAC Controls', rolesContent));

// 4. PATIENTS MANAGEMENT (/admin/patients)
const patientsContent = `
<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h4 style="font-size: var(--font-size-base); margin: 0;">Patient Directory & Medical Records</h4>
      <p class="text-muted text-xs" style="margin: 0;">Registered patient profiles and electronic clinical files in MySQL</p>
    </div>
    <a href="/register" class="btn btn-primary btn-sm"><i class="fa-solid fa-user-plus"></i> Register Patient</a>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Patient Code</th><th>Full Name</th><th>Gender & Age</th><th>Contact Phone</th><th>Actions</th></tr></thead>
        <tbody id="admin-patients-tbody"><tr><td colspan="5" class="text-center text-muted" style="padding: var(--space-6);">Loading patient directory...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/admin/users', { role: 'patient', limit: 20 });
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-patients-tbody');
        tbody.innerHTML = '';
        res.data.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><code>\${p.patient_code || 'PAT-RECORD'}</code></td>
            <td><strong>\${p.full_name}</strong><br><span class="text-xs text-muted">\${p.email}</span></td>
            <td>Patient Profile</td>
            <td>\${p.phone || 'No phone'}</td>
            <td><a href="/patient/dashboard" class="btn btn-outline btn-sm"><i class="fa-regular fa-eye"></i> EMR Record</a></td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'patients.html'), wrapAdminPage('patients', 'Patient Records & Directory', patientsContent));

// 5. DOCTORS MANAGEMENT (/admin/doctors)
const adminDocsContent = `
<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h4 style="font-size: var(--font-size-base); margin: 0;">Doctor Faculty & Schedules</h4>
      <p class="text-muted text-xs" style="margin: 0;">Active physician credentials, departments, and consultation fees</p>
    </div>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Doctor Name</th><th>Specialization</th><th>Department</th><th>Consultation Fee</th><th>Experience</th><th>Status</th></tr></thead>
        <tbody id="admin-docs-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading doctors...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/doctors');
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-docs-tbody');
        tbody.innerHTML = '';
        res.data.forEach(d => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${d.name}</strong><br><span class="text-xs text-muted">\${d.qualification}</span></td>
            <td><span class="badge badge-info">\${d.specialization}</span></td>
            <td>\${d.department_name}</td>
            <td><strong>$\${parseFloat(d.consultation_fee).toFixed(2)}</strong></td>
            <td>\${d.experience_years} years</td>
            <td><span class="badge badge-success">\${d.is_available ? 'Available' : 'On Leave'}</span></td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'doctors.html'), wrapAdminPage('doctors', 'Doctor Faculty Management', adminDocsContent));

// 6. DEPARTMENTS MANAGEMENT (/admin/departments)
const adminDeptsContent = `
<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h4 style="font-size: var(--font-size-base); margin: 0;">Clinical Divisions & Medical Departments</h4>
    </div>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Code</th><th>Department Name</th><th>Icon</th><th>Description</th><th>Doctors Count</th><th>Status</th></tr></thead>
        <tbody id="admin-depts-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading departments...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/departments');
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-depts-tbody');
        tbody.innerHTML = '';
        res.data.forEach(d => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><code>\${d.code || 'DEPT'}</code></td>
            <td><strong>\${d.name}</strong></td>
            <td><i class="fa-solid \${d.icon || 'fa-heart-pulse'} text-primary"></i></td>
            <td class="text-xs text-muted">\${d.description || 'Clinical specialty'}</td>
            <td><strong>\${d.doctor_count || 0}</strong> Doctors</td>
            <td><span class="badge badge-success">Active</span></td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'departments.html'), wrapAdminPage('departments', 'Clinical Departments', adminDeptsContent));

// 7. APPOINTMENTS MANAGEMENT (/admin/appointments)
const adminApptsContent = `
<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h4 style="font-size: var(--font-size-base); margin: 0;">Master Appointment Scheduling Ledger</h4>
    </div>
    <a href="/appointments" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> New Booking</a>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Appt #</th><th>Date & Time</th><th>Patient</th><th>Doctor & Department</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody id="admin-appts-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading appointments...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/admin/overview');
      if (res.success && res.data && res.data.recentAppointments) {
        const tbody = document.getElementById('admin-appts-tbody');
        tbody.innerHTML = '';
        res.data.recentAppointments.forEach(a => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><code>\${a.appointment_number}</code></td>
            <td><strong>\${a.appointment_date}</strong><br><span class="text-xs text-muted">\${a.appointment_time}</span></td>
            <td><strong>\${a.first_name} \${a.last_name}</strong><br><span class="text-xs text-muted">\${a.patient_code}</span></td>
            <td>\${a.doctor_name || 'Specialist'}<br><span class="text-xs text-muted">\${a.department_name}</span></td>
            <td>\${a.reason}</td>
            <td><span class="badge badge-info">\${a.status}</span></td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'appointments.html'), wrapAdminPage('appointments', 'Appointments Scheduling', adminApptsContent));

// 8. OPD & IPD PAGES (/admin/opd & /admin/ipd)
const opdContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Outpatient Department (OPD) Live Queue</h4></div>
  <div class="card-body"><p class="text-muted">Real-time outpatient consultation triage and token queue management.</p></div>
</div>
`;
fs.writeFileSync(path.join(adminDir, 'opd.html'), wrapAdminPage('opd', 'Outpatient Department (OPD)', opdContent));

const ipdContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Inpatient Department (IPD) & Hospital Wards</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Ward Name</th><th>Type</th><th>Floor</th><th>Beds (Occupied / Total)</th><th>Price / Day</th><th>Status</th></tr></thead>
        <tbody id="admin-ipd-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading wards...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/wards');
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-ipd-tbody');
        tbody.innerHTML = '';
        res.data.forEach(w => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${w.name}</strong></td>
            <td><span class="badge badge-info">\${w.type.toUpperCase()}</span></td>
            <td>Floor \${w.floor_number}</td>
            <td><strong>\${w.occupied_beds}</strong> / \${w.total_beds}</td>
            <td><strong>$\${parseFloat(w.price_per_day).toFixed(2)}</strong></td>
            <td><span class="badge badge-success">\${w.status}</span></td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'ipd.html'), wrapAdminPage('ipd', 'Inpatient Department (IPD) & Wards', ipdContent));

// 9. LABORATORY & RADIOLOGY (/admin/laboratory & /admin/radiology)
const labContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Diagnostic Pathology & Laboratory Catalog</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Code</th><th>Test Name</th><th>Category</th><th>Normal Range</th><th>Turnaround</th><th>Price</th></tr></thead>
        <tbody id="admin-lab-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading lab tests...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/lab-tests');
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-lab-tbody');
        tbody.innerHTML = '';
        res.data.forEach(t => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><code>\${t.code}</code></td>
            <td><strong>\${t.name}</strong></td>
            <td><span class="badge badge-info">\${t.category}</span></td>
            <td>\${t.normal_range} \${t.unit}</td>
            <td>\${t.turnaround_hours} hours</td>
            <td><strong>$\${parseFloat(t.price).toFixed(2)}</strong></td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'laboratory.html'), wrapAdminPage('laboratory', 'Laboratory & Pathology Catalog', labContent));

const radContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Radiology & Digital Medical Imaging</h4></div>
  <div class="card-body"><p class="text-muted">Digital PACS archive: X-Ray, CT Scan, MRI, Ultrasound orders and DICOM reports.</p></div>
</div>
`;
fs.writeFileSync(path.join(adminDir, 'radiology.html'), wrapAdminPage('radiology', 'Radiology Imaging', radContent));

// 10. PHARMACY & INVENTORY (/admin/pharmacy & /admin/inventory)
const pharmContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Pharmacy Medication Stock & Dispensary</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Brand Name</th><th>Generic</th><th>Category</th><th>Strength</th><th>Stock</th><th>Unit Price</th><th>Expiry</th></tr></thead>
        <tbody id="admin-pharm-tbody"><tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">Loading medicines...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/medicines');
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-pharm-tbody');
        tbody.innerHTML = '';
        res.data.forEach(m => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${m.name}</strong></td>
            <td class="text-xs text-muted">\${m.generic_name}</td>
            <td><span class="badge badge-info">\${m.category}</span></td>
            <td>\${m.strength} (\${m.form})</td>
            <td><strong>\${m.stock_quantity}</strong> units</td>
            <td>$\${parseFloat(m.unit_price).toFixed(2)}</td>
            <td class="text-xs">\${m.expiry_date}</td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(adminDir, 'pharmacy.html'), wrapAdminPage('pharmacy', 'Pharmacy & Medication Stock', pharmContent));
fs.writeFileSync(path.join(adminDir, 'inventory.html'), wrapAdminPage('inventory', 'Hospital Inventory & Supplies', pharmContent));

// 11. BILLING & PAYMENTS (/admin/billing & /admin/payments)
const billingContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Invoices & Financial Accounts</h4></div>
  <div class="card-body"><p class="text-muted">Master billing invoices, insurance claims, and payment receipts ledger.</p></div>
</div>
`;
fs.writeFileSync(path.join(adminDir, 'billing.html'), wrapAdminPage('billing', 'Billing & Invoices Management', billingContent));
fs.writeFileSync(path.join(adminDir, 'payments.html'), wrapAdminPage('payments', 'Payments Ledger', billingContent));

// 12. STAFF, REPORTS, NOTIFICATIONS, AUDIT LOGS, SETTINGS
const staffContent = wrapAdminPage('staff', 'Hospital Staff Roster', '<div class="card"><div class="card-body"><p class="text-muted">Physicians, registered nurses, triage coordinators, lab technologists, and pharmacists.</p></div></div>');
fs.writeFileSync(path.join(adminDir, 'staff.html'), staffContent);

const reportsContent = wrapAdminPage('reports', 'Reports & Clinical Analytics', '<div class="card"><div class="card-body"><p class="text-muted">Daily census, department revenue, patient admissions, and medication turnover metrics.</p></div></div>');
fs.writeFileSync(path.join(adminDir, 'reports.html'), reportsContent);

const notifContent = wrapAdminPage('notifications', 'System Notifications', '<div class="card"><div class="card-body"><p class="text-muted">Emergency alerts, abnormal lab value flags, and appointment requests.</p></div></div>');
fs.writeFileSync(path.join(adminDir, 'notifications.html'), notifContent);

const auditContent = wrapAdminPage('audit-logs', 'Security Audit Trail', `
<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;">Immutable Security & Authentication Audit Trail</h4>
    <button class="btn btn-outline btn-sm" onclick="loadAudit()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>ID</th><th>Action Event</th><th>Entity</th><th>Actor</th><th>IP</th><th>Time</th></tr></thead>
        <tbody id="admin-audit-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading audit records...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', () => loadAudit());
  async function loadAudit() {
    try {
      const res = await API.get('/auth/audit-logs', { limit: 25 });
      if (res.success && res.data) {
        const tbody = document.getElementById('admin-audit-tbody');
        tbody.innerHTML = '';
        res.data.forEach(log => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><code>#\${log.id}</code></td>
            <td><span class="badge badge-info">\${log.action}</span></td>
            <td><code>\${log.entity || 'system'}</code></td>
            <td>\${log.user_name || 'System / Guest'}</td>
            <td>\${log.ip_address || '127.0.0.1'}</td>
            <td class="text-xs text-muted">\${new Date(log.created_at).toLocaleString()}</td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) { console.error(err); }
  }
</script>
`);
fs.writeFileSync(path.join(adminDir, 'audit-logs.html'), auditContent);

const settingsContent = wrapAdminPage('settings', 'Hospital & System Settings', `
<div class="card" style="max-width: 600px;">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Clinic Security Configuration</h4></div>
  <div class="card-body">
    <div style="display: grid; gap: var(--space-4);">
      <div><strong>Hospital Name:</strong> AuraCare Medical Center</div>
      <div><strong>Security Mode:</strong> Production RBAC (JWT + Bcrypt)</div>
      <div><strong>Database:</strong> MySQL 8.0 (Normalized Relational)</div>
      <div><strong>Architecture:</strong> True Multi-Page Application (MPA)</div>
    </div>
  </div>
</div>
`);
fs.writeFileSync(path.join(adminDir, 'settings.html'), settingsContent);

// Add remaining admin pages (blog, reviews, messages, documents)
fs.writeFileSync(path.join(adminDir, 'blog.html'), wrapAdminPage('blog', 'Content & Health Articles Manager', '<div class="card"><div class="card-body"><p class="text-muted">Manage clinical articles published on the public hospital portal.</p></div></div>'));
fs.writeFileSync(path.join(adminDir, 'reviews.html'), wrapAdminPage('reviews', 'Patient Reviews & Testimonials', '<div class="card"><div class="card-body"><p class="text-muted">Patient feedback and doctor rating moderation.</p></div></div>'));
fs.writeFileSync(path.join(adminDir, 'messages.html'), wrapAdminPage('messages', 'Concierge & Patient Messages', '<div class="card"><div class="card-body"><p class="text-muted">Inbound messages from public contact forms.</p></div></div>'));
fs.writeFileSync(path.join(adminDir, 'documents.html'), wrapAdminPage('documents', 'Clinical Documents & Forms', '<div class="card"><div class="card-body"><p class="text-muted">Hospital intake forms, consent documents, and clinical templates.</p></div></div>'));

console.log('✅ [MPA BUILDER] All 24 Admin pages generated in public/admin/');
