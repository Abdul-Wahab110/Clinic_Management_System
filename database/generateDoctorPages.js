const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const docDir = path.join(publicDir, 'doctor');
if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });

function getDoctorSidebar(activePage) {
  const links = [
    { key: 'dashboard', href: '/doctor/dashboard', icon: 'fa-user-doctor', label: 'Doctor Workspace' },
    { key: 'appointments', href: '/doctor/appointments', icon: 'fa-calendar-check', label: 'My Appointments' },
    { key: 'patients', href: '/doctor/patients', icon: 'fa-hospital-user', label: 'My Patients' },
    { key: 'consultations', href: '/doctor/consultations', icon: 'fa-stethoscope', label: 'Clinical Notes' },
    { key: 'medical-records', href: '/doctor/medical-records', icon: 'fa-file-waveform', label: 'Medical History' },
    { key: 'prescriptions', href: '/doctor/prescriptions', icon: 'fa-prescription', label: 'Prescriptions' },
    { key: 'lab-orders', href: '/doctor/lab-orders', icon: 'fa-vial-virus', label: 'Lab Orders' },
    { key: 'radiology', href: '/doctor/radiology', icon: 'fa-x-ray', label: 'Radiology PACS' },
    { key: 'follow-ups', href: '/doctor/follow-ups', icon: 'fa-clock-rotate-left', label: 'Follow-up Roster' },
    { key: 'schedule', href: '/doctor/schedule', icon: 'fa-calendar-days', label: 'Weekly Timetable' },
    { key: 'profile', href: '/doctor/profile', icon: 'fa-id-card', label: 'My Credentials' }
  ];

  return `
  <aside class="dashboard-sidebar">
    <div>
      <a href="/" class="brand-logo-grid" style="color: white; margin-bottom: var(--space-4);">
        <div class="brand-icon-box"><i class="fa-solid fa-user-doctor"></i></div>
        <div>
          <span>AuraCare</span>
          <span style="display: block; font-size: 0.65rem; color: #2dd4bf; letter-spacing: 0.05em; font-weight: bold;">PHYSICIAN PORTAL</span>
        </div>
      </a>

      <ul class="sidebar-nav-grid">
        ${links.map(l => `
          <li>
            <a href="${l.href}" class="btn ${activePage === l.key ? 'btn-primary' : 'btn-outline'} btn-block" style="justify-content: start; text-align: left; ${activePage === l.key ? '' : 'color: var(--color-slate-300); border-color: rgba(255,255,255,0.08);'}">
              <i class="fa-solid ${l.icon}"></i> ${l.label}
            </a>
          </li>
        `).join('')}
      </ul>
    </div>

    <div class="sidebar-user-box">
      <div class="sidebar-user-header">
        <div class="sidebar-user-avatar"><i class="fa-solid fa-user-doctor"></i></div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" data-user-name>Physician</div>
          <div class="sidebar-user-role" data-user-role>Doctor</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr auto; gap: var(--space-2); margin-top: 2px;">
        <button class="btn btn-outline-danger btn-sm" data-action-logout style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; color: #fca5a5; border-color: rgba(239,68,68,0.35);">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
        </button>
        <a href="/doctor/profile" class="btn btn-outline btn-sm" title="My Profile" style="color: white; border-color: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-id-badge"></i>
        </a>
      </div>
    </div>
  </aside>
  `;
}

function wrapDoctorPage(pageKey, pageTitle, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle} | AuraCare Physician</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body class="dashboard-layout">
  ${getDoctorSidebar(pageKey)}

  <div class="dashboard-main">
    <header class="dashboard-topbar-grid">
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <h3 style="font-size: var(--font-size-lg); margin: 0;">${pageTitle}</h3>
      </div>
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <span class="badge badge-success" data-user-role-badge>Physician Authenticated</span>
        <button class="btn btn-outline-danger btn-sm" data-action-logout title="Sign Out">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Sign Out</span>
        </button>
        <a href="/" class="btn btn-outline btn-sm">Clinic Home &rarr;</a>
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
      await Auth.guardPage(['doctor', 'super_admin', 'hospital_admin']);
    });
  </script>
</body>
</html>`;
}

// 1. DASHBOARD
const docDashContent = `
<div class="card" style="background: var(--gradient-card); margin-bottom: var(--space-4);">
  <div class="card-body">
    <div style="display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-6); align-items: center;">
      <div class="doctor-avatar-placeholder" style="width: 68px; height: 68px; font-size: 1.5rem;"><i class="fa-solid fa-user-doctor"></i></div>
      <div>
        <h3 id="doc-name" style="margin-bottom: 2px;">Loading Physician...</h3>
        <p id="doc-spec" class="text-muted text-sm" style="margin: 0;">Specialization & Credentials</p>
      </div>
      <div><a href="/doctor/schedule" class="btn btn-outline btn-sm"><i class="fa-regular fa-clock"></i> Weekly Timetable</a></div>
    </div>
  </div>
</div>

<div class="grid-4-col" style="margin-bottom: var(--space-4);">
  <div class="card" style="padding: var(--space-3); border-left: 3px solid #f59e0b;">
    <div class="text-xs text-muted font-bold text-uppercase">Waiting for Me</div>
    <div class="text-xl font-extrabold text-warning" id="doc-stat-waiting">0</div>
  </div>
  <div class="card" style="padding: var(--space-3); border-left: 3px solid #7c3aed;">
    <div class="text-xs text-muted font-bold text-uppercase">In Consultation</div>
    <div class="text-xl font-extrabold" style="color: #7c3aed;" id="doc-stat-in-con">0</div>
  </div>
  <div class="card" style="padding: var(--space-3); border-left: 3px solid #16a34a;">
    <div class="text-xs text-muted font-bold text-uppercase">Completed Today</div>
    <div class="text-xl font-extrabold text-success" id="doc-stat-completed">0</div>
  </div>
  <div class="card" style="padding: var(--space-3); border-left: 3px solid var(--color-primary);">
    <div class="text-xs text-muted font-bold text-uppercase">My Total Queue</div>
    <div class="text-xl font-extrabold text-navy" id="doc-stat-total">0</div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-people-roof text-primary"></i> Today's Live OPD Patient Queue</h4>
    <button class="btn btn-outline btn-sm" onclick="loadMyDoctorOpdQueue()"><i class="fa-solid fa-rotate-right"></i> Refresh</button>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead>
          <tr>
            <th>Token #</th>
            <th>Patient Details</th>
            <th>Priority</th>
            <th>Chief Complaint</th>
            <th>Status</th>
            <th style="text-align: right;">Clinical Action</th>
          </tr>
        </thead>
        <tbody id="doc-opd-queue-tbody">
          <tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Loading OPD queue...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    if (prof) {
      document.getElementById('doc-name').textContent = prof.fullName;
      if (prof.doctor) document.getElementById('doc-spec').textContent = (prof.doctor.specialization || 'Specialist') + ' • ' + (prof.doctor.department || 'Clinical Medicine');
    }
    loadMyDoctorOpdQueue();
    setInterval(loadMyDoctorOpdQueue, 5000);
  });

  async function loadMyDoctorOpdQueue() {
    try {
      const res = await API.get('/opd/dashboard');
      if (res.success && res.data) {
        const d = res.data;
        document.getElementById('doc-stat-waiting').textContent = d.stats.waiting;
        document.getElementById('doc-stat-in-con').textContent = d.stats.in_consultation;
        document.getElementById('doc-stat-completed').textContent = d.stats.completed;
        document.getElementById('doc-stat-total').textContent = d.stats.total;

        const tbody = document.getElementById('doc-opd-queue-tbody');
        if (d.all_queue.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">No patients currently in your queue.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        d.all_queue.forEach(q => {
          const tr = document.createElement('tr');
          let actionBtn = '';
          if (q.status === 'waiting') {
            actionBtn = \`<button class="btn btn-primary btn-sm" onclick="callPatient(\${q.id})"><i class="fa-solid fa-stethoscope"></i> Call In</button>\`;
          } else if (q.status === 'in_consultation') {
            actionBtn = \`<button class="btn btn-success btn-sm" onclick="completeVisit(\${q.id})"><i class="fa-solid fa-circle-check"></i> Complete</button>\`;
          } else {
            actionBtn = '<span class="text-xs text-muted">Completed</span>';
          }

          tr.innerHTML = \`
            <td><span class="badge" style="background: var(--color-navy-900); color: #2dd4bf; font-weight: 800;">\${q.token_number}</span></td>
            <td>
              <strong>\${q.patient_name}</strong><br>
              <span class="text-xs text-muted"><code>\${q.patient_code}</code></span>
            </td>
            <td><span class="badge \${q.priority === 'emergency' ? 'badge-danger' : (q.priority === 'urgent' ? 'badge-warning' : 'badge-light')}">\${q.priority}</span></td>
            <td class="text-xs text-muted" style="max-width: 220px;">\${q.chief_complaint || 'Consultation'}</td>
            <td><span class="badge status-badge-\${q.status}">\${q.status.replace('_', ' ')}</span></td>
            <td style="text-align: right; white-space: nowrap;">
              \${actionBtn}
              <a href="/admin/patient-profile?id=\${q.patient_id}" class="btn btn-outline btn-sm" title="View EMR"><i class="fa-solid fa-file-medical text-primary"></i></a>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (_) {}
  }

  async function callPatient(id) {
    try {
      const res = await API.patch('/opd/queues/' + id + '/call');
      if (res.success) {
        Toast.success(res.message);
        loadMyDoctorOpdQueue();
      }
    } catch (err) {
      Toast.error(err.message || 'Call failed.');
    }
  }

  async function completeVisit(id) {
    const diag = prompt('Please enter primary diagnosis to conclude consultation:');
    if (!diag) return;

    try {
      const res = await API.post('/opd/queues/' + id + '/complete', { diagnosis: diag });
      if (res.success) {
        Toast.success(res.message);
        loadMyDoctorOpdQueue();
      }
    } catch (err) {
      Toast.error(err.message || 'Completion failed.');
    }
  }
</script>
`;

const docPatientsContent = `
<div class="card" style="margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-4);">
    <div class="filter-bar-grid">
      <div style="position: relative;">
        <input type="text" id="doc-filter-search" class="form-input" placeholder="Search patient name, ID, phone, allergies..." style="padding-left: 2.25rem;">
        <i class="fa-solid fa-magnifying-glass text-muted" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%);"></i>
      </div>
      <div>
        <select id="doc-filter-gender" class="form-select">
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <select id="doc-filter-blood" class="form-select">
          <option value="all">All Blood Groups</option>
          <option value="A+">A+</option><option value="A-">A-</option>
          <option value="B+">B+</option><option value="B-">B-</option>
          <option value="AB+">AB+</option><option value="AB-">AB-</option>
          <option value="O+">O+</option><option value="O-">O-</option>
        </select>
      </div>
      <div>
        <select id="doc-filter-sort" class="form-select">
          <option value="created_at-DESC">Latest Patients</option>
          <option value="first_name-ASC">Name (A-Z)</option>
          <option value="patient_code-ASC">Patient Code</option>
        </select>
      </div>
      <div>
        <button id="doc-btn-reset" class="btn btn-outline btn-sm"><i class="fa-solid fa-rotate-left"></i> Reset</button>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;">Patient Electronic Health Charts (MySQL Live)</h4>
    <span class="text-xs text-muted" id="doc-count">Loading patients...</span>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead>
          <tr>
            <th>Patient Details</th>
            <th>Age & Sex</th>
            <th>Blood Group</th>
            <th>Known Allergies</th>
            <th>Medical History</th>
            <th>Contact</th>
            <th style="text-align: right;">EMR Actions</th>
          </tr>
        </thead>
        <tbody id="doc-patients-tbody">
          <tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">Loading clinical directory...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
<script>
  let docPage = 1;
  let docLimit = 10;
  let docDebounce = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await Auth.guardPage(["doctor","super_admin","hospital_admin"]);

    document.getElementById('doc-filter-search').addEventListener('input', () => {
      clearTimeout(docDebounce);
      docDebounce = setTimeout(() => { docPage = 1; loadDoctorPatients(); }, 300);
    });
    document.getElementById('doc-filter-gender').addEventListener('change', () => { docPage = 1; loadDoctorPatients(); });
    document.getElementById('doc-filter-blood').addEventListener('change', () => { docPage = 1; loadDoctorPatients(); });
    document.getElementById('doc-filter-sort').addEventListener('change', () => { docPage = 1; loadDoctorPatients(); });
    document.getElementById('doc-btn-reset').addEventListener('click', () => {
      document.getElementById('doc-filter-search').value = '';
      document.getElementById('doc-filter-gender').value = 'all';
      document.getElementById('doc-filter-blood').value = 'all';
      docPage = 1;
      loadDoctorPatients();
    });

    loadDoctorPatients();
  });

  async function loadDoctorPatients() {
    const search = document.getElementById('doc-filter-search').value.trim();
    const gender = document.getElementById('doc-filter-gender').value;
    const blood_group = document.getElementById('doc-filter-blood').value;
    const sortVal = document.getElementById('doc-filter-sort').value.split('-');

    const tbody = document.getElementById('doc-patients-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Fetching patients...</td></tr>';

    try {
      const res = await API.get('/patients', {
        search,
        gender,
        blood_group,
        sortBy: sortVal[0],
        sortOrder: sortVal[1],
        page: docPage,
        limit: docLimit
      });

      if (res.success && res.data) {
        tbody.innerHTML = '';
        if (res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">No matching patient records.</td></tr>';
          return;
        }

        document.getElementById('doc-count').textContent = 'Total: ' + res.pagination.total + ' patients';

        res.data.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td>
              <a href="/admin/patient-profile?id=\${p.id}" class="font-bold text-navy" style="text-decoration: none;">\${p.full_name}</a><br>
              <code style="font-size: 0.725rem;">\${p.patient_code}</code>
            </td>
            <td>\${p.age !== null ? p.age + ' yrs' : 'N/A'} • <span style="text-transform: capitalize;">\${p.gender}</span></td>
            <td><span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 700;">\${p.blood_group || 'Unknown'}</span></td>
            <td>
              <span class="text-xs" style="color: \${p.allergies ? '#dc2626' : '#64748b'}; font-weight: \${p.allergies ? '600' : 'normal'};">
                \${p.allergies || 'NKDA'}
              </span>
            </td>
            <td class="text-xs text-muted" style="max-width: 250px;">
              \${p.medical_history ? p.medical_history.substring(0, 80) + '...' : 'No chronic conditions recorded.'}
            </td>
            <td class="text-xs">\${p.phone}</td>
            <td style="text-align: right; white-space: nowrap;">
              <a href="/admin/patient-profile?id=\${p.id}" class="btn btn-primary btn-sm"><i class="fa-solid fa-notes-medical"></i> Open EMR Chart</a>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger" style="padding: var(--space-6);">Error: ' + err.message + '</td></tr>';
    }
  }
</script>
`;

const docProfileContent = `
<div class="doctor-profile-hero" style="background: linear-gradient(135deg, var(--color-navy-950) 0%, var(--color-navy-900) 60%, var(--color-primary-dark) 100%); color: white; border-radius: var(--radius-2xl); padding: var(--space-8); margin-bottom: var(--space-6); box-shadow: var(--shadow-xl);">
  <div style="display: grid; grid-template-columns: auto 1fr; gap: var(--space-6); align-items: center;">
    <div style="width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary)); color: var(--color-navy-950); font-size: 2.2rem; font-weight: 800; display: grid; place-items: center; border: 3px solid rgba(255,255,255,0.3);" id="doc-my-avatar">DR</div>
    <div>
      <div style="display: flex; gap: var(--space-2); align-items: center; margin-bottom: 4px;">
        <span class="badge" style="background: rgba(45,212,191,0.25); color: #2dd4bf; font-weight: bold;" id="doc-my-code">DOC-2026-0001</span>
        <span class="badge badge-success">Active Faculty</span>
      </div>
      <h2 style="color: white; margin: 0 0 4px 0;" id="doc-my-name">Loading Doctor Profile...</h2>
      <div style="color: #5eead4; font-weight: 600;" id="doc-my-spec">Specialization Title</div>
    </div>
  </div>
</div>

<div class="grid-split-60-40" style="gap: var(--space-5);">
  <div class="card">
    <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-id-card text-primary"></i> Physician Professional Credentials</h4></div>
    <div class="card-body">
      <div style="margin-bottom: var(--space-4);">
        <label class="text-xs text-muted font-bold text-uppercase">Qualifications & Degrees</label>
        <div class="font-bold text-navy" id="doc-my-qual">MD, Board Certified</div>
      </div>
      <div style="margin-bottom: var(--space-4);">
        <label class="text-xs text-muted font-bold text-uppercase">Medical License Number</label>
        <div><code id="doc-my-license">MD-00000</code></div>
      </div>
      <div style="margin-bottom: var(--space-4);">
        <label class="text-xs text-muted font-bold text-uppercase">Clinical Biography</label>
        <p style="color: var(--color-slate-700); line-height: 1.6; margin: 4px 0 0 0;" id="doc-my-bio">Clinical biography...</p>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-hospital-user text-primary"></i> Clinic Location & Settings</h4></div>
    <div class="card-body">
      <div style="margin-bottom: var(--space-3);">
        <label class="text-xs text-muted font-bold text-uppercase">Department</label>
        <div class="font-bold text-navy" id="doc-my-dept">Department Name</div>
      </div>
      <div style="margin-bottom: var(--space-3);">
        <label class="text-xs text-muted font-bold text-uppercase">Clinic Suite / Room</label>
        <div class="font-bold text-navy" id="doc-my-room">Suite Room</div>
      </div>
      <div style="margin-bottom: var(--space-3);">
        <label class="text-xs text-muted font-bold text-uppercase">Consultation Fee</label>
        <div class="text-xl font-extrabold" style="color: #059669;" id="doc-my-fee">$0.00</div>
      </div>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const prof = await Auth.fetchProfile();
      if (prof && prof.doctor) {
        const doc = prof.doctor;
        document.getElementById('doc-my-name').textContent = prof.fullName;
        document.getElementById('doc-my-avatar').textContent = prof.fullName.split(' ').map(n=>n[0]).join('').substring(0,2);
        document.getElementById('doc-my-code').textContent = doc.doctor_code || 'DOC-2026';
        document.getElementById('doc-my-spec').textContent = doc.specialization || 'Consultant Physician';
        document.getElementById('doc-my-qual').textContent = doc.qualification || 'MD';
        document.getElementById('doc-my-license').textContent = doc.license_number || 'MD-ACTIVE';
        document.getElementById('doc-my-bio').textContent = doc.bio || 'General clinical practice.';
        document.getElementById('doc-my-dept').textContent = doc.department || 'Clinical Medicine';
        document.getElementById('doc-my-room').textContent = doc.room_number || 'Consultation Suite';
        document.getElementById('doc-my-fee').textContent = '$' + (parseFloat(doc.consultation_fee) || 0).toFixed(2);
      }
    } catch (err) { console.error(err); }
  });
</script>
`;

const docScheduleContent = `
<div class="card" style="margin-bottom: var(--space-5);">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-calendar-days text-primary"></i> My Weekly Consultation Timetable</h4>
    <span class="badge badge-success">Live OPD Roster</span>
  </div>
  <div class="card-body">
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-3);" id="doc-my-schedules-grid">
      <div class="text-center text-muted" style="padding: 2rem; grid-column: 1 / -1;">Loading weekly duty schedule...</div>
    </div>
  </div>
</div>

<div class="grid-split-40-60" style="gap: var(--space-5);">
  <div class="card">
    <div class="card-header">
      <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-plane-departure text-primary"></i> Request Leave / Block Date</h4>
    </div>
    <div class="card-body">
      <form id="doctor-my-leave-form">
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label">Start Date *</label>
          <input type="date" id="my-leave-start" class="form-input" required>
        </div>
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label">End Date *</label>
          <input type="date" id="my-leave-end" class="form-input" required>
        </div>
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label">Leave Category</label>
          <select id="my-leave-type" class="form-select">
            <option value="annual">Annual / Vacation</option>
            <option value="conference">Conference / Research Symposium</option>
            <option value="sick">Sick / Medical Recovery</option>
            <option value="emergency">Emergency / Personal</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: var(--space-4);">
          <label class="form-label">Reason / Clinical Notes</label>
          <input type="text" id="my-leave-reason" class="form-input" placeholder="e.g. Attending European Neuro Congress">
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="btn-my-leave-submit">Submit Leave Request</button>
      </form>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-list-check text-primary"></i> My Recorded Leaves & Blocks</h4>
    </div>
    <div class="card-body" style="padding: 0;">
      <div class="table-responsive" style="border: none;">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Date Range</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="my-leaves-tbody">
            <tr><td colspan="4" class="text-center text-muted" style="padding: var(--space-6);">Loading leaves...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<script>
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let currentDoctorId = null;

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const prof = await Auth.fetchProfile();
      if (prof && prof.doctor) {
        currentDoctorId = prof.doctor.id;
        loadMySchedules(currentDoctorId);
        loadMyLeaves(currentDoctorId);
      }

      document.getElementById('doctor-my-leave-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentDoctorId) return;

        const start = document.getElementById('my-leave-start').value;
        const end = document.getElementById('my-leave-end').value;
        const type = document.getElementById('my-leave-type').value;
        const reason = document.getElementById('my-leave-reason').value.trim();

        if (!start || !end) {
          Toast.warning('Please select leave dates.');
          return;
        }

        const btn = document.getElementById('btn-my-leave-submit');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
          const res = await API.post('/schedules/leaves', {
            doctor_id: currentDoctorId,
            start_date: start,
            end_date: end,
            leave_type: type,
            reason,
            is_full_day: true,
            status: 'approved'
          });

          if (res.success) {
            Toast.success('Leave / blocked dates recorded successfully!');
            document.getElementById('doctor-my-leave-form').reset();
            loadMyLeaves(currentDoctorId);
          } else {
            Toast.error(res.message || 'Failed to submit leave.');
          }
        } catch (err) {
          Toast.error(err.message || 'Server error.');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Submit Leave Request';
        }
      });
    } catch (err) { console.error(err); }
  });

  async function loadMySchedules(docId) {
    const res = await API.get('/schedules/doctors/' + docId);
    if (res.success && res.data) {
      const grid = document.getElementById('doc-my-schedules-grid');
      grid.innerHTML = '';
      weekDays.forEach(day => {
        const slot = res.data.find(s => s.day_of_week === day);
        const isAct = slot && slot.is_active;
        const card = document.createElement('div');
        card.style.cssText = 'background: ' + (isAct ? '#f0fdf4' : '#f8fafc') + '; border: 1px solid ' + (isAct ? '#86efac' : '#e2e8f0') + '; border-radius: var(--radius-lg); padding: var(--space-3); text-align: center;';
        card.innerHTML = \`
          <div style="font-weight: 700; color: \${isAct ? '#047857' : '#64748b'};">\${day.substring(0, 3)}</div>
          <div style="font-size: 0.72rem; color: var(--color-slate-500); margin: 2px 0;">\${day}</div>
          <div style="margin: 6px 0;"><span class="badge \${isAct ? 'badge-success' : 'badge-light'}" style="font-size: 0.65rem;">\${isAct ? 'ON DUTY' : 'OFF'}</span></div>
          <div style="font-size: 0.75rem; font-weight: 600; color: var(--color-navy-900);">\${isAct ? slot.start_time.substring(0, 5) + ' - ' + slot.end_time.substring(0, 5) : '—'}</div>
          <div class="text-xs text-muted" style="font-size: 0.65rem;">\${isAct ? slot.slot_duration_minutes + 'm / ' + (slot.break_start_time ? 'Break ' + slot.break_start_time.substring(0,5) : '') : 'No Clinic'}</div>
        \`;
        grid.appendChild(card);
      });
    }
  }

  async function loadMyLeaves(docId) {
    const tbody = document.getElementById('my-leaves-tbody');
    try {
      const res = await API.get('/schedules/leaves', { doctor_id: docId });
      if (res.success && res.data) {
        if (res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding: var(--space-6);">No leaves currently recorded.</td></tr>';
          return;
        }
        tbody.innerHTML = '';
        res.data.forEach(l => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${l.start_date}</strong> &rarr; <strong>\${l.end_date}</strong></td>
            <td><span class="badge badge-warning" style="text-transform: uppercase;">\${l.leave_type}</span></td>
            <td class="text-xs text-muted">\${l.reason || 'General Leave'}</td>
            <td><span class="badge \${l.status === 'approved' ? 'badge-success' : 'badge-warning'}">\${l.status}</span></td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (_) {}
  }
</script>
`;

const docApptsContent = `
<div class="card" style="margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-4);">
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: var(--space-2); align-items: center;">
      <div style="position: relative;">
        <input type="text" id="doc-appt-search" class="form-input" placeholder="Search patient name, code, phone..." style="padding-left: 2rem;">
        <i class="fa-solid fa-magnifying-glass text-muted" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);"></i>
      </div>
      <div>
        <select id="doc-appt-status" class="form-select">
          <option value="all">All Consultation Statuses</option>
          <option value="checked_in">Checked-In (Waiting in Clinic)</option>
          <option value="in_progress">In Consultation (Active)</option>
          <option value="confirmed">Confirmed (Scheduled)</option>
          <option value="completed">Completed</option>
          <option value="no_show">No Show</option>
        </select>
      </div>
      <div>
        <select id="doc-appt-preset" class="form-select">
          <option value="today">Today's Clinic Queue</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="this_week">This Week</option>
          <option value="upcoming">All Upcoming</option>
          <option value="all">All Dates</option>
        </select>
      </div>
      <div>
        <button class="btn btn-outline btn-sm" onclick="loadDoctorAppointments()"><i class="fa-solid fa-rotate-right"></i> Refresh</button>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-stethoscope text-primary"></i> My Patient Consultation Queue</h4>
    <span class="badge badge-success" id="doc-queue-count">0 Patients</span>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead>
          <tr>
            <th>Appt #</th>
            <th>Patient Name</th>
            <th>Scheduled Time</th>
            <th>Type</th>
            <th>Chief Complaint</th>
            <th>Status</th>
            <th style="text-align: right;">Clinical Actions</th>
          </tr>
        </thead>
        <tbody id="doc-appts-tbody">
          <tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Loading appointment queue...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
  let docApptDebounce = null;
  document.addEventListener('DOMContentLoaded', async () => {
    loadDoctorAppointments();

    document.getElementById('doc-appt-search').addEventListener('input', () => {
      clearTimeout(docApptDebounce);
      docApptDebounce = setTimeout(loadDoctorAppointments, 300);
    });
    document.getElementById('doc-appt-status').addEventListener('change', loadDoctorAppointments);
    document.getElementById('doc-appt-preset').addEventListener('change', loadDoctorAppointments);
  });

  async function loadDoctorAppointments() {
    const tbody = document.getElementById('doc-appts-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Loading queue...</td></tr>';

    try {
      const params = {
        search: document.getElementById('doc-appt-search').value.trim() || undefined,
        status: document.getElementById('doc-appt-status').value,
        date_preset: document.getElementById('doc-appt-preset').value,
        limit: 50
      };

      const res = await API.get('/appointments', params);
      if (res.success && res.data) {
        document.getElementById('doc-queue-count').textContent = res.data.length + ' Patients';

        if (res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">No patients found in queue matching filters.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        res.data.forEach(a => {
          const tr = document.createElement('tr');
          let actionBtns = '';

          if (a.status === 'checked_in') {
            actionBtns = \`
              <button class="btn btn-sm" style="background:#7c3aed; color:white;" onclick="docUpdateStatus(\${a.id}, 'in_progress')" title="Call in patient"><i class="fa-solid fa-stethoscope"></i> Call In</button>
            \`;
          } else if (a.status === 'in_progress') {
            actionBtns = \`
              <button class="btn btn-success btn-sm" onclick="docUpdateStatus(\${a.id}, 'completed')" title="Complete Consultation"><i class="fa-solid fa-circle-check"></i> Complete</button>
            \`;
          } else if (a.status === 'confirmed') {
            actionBtns = \`
              <button class="btn btn-outline btn-sm" onclick="docUpdateStatus(\${a.id}, 'checked_in')"><i class="fa-solid fa-user-check"></i> Check-In</button>
              <button class="btn btn-outline-danger btn-sm" onclick="docUpdateStatus(\${a.id}, 'no_show')"><i class="fa-solid fa-user-slash"></i> No-Show</button>
            \`;
          } else {
            actionBtns = '<span class="text-xs text-muted">Completed / Logged</span>';
          }

          tr.innerHTML = \`
            <td><code>\${a.appointment_number}</code></td>
            <td>
              <strong>\${a.patient_name}</strong><br>
              <span class="text-xs text-muted"><code>\${a.patient_code}</code> • \${a.patient_phone || 'No phone'}</span>
            </td>
            <td>
              <strong>\${a.appointment_date}</strong><br>
              <span class="text-xs font-bold text-primary">\${a.appointment_time.substring(0, 5)}</span>
            </td>
            <td><span class="badge badge-light" style="text-transform: uppercase; font-size: 0.65rem;">\${a.type}</span></td>
            <td class="text-xs text-muted" style="max-width: 200px;">\${a.reason || 'General encounter'}</td>
            <td><span class="badge status-badge-\${a.status}">\${a.status.replace('_', ' ')}</span></td>
            <td style="text-align: right; white-space: nowrap;">
              \${actionBtns}
              <a href="/admin/patient-profile?id=\${a.patient_id}" class="btn btn-outline btn-sm" title="View Patient EMR"><i class="fa-solid fa-file-medical text-primary"></i></a>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      tbody.innerHTML = \`<tr><td colspan="7" class="text-center text-danger" style="padding: var(--space-6);">Error: \${err.message}</td></tr>\`;
    }
  }

  async function docUpdateStatus(id, newStatus) {
    try {
      const res = await API.patch('/appointments/' + id + '/status', { status: newStatus });
      if (res.success) {
        Toast.success('Encounter updated to ' + newStatus.replace('_', ' '));
        loadDoctorAppointments();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to update encounter.');
    }
  }
</script>
`;

const docConsultationContent = `
<div class="card" style="margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-3) var(--space-4);">
    <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: var(--space-3); align-items: center;">
      <div>
        <label class="form-label font-bold" style="margin-bottom: 2px; font-size: var(--font-size-xs);">Select Patient for Clinical Consultation *</label>
        <select id="consult-pat-select" class="form-select" onchange="onConsultPatientChange(this.value)">
          <option value="">-- Choose Patient from Health Registry --</option>
        </select>
      </div>
      <div>
        <label class="form-label font-bold" style="margin-bottom: 2px; font-size: var(--font-size-xs);">Active Queue / Appointment</label>
        <span class="badge badge-light" id="consult-encounter-type-badge" style="display: block; padding: 8px; text-align: center;">Direct EMR Encounter</span>
      </div>
      <div style="padding-top: 14px;">
        <button class="btn btn-outline btn-sm" onclick="reloadActivePatient()"><i class="fa-solid fa-rotate-right"></i> Refresh</button>
      </div>
    </div>
  </div>
</div>

<!-- PATIENT CLINICAL HEADER & CRITICAL ALERTS BANNER -->
<div id="consult-patient-header" class="card" style="display: none; background: var(--gradient-card); margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-4);">
    <div style="display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-5); align-items: center;">
      <div class="doctor-avatar-placeholder" style="width: 72px; height: 72px; font-size: 1.75rem;"><i class="fa-solid fa-user-injured"></i></div>
      <div>
        <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: 2px;">
          <h3 id="cpat-name" style="margin: 0;">Patient Name</h3>
          <span class="badge badge-success" id="cpat-code">PAT-CODE</span>
          <span class="badge badge-info" id="cpat-demog">Age • Gender</span>
          <span class="badge" style="background: #e0e7ff; color: #3730a3;" id="cpat-blood">Blood Group</span>
        </div>
        <p id="cpat-contact" class="text-xs text-muted" style="margin: 0;">Phone • Emergency Contact</p>
      </div>
      <div style="text-align: right;">
        <div class="text-xs text-muted">Total Past Visits: <strong id="cpat-visit-count" class="text-navy">0</strong></div>
        <div class="text-xs text-muted">Latest Record: <strong id="cpat-latest-date">—</strong></div>
      </div>
    </div>

    <!-- CRITICAL ALLERGIES & CHRONIC HISTORY ALERT (CSS GRID) -->
    <div style="margin-top: var(--space-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
      <div id="cpat-allergy-alert" style="background: #fee2e2; border: 1px solid #f87171; border-radius: var(--radius-md); padding: 8px 12px; font-size: 0.8rem; color: #991b1b; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.1rem;"></i>
        <div>
          <strong>ALLERGIES:</strong> <span id="cpat-allergies-text">Loading...</span>
        </div>
      </div>
      <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: var(--radius-md); padding: 8px 12px; font-size: 0.8rem; color: var(--color-slate-700); display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-book-medical text-primary" style="font-size: 1.1rem;"></i>
        <div>
          <strong>CHRONIC HISTORY:</strong> <span id="cpat-history-text">None</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 2-COLUMN SPLIT CLINICAL WORKSPACE (CSS GRID) -->
<div id="consult-workspace-grid" style="display: none; grid-template-columns: 1fr 1.6fr; gap: var(--space-4); align-items: start;">
  
  <!-- LEFT COLUMN: LONGITUDINAL MEDICAL HISTORY & PREVIOUS ENCOUNTERS -->
  <div style="display: flex; flex-direction: column; gap: var(--space-4);">
    
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-clock-rotate-left text-primary"></i> Chronological Visits (Never Overwritten)</h4>
      </div>
      <div class="card-body" id="cpat-encounters-timeline" style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3);">
        <div class="text-center text-muted text-xs" style="padding: 2rem;">No previous medical records recorded for this patient.</div>
      </div>
    </div>

    <!-- PREVIOUS PRESCRIPTIONS ARCHIVE -->
    <div class="card">
      <div class="card-header"><h4 style="font-size: var(--font-size-sm); margin: 0;"><i class="fa-solid fa-prescription text-primary"></i> Previous Prescriptions Archive</h4></div>
      <div class="card-body" style="padding: 0; max-height: 220px; overflow-y: auto;">
        <table class="table-modern" style="font-size: 0.75rem;">
          <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Date</th></tr></thead>
          <tbody id="cpat-rx-tbody"><tr><td colspan="4" class="text-center text-muted">No historical medications</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- PREVIOUS LAB REPORTS -->
    <div class="card">
      <div class="card-header"><h4 style="font-size: var(--font-size-sm); margin: 0;"><i class="fa-solid fa-flask-vial text-primary"></i> Diagnostic Lab Reports</h4></div>
      <div class="card-body" style="padding: 0; max-height: 200px; overflow-y: auto;">
        <table class="table-modern" style="font-size: 0.75rem;">
          <thead><tr><th>Test Name</th><th>Results</th><th>Status</th></tr></thead>
          <tbody id="cpat-lab-tbody"><tr><td colspan="3" class="text-center text-muted">No lab orders</td></tr></tbody>
        </table>
      </div>
    </div>

  </div>

  <!-- RIGHT COLUMN: ACTIVE CLINICAL ENCOUNTER WORKSPACE -->
  <div class="card">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-stethoscope text-primary"></i> Active Clinical Encounter Documentation</h4>
      <span class="badge badge-primary">SOAP Clinical Charting</span>
    </div>
    <div class="card-body" style="padding: var(--space-4);">
      <form id="form-consultation" onsubmit="event.preventDefault(); submitConsultation();">
        <input type="hidden" id="enc-patient-id">
        <input type="hidden" id="enc-appt-id">
        <input type="hidden" id="enc-opd-id">

        <!-- 1. VITALS CAPTURE (CSS GRID) -->
        <div style="background: var(--color-slate-50); border: 1px solid var(--color-slate-200); border-radius: var(--radius-lg); padding: var(--space-3); margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <h5 class="text-xs text-muted font-bold text-uppercase" style="margin: 0;"><i class="fa-solid fa-heart-pulse text-danger"></i> Triage Vitals</h5>
            <span class="badge badge-success" id="enc-bmi-badge">BMI: — kg/m²</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); margin-bottom: var(--space-2);">
            <div>
              <label class="form-label text-xs">Systolic BP</label>
              <input type="number" id="enc-sys" class="form-input text-xs" placeholder="120 mmHg">
            </div>
            <div>
              <label class="form-label text-xs">Diastolic BP</label>
              <input type="number" id="enc-dia" class="form-input text-xs" placeholder="80 mmHg">
            </div>
            <div>
              <label class="form-label text-xs">Pulse (bpm)</label>
              <input type="number" id="enc-hr" class="form-input text-xs" placeholder="72 bpm">
            </div>
            <div>
              <label class="form-label text-xs">Temp (°F)</label>
              <input type="number" step="0.1" id="enc-temp" class="form-input text-xs" placeholder="98.6 °F">
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);">
            <div>
              <label class="form-label text-xs">Resp Rate</label>
              <input type="number" id="enc-resp" class="form-input text-xs" placeholder="16 /min">
            </div>
            <div>
              <label class="form-label text-xs">SPO2 (%)</label>
              <input type="number" id="enc-spo2" class="form-input text-xs" placeholder="99 %">
            </div>
            <div>
              <label class="form-label text-xs">Weight (kg)</label>
              <input type="number" step="0.5" id="enc-wt" class="form-input text-xs" placeholder="70 kg" oninput="calcEncBmi()">
            </div>
            <div>
              <label class="form-label text-xs">Height (cm)</label>
              <input type="number" id="enc-ht" class="form-input text-xs" placeholder="175 cm" oninput="calcEncBmi()">
            </div>
          </div>
        </div>

        <!-- 2. SOAP SUBJECTIVE: CHIEF COMPLAINT & SYMPTOMS -->
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label font-bold">Chief Medical Complaint *</label>
          <input type="text" id="enc-complaint" class="form-input" placeholder="e.g. Recurrent episodes of exertional chest pressure and shortness of breath" required>
        </div>

        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label font-bold">History of Present Illness (HPI) & Symptoms</label>
          <textarea id="enc-symptoms" class="form-textarea" rows="2" placeholder="Onset, duration, severity, aggravating/relieving factors, associated symptoms..."></textarea>
        </div>

        <!-- 3. SOAP OBJECTIVE: PHYSICAL EXAMINATION -->
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label font-bold">Physical Examination & Clinical Findings</label>
          <textarea id="enc-exam" class="form-textarea" rows="2" placeholder="General appearance, Cardiovascular, Respiratory, Abdominal, Neurological findings..."></textarea>
        </div>

        <!-- 4. SOAP ASSESSMENT: CLINICAL DIAGNOSIS -->
        <div class="form-group" style="margin-bottom: var(--space-3);">
          <label class="form-label font-bold">Clinical Diagnosis / ICD Assessment *</label>
          <input type="text" id="enc-diagnosis" class="form-input" placeholder="e.g. Stage 1 Essential Hypertension (ICD-10 I10), Post-CABG Status" required>
        </div>

        <!-- 5. SOAP PLAN: TREATMENT PLAN -->
        <div class="form-group" style="margin-bottom: var(--space-4);">
          <label class="form-label font-bold">Treatment Plan & Medical Advice</label>
          <textarea id="enc-treatment" class="form-textarea" rows="2" placeholder="Therapeutic goals, lifestyle recommendations, dietary modifications..."></textarea>
        </div>

        <!-- 6. E-PRESCRIPTIONS DYNAMIC BUILDER -->
        <div style="border-top: 1px solid var(--color-slate-200); padding-top: var(--space-3); margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <h5 class="text-xs font-bold text-uppercase" style="margin: 0;"><i class="fa-solid fa-prescription-bottle-medical text-primary"></i> Electronic Prescriptions (Rx)</h5>
            <button type="button" class="btn btn-outline btn-sm" onclick="addRxRow()"><i class="fa-solid fa-plus"></i> Add Medication</button>
          </div>
          <div id="rx-rows-container" style="display: flex; flex-direction: column; gap: var(--space-2);">
            <!-- Dynamic prescription rows -->
          </div>
        </div>

        <!-- 7. DIAGNOSTIC LAB ORDERS -->
        <div style="border-top: 1px solid var(--color-slate-200); padding-top: var(--space-3); margin-bottom: var(--space-4);">
          <h5 class="text-xs font-bold text-uppercase" style="margin-bottom: var(--space-2);"><i class="fa-solid fa-vials text-primary"></i> Order Diagnostic Laboratory Tests</h5>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); font-size: var(--font-size-xs);">
            <label style="display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="lab_order" value="1"> Complete Blood Count (CBC)</label>
            <label style="display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="lab_order" value="2"> Comprehensive Lipid Panel</label>
            <label style="display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="lab_order" value="3"> Basic Metabolic Panel (BMP)</label>
            <label style="display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="lab_order" value="4"> HbA1c Glycated Hemoglobin</label>
            <label style="display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="lab_order" value="5"> Cardiac Troponin-I</label>
            <label style="display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="lab_order" value="6"> Chest X-Ray Radiograph</label>
          </div>
        </div>

        <!-- 8. DOCTOR PRIVATE NOTES & FOLLOW-UP -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-3); margin-bottom: var(--space-4);">
          <div class="form-group">
            <label class="form-label font-bold text-xs">Confidential Doctor Notes (Internal EMR)</label>
            <input type="text" id="enc-doc-notes" class="form-input text-xs" placeholder="Internal clinical impression...">
          </div>
          <div class="form-group">
            <label class="form-label font-bold text-xs">Recommended Follow-Up Date</label>
            <input type="date" id="enc-followup" class="form-input text-xs">
          </div>
        </div>

        <!-- ACTION FOOTER -->
        <div style="display: flex; justify-content: flex-end; gap: var(--space-3); border-top: 1px solid var(--color-slate-200); padding-top: var(--space-4);">
          <button type="button" class="btn btn-outline" onclick="resetConsultationForm()">Clear Form</button>
          <button type="submit" class="btn btn-primary" id="btn-save-consultation" style="background: #16a34a; border-color: #16a34a; font-weight: 700; padding: 10px 24px;">
            <i class="fa-solid fa-floppy-disk"></i> Conclude Consultation & Save EMR
          </button>
        </div>

      </form>
    </div>
  </div>

</div>

<script>
  let activePatientSummary = null;
  let allPatientsList = [];

  document.addEventListener('DOMContentLoaded', async () => {
    await Auth.guardPage(["doctor","super_admin","hospital_admin"]);
    await loadConsultationPatients();

    // Check URL parameters for fast patient routing (e.g. ?patient_id=1&queue_id=2)
    const urlParams = new URLSearchParams(window.location.search);
    const patParam = urlParams.get('patient_id');
    const queueParam = urlParams.get('queue_id');
    const apptParam = urlParams.get('appointment_id');

    if (queueParam) document.getElementById('enc-opd-id').value = queueParam;
    if (apptParam) document.getElementById('enc-appt-id').value = apptParam;

    if (patParam) {
      document.getElementById('consult-pat-select').value = patParam;
      onConsultPatientChange(patParam);
    }
  });

  async function loadConsultationPatients() {
    try {
      const res = await API.get('/patients', { limit: 100 });
      if (res.success && res.data) {
        allPatientsList = res.data;
        const select = document.getElementById('consult-pat-select');
        allPatientsList.forEach(p => {
          select.innerHTML += \`<option value="\${p.id}">\${p.first_name} \${p.last_name} (\${p.patient_code}) - \${p.phone}</option>\`;
        });
      }
    } catch (_) {}
  }

  async function onConsultPatientChange(patId) {
    if (!patId) {
      document.getElementById('consult-patient-header').style.display = 'none';
      document.getElementById('consult-workspace-grid').style.display = 'none';
      return;
    }

    try {
      const res = await API.get(\`/consultations/patients/\${patId}/clinical-summary\`);
      if (res.success && res.data) {
        activePatientSummary = res.data;
        renderPatientHeader(activePatientSummary);
        renderHistoricalTimeline(activePatientSummary.previous_visits);
        renderRxArchive(activePatientSummary.previous_prescriptions);
        renderLabReports(activePatientSummary.previous_lab_reports);

        document.getElementById('enc-patient-id').value = patId;
        document.getElementById('consult-patient-header').style.display = 'block';
        document.getElementById('consult-workspace-grid').style.display = 'grid';

        // Pre-fill latest vitals if available
        if (activePatientSummary.latest_vitals) {
          const lv = activePatientSummary.latest_vitals;
          document.getElementById('enc-sys').value = lv.systolic || '';
          document.getElementById('enc-dia').value = lv.diastolic || '';
          document.getElementById('enc-hr').value = lv.heart_rate || '';
          document.getElementById('enc-temp').value = lv.temperature || '';
          document.getElementById('enc-resp').value = lv.respiratory_rate || '';
          document.getElementById('enc-spo2').value = lv.oxygen_saturation || '';
          document.getElementById('enc-wt').value = lv.weight_kg || '';
          document.getElementById('enc-ht').value = lv.height_cm || '';
          calcEncBmi();
        }
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load patient clinical record.');
    }
  }

  function reloadActivePatient() {
    const patId = document.getElementById('consult-pat-select').value;
    if (patId) onConsultPatientChange(patId);
  }

  function renderPatientHeader(summary) {
    const p = summary.patient;
    document.getElementById('cpat-name').textContent = p.full_name;
    document.getElementById('cpat-code').textContent = p.patient_code;
    document.getElementById('cpat-demog').textContent = (p.age ? p.age + ' yrs' : 'Age unknown') + ' • ' + (p.gender || 'Unknown');
    document.getElementById('cpat-blood').textContent = p.blood_group ? 'Blood: ' + p.blood_group : 'Blood: Unknown';
    document.getElementById('cpat-contact').textContent = 'Phone: ' + (p.phone || 'None') + ' • Emergency: ' + (p.emergency_contact_name || 'N/A') + ' (' + (p.emergency_contact_phone || '') + ')';
    document.getElementById('cpat-visit-count').textContent = summary.previous_visits_count;

    const alertBox = document.getElementById('cpat-allergy-alert');
    if (summary.has_allergies) {
      alertBox.style.background = '#fee2e2';
      alertBox.style.borderColor = '#f87171';
      alertBox.style.color = '#991b1b';
      document.getElementById('cpat-allergies-text').innerHTML = \`<strong>⚠️ CRITICAL ALLERGY ALERT:</strong> \${summary.allergies_raw}\`;
    } else {
      alertBox.style.background = '#f0fdf4';
      alertBox.style.borderColor = '#86efac';
      alertBox.style.color = '#166534';
      document.getElementById('cpat-allergies-text').textContent = 'No Known Drug Allergies (NKDA)';
    }

    document.getElementById('cpat-history-text').textContent = summary.medical_history;

    if (summary.previous_visits.length > 0) {
      document.getElementById('cpat-latest-date').textContent = summary.previous_visits[0].record_date;
    } else {
      document.getElementById('cpat-latest-date').textContent = 'First Encounter';
    }
  }

  function renderHistoricalTimeline(visits) {
    const container = document.getElementById('cpat-encounters-timeline');
    if (visits.length === 0) {
      container.innerHTML = '<div class="text-center text-muted text-xs" style="padding: 2rem;">No previous medical encounters on file.</div>';
      return;
    }

    container.innerHTML = '';
    visits.forEach(v => {
      const card = document.createElement('div');
      card.style.cssText = 'background: white; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);';

      let vitalsPill = '';
      if (v.vitals) {
        vitalsPill = \`<span style="font-size: 0.7rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: var(--color-slate-700);"><i class="fa-solid fa-heart-pulse text-danger"></i> \${v.vitals.systolic || '--'}/\${v.vitals.diastolic || '--'} • \${v.vitals.heart_rate || '--'}bpm • BMI: \${v.vitals.bmi || '--'}</span>\`;
      }

      let rxList = '';
      if (v.prescriptions && v.prescriptions.length > 0) {
        rxList = \`
          <div style="margin-top: 6px; font-size: 0.725rem; background: #f8fafc; padding: 6px; border-radius: 4px;">
            <strong>Prescribed:</strong> \${v.prescriptions.map(r => r.medicine_name + ' (' + r.dosage + ')').join(', ')}
          </div>
        \`;
      }

      card.innerHTML = \`
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div>
            <strong style="color: var(--color-navy-900); font-size: 0.85rem;">\${v.record_date}</strong>
            <span class="text-xs text-muted"> • Dr. \${v.doctor_name}</span>
          </div>
          \${vitalsPill}
        </div>
        <div style="font-size: 0.8rem; font-weight: 700; color: #1e3a8a; margin-bottom: 2px;">
          \${v.diagnosis}
        </div>
        <div class="text-xs text-muted" style="margin-bottom: 4px;">
          <strong>Complaint:</strong> \${v.chief_complaint}
        </div>
        \${v.treatment_plan ? \`<div class="text-xs" style="color: var(--color-slate-600);"><strong>Plan:</strong> \${v.treatment_plan}</div>\` : ''}
        \${rxList}
      \`;
      container.appendChild(card);
    });
  }

  function renderRxArchive(rxList) {
    const tbody = document.getElementById('cpat-rx-tbody');
    if (rxList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No historical medications</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    rxList.slice(0, 8).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td><strong>\${r.medicine_name}</strong></td>
        <td>\${r.dosage}</td>
        <td>\${r.frequency}</td>
        <td>\${r.record_date || r.created_at.substring(0, 10)}</td>
      \`;
      tbody.appendChild(tr);
    });
  }

  function renderLabReports(labList) {
    const tbody = document.getElementById('cpat-lab-tbody');
    if (labList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No lab orders</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    labList.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td><strong>\${l.test_name}</strong><br><span class="text-xs text-muted">\${l.order_date}</span></td>
        <td class="text-xs">\${l.result_value || 'Pending analysis'}</td>
        <td><span class="badge \${l.status === 'completed' ? 'badge-success' : 'badge-warning'}">\${l.status}</span></td>
      \`;
      tbody.appendChild(tr);
    });
  }

  function calcEncBmi() {
    const wt = parseFloat(document.getElementById('enc-wt').value);
    const ht = parseFloat(document.getElementById('enc-ht').value);
    const badge = document.getElementById('enc-bmi-badge');
    if (wt > 0 && ht > 0) {
      const hm = ht / 100;
      const bmi = (wt / (hm * hm)).toFixed(1);
      badge.textContent = \`BMI: \${bmi} kg/m²\`;
      badge.className = (bmi >= 18.5 && bmi <= 24.9) ? 'badge badge-success' : 'badge badge-warning';
    } else {
      badge.textContent = 'BMI: — kg/m²';
      badge.className = 'badge badge-light';
    }
  }

  function addRxRow() {
    const container = document.getElementById('rx-rows-container');
    const row = document.createElement('div');
    row.className = 'rx-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr auto; gap: 6px; align-items: center; background: white; padding: 6px; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md);';
    row.innerHTML = \`
      <input type="text" class="form-input text-xs rx-name" placeholder="Medicine Name (e.g. Amoxicillin)" required>
      <input type="text" class="form-input text-xs rx-dosage" placeholder="Dosage (500mg)" required>
      <input type="text" class="form-input text-xs rx-freq" placeholder="Freq (TDS / 8hr)">
      <input type="text" class="form-input text-xs rx-dur" placeholder="Duration (7 days)">
      <input type="text" class="form-input text-xs rx-inst" placeholder="Instructions (after meals)">
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()" style="padding: 4px 8px;">&times;</button>
    \`;
    container.appendChild(row);
  }

  async function submitConsultation() {
    const patId = document.getElementById('enc-patient-id').value;
    const complaint = document.getElementById('enc-complaint').value.trim();
    const diagnosis = document.getElementById('enc-diagnosis').value.trim();

    if (!patId || !complaint || !diagnosis) {
      Toast.warning('Please complete Chief Complaint and Diagnosis fields.');
      return;
    }

    // Collect Prescriptions
    const rxRows = document.querySelectorAll('.rx-row');
    const prescriptions = [];
    rxRows.forEach(r => {
      const name = r.querySelector('.rx-name').value.trim();
      const dosage = r.querySelector('.rx-dosage').value.trim();
      if (name && dosage) {
        prescriptions.push({
          medicine_name: name,
          dosage,
          frequency: r.querySelector('.rx-freq').value.trim() || 'Once daily',
          duration: r.querySelector('.rx-dur').value.trim() || '7 days',
          instructions: r.querySelector('.rx-inst').value.trim() || undefined
        });
      }
    });

    // Collect Lab Orders
    const labChecks = document.querySelectorAll('input[name="lab_order"]:checked');
    const lab_tests = Array.from(labChecks).map(c => parseInt(c.value, 10));

    const payload = {
      patient_id: parseInt(patId, 10),
      appointment_id: document.getElementById('enc-appt-id').value ? parseInt(document.getElementById('enc-appt-id').value, 10) : undefined,
      opd_queue_id: document.getElementById('enc-opd-id').value ? parseInt(document.getElementById('enc-opd-id').value, 10) : undefined,
      chief_complaint: complaint,
      symptoms: document.getElementById('enc-symptoms').value.trim() || undefined,
      physical_examination: document.getElementById('enc-exam').value.trim() || undefined,
      diagnosis,
      treatment_plan: document.getElementById('enc-treatment').value.trim() || undefined,
      doctor_notes: document.getElementById('enc-doc-notes').value.trim() || undefined,
      follow_up_date: document.getElementById('enc-followup').value || undefined,
      vitals: {
        systolic: document.getElementById('enc-sys').value ? parseInt(document.getElementById('enc-sys').value, 10) : undefined,
        diastolic: document.getElementById('enc-dia').value ? parseInt(document.getElementById('enc-dia').value, 10) : undefined,
        heart_rate: document.getElementById('enc-hr').value ? parseInt(document.getElementById('enc-hr').value, 10) : undefined,
        temperature: document.getElementById('enc-temp').value ? parseFloat(document.getElementById('enc-temp').value) : undefined,
        respiratory_rate: document.getElementById('enc-resp').value ? parseInt(document.getElementById('enc-resp').value, 10) : undefined,
        oxygen_saturation: document.getElementById('enc-spo2').value ? parseInt(document.getElementById('enc-spo2').value, 10) : undefined,
        weight_kg: document.getElementById('enc-wt').value ? parseFloat(document.getElementById('enc-wt').value) : undefined,
        height_cm: document.getElementById('enc-ht').value ? parseFloat(document.getElementById('enc-ht').value) : undefined
      },
      prescriptions,
      lab_tests
    };

    const btn = document.getElementById('btn-save-consultation');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Concluding Encounter...';

    try {
      const res = await API.post('/consultations/encounters', payload);
      if (res.success) {
        Toast.success('Encounter concluded and added to patient longitudinal health record!');
        onConsultPatientChange(patId);
        resetConsultationForm();
      } else {
        Toast.error(res.message || 'Saving consultation failed.');
      }
    } catch (err) {
      Toast.error(err.message || 'Server error.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Conclude Consultation & Save EMR';
    }
  }

  function resetConsultationForm() {
    document.getElementById('enc-complaint').value = '';
    document.getElementById('enc-symptoms').value = '';
    document.getElementById('enc-exam').value = '';
    document.getElementById('enc-diagnosis').value = '';
    document.getElementById('enc-treatment').value = '';
    document.getElementById('enc-doc-notes').value = '';
    document.getElementById('enc-followup').value = '';
    document.getElementById('rx-rows-container').innerHTML = '';
    document.querySelectorAll('input[name="lab_order"]').forEach(c => c.checked = false);
  }
</script>
`;

const docMedicalRecordsContent = `
<div class="card" style="margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-3) var(--space-4);">
    <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: var(--space-3); align-items: center;">
      <div style="position: relative;">
        <input type="text" id="emr-search" class="form-input" placeholder="Search patient name, MRN, diagnosis..." style="padding-left: 2rem;">
        <i class="fa-solid fa-magnifying-glass text-muted" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);"></i>
      </div>
      <div>
        <select id="emr-patient-filter" class="form-select">
          <option value="">All Patient Records</option>
        </select>
      </div>
      <div>
        <a href="/doctor/consultations" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> New Encounter</a>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-file-waveform text-primary"></i> Electronic Medical Records (EMR) Archive</h4>
    <span class="badge badge-success" id="emr-count-badge">0 Encounters</span>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient Details</th>
            <th>Attending Doctor</th>
            <th>Primary Diagnosis</th>
            <th>Chief Complaint</th>
            <th>Vitals</th>
            <th style="text-align: right;">Chart Actions</th>
          </tr>
        </thead>
        <tbody id="emr-tbody">
          <tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Loading EMR archive...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
  document.addEventListener('DOMContentLoaded', async () => {
    loadEmrArchive();
  });

  async function loadEmrArchive() {
    const tbody = document.getElementById('emr-tbody');
    try {
      const res = await API.get('/patients/1/clinical-summary');
      if (res.success && res.data) {
        const visits = res.data.previous_visits || [];
        document.getElementById('emr-count-badge').textContent = visits.length + ' Encounters';

        if (visits.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">No medical encounters recorded.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        visits.forEach(v => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${v.record_date}</strong></td>
            <td>
              <strong>\${res.data.patient.full_name}</strong><br>
              <span class="text-xs text-muted"><code>\${res.data.patient.patient_code}</code></span>
            </td>
            <td>Dr. \${v.doctor_name}</td>
            <td><strong class="text-primary">\${v.diagnosis}</strong></td>
            <td class="text-xs text-muted" style="max-width: 220px;">\${v.chief_complaint}</td>
            <td class="text-xs">\${v.vitals ? v.vitals.systolic + '/' + v.vitals.diastolic + ' • BMI: ' + v.vitals.bmi : '—'}</td>
            <td style="text-align: right; white-space: nowrap;">
              <a href="/doctor/consultations?patient_id=\${v.patient_id}" class="btn btn-outline btn-sm" title="Open in Workspace"><i class="fa-solid fa-stethoscope text-primary"></i> Open Chart</a>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      tbody.innerHTML = \`<tr><td colspan="7" class="text-center text-danger">Error: \${err.message}</td></tr>\`;
    }
  }
</script>
`;

const docPrescriptionsContent = `
<div class="grid-4-col" style="margin-bottom: var(--space-4);">
  <div class="card" style="padding: var(--space-4); border-left: 4px solid var(--color-primary);">
    <div class="text-xs text-muted font-bold text-uppercase">Total Prescriptions</div>
    <div class="text-2xl font-extrabold text-navy" id="rx-stat-total">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #16a34a;">
    <div class="text-xs text-muted font-bold text-uppercase">Finalized & Dispatched</div>
    <div class="text-2xl font-extrabold text-success" id="rx-stat-final">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #f59e0b;">
    <div class="text-xs text-muted font-bold text-uppercase">Draft Prescriptions</div>
    <div class="text-2xl font-extrabold text-warning" id="rx-stat-draft">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #7c3aed;">
    <div class="text-xs text-muted font-bold text-uppercase">Active Formularies</div>
    <div class="text-2xl font-extrabold" style="color: #7c3aed;" id="rx-stat-meds">0</div>
  </div>
</div>

<div class="card" style="margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-3) var(--space-4);">
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto auto; gap: var(--space-3); align-items: center;">
      <div style="position: relative;">
        <input type="text" id="rx-search" class="form-input" placeholder="Search Rx #, Patient, Diagnosis..." style="padding-left: 2rem;">
        <i class="fa-solid fa-magnifying-glass text-muted" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);"></i>
      </div>
      <div>
        <select id="rx-status-filter" class="form-select" onchange="loadPrescriptionList()">
          <option value="all">All Order Statuses</option>
          <option value="draft">Drafts (Editable)</option>
          <option value="finalized">Finalized (Locked)</option>
          <option value="dispensed">Dispensed (Pharmacy)</option>
        </select>
      </div>
      <div>
        <select id="rx-patient-filter" class="form-select" onchange="loadPrescriptionList()">
          <option value="">All Patients</option>
        </select>
      </div>
      <div>
        <button class="btn btn-outline btn-sm" onclick="loadPrescriptionList()"><i class="fa-solid fa-rotate-right"></i> Refresh</button>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" onclick="openNewRxModal()"><i class="fa-solid fa-plus"></i> + New Prescription</button>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-prescription-bottle-medical text-primary"></i> Master Prescription Orders Archive</h4>
    <span class="badge badge-success" id="rx-count-badge">0 Prescriptions</span>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead>
          <tr>
            <th>Rx Number</th>
            <th>Date</th>
            <th>Patient Details</th>
            <th>Clinical Diagnosis</th>
            <th>Medications Prescribed</th>
            <th>Status</th>
            <th style="text-align: right;">Prescription Actions</th>
          </tr>
        </thead>
        <tbody id="rx-master-tbody">
          <tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Loading prescriptions...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- CREATE / EDIT PRESCRIPTION MODAL (CSS GRID) -->
<div id="modal-prescription-editor" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 850px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;" id="rx-editor-title"><i class="fa-solid fa-file-prescription text-primary"></i> New Prescription Order</h4>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeRxModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
    </div>
    
    <div class="card-body" style="overflow-y: auto; padding: var(--space-4); flex: 1;">
      <input type="hidden" id="edit-rx-id">
      
      <div class="grid-2-col" style="gap: var(--space-3); margin-bottom: var(--space-3);">
        <div class="form-group">
          <label class="form-label font-bold">Select Patient *</label>
          <select id="edit-rx-patient" class="form-select" required onchange="onRxModalPatientChange(this.value)">
            <option value="">-- Choose Patient --</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label font-bold">Prescription Date</label>
          <input type="date" id="edit-rx-date" class="form-input">
        </div>
      </div>

      <!-- ALLERGY ALERT WARNING BANNER -->
      <div id="modal-rx-allergy-alert" style="display: none; background: #fee2e2; border: 1px solid #f87171; border-radius: var(--radius-md); padding: 8px 12px; font-size: 0.8rem; color: #991b1b; margin-bottom: var(--space-3);">
        <i class="fa-solid fa-triangle-exclamation"></i> <strong>PATIENT ALLERGY ALERT:</strong> <span id="modal-rx-allergy-text"></span>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-4);">
        <label class="form-label font-bold">Clinical Diagnosis / Indication *</label>
        <input type="text" id="edit-rx-diagnosis" class="form-input" placeholder="e.g. Stage 1 Hypertension, Acute Pharyngitis..." required>
      </div>

      <!-- DYNAMIC MEDICINE ITEMS (CSS GRID) -->
      <div style="border-top: 1px solid var(--color-slate-200); padding-top: var(--space-3); margin-bottom: var(--space-4);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
          <h5 class="text-xs font-bold text-uppercase" style="margin: 0;"><i class="fa-solid fa-pills text-primary"></i> Prescribed Medicines Formulary</h5>
          <button type="button" class="btn btn-outline btn-sm" onclick="addModalRxItemRow()"><i class="fa-solid fa-plus"></i> Add Medication</button>
        </div>
        <div id="modal-rx-items-container" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <!-- Dynamic Medicine Rows -->
        </div>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold text-xs">Patient Advice & Dietary Instructions</label>
        <textarea id="edit-rx-advice" class="form-textarea" rows="2" placeholder="e.g. Avoid high-sodium meals. Drink plenty of water. Take antibiotic course completely."></textarea>
      </div>

      <div class="form-group">
        <label class="form-label font-bold text-xs">Doctor Clinical Notes (Internal)</label>
        <input type="text" id="edit-rx-doc-notes" class="form-input text-xs" placeholder="Confidential provider notes...">
      </div>

    </div>

    <div class="card-footer" style="background: var(--color-slate-50); display: flex; justify-content: space-between; align-items: center;">
      <button type="button" class="btn btn-outline" onclick="closeRxModal()">Cancel</button>
      <div style="display: flex; gap: var(--space-2);">
        <button type="button" class="btn btn-outline" id="btn-save-draft" onclick="submitRxModal(false)">
          <i class="fa-solid fa-pen-to-square"></i> Save as Draft
        </button>
        <button type="button" class="btn btn-primary" id="btn-save-finalize" onclick="submitRxModal(true)">
          <i class="fa-solid fa-lock"></i> Finalize & Lock Rx
        </button>
      </div>
    </div>
  </div>
</div>

<!-- VIEW & PRINT PRESCRIPTION MODAL (CLINICAL LETTERHEAD) -->
<div id="modal-rx-print-view" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.75); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 780px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-print text-primary"></i> Prescription Order Document</h4>
      <div style="display: flex; gap: var(--space-2);">
        <button type="button" class="btn btn-primary btn-sm" onclick="printPrescriptionDoc()"><i class="fa-solid fa-print"></i> Print Rx</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="closePrintViewModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
      </div>
    </div>

    <div class="card-body" id="printable-rx-document" style="overflow-y: auto; padding: 2.5rem; background: white; color: var(--color-slate-900);">
      
      <!-- HOSPITAL CLINICAL LETTERHEAD -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f766e; padding-bottom: var(--space-3); margin-bottom: var(--space-4);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-hospital" style="font-size: 1.75rem; color: #0f766e;"></i>
            <div>
              <h2 style="margin: 0; font-size: 1.4rem; color: var(--color-navy-900); font-weight: 800;">AURACARE MEDICAL CENTRE</h2>
              <span style="font-size: 0.75rem; color: var(--color-slate-500); letter-spacing: 0.05em; font-weight: 700;">OUTPATIENT CLINICAL DISPENSARY & PHARMACY</span>
            </div>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.75rem; color: var(--color-slate-600);">
          <div>100 Healthcare Boulevard, Suite 400</div>
          <div>Tel: +1 (800) 555-AURA • contact@auracare.com</div>
          <div>Rx License: <strong>HOSP-RX-994182</strong></div>
        </div>
      </div>

      <!-- ATTENDING DOCTOR & ENCOUNTER META -->
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: var(--space-3); background: #f8fafc; padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-slate-200);">
        <div>
          <div style="font-size: 1rem; font-weight: 800; color: var(--color-navy-900);" id="prx-doc-name">Dr. Name</div>
          <div class="text-xs text-muted" id="prx-doc-spec">Specialization • Department</div>
          <div class="text-xs text-muted">License: <code id="prx-doc-lic">DOC-LIC</code></div>
        </div>
        <div style="text-align: right;">
          <div>Prescription Ref: <strong id="prx-number" style="font-size: 1rem; color: #0f766e;">RX-2026-000000</strong></div>
          <div>Date: <strong id="prx-date">2026-08-15</strong></div>
          <div>Status: <span class="badge badge-success" id="prx-status-pill">Finalized</span></div>
        </div>
      </div>

      <!-- PATIENT DEMOGRAPHICS BAR -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 0.8rem; background: #f1f5f9; padding: 10px; border-radius: var(--radius-md); margin-bottom: var(--space-4); border: 1px solid var(--color-slate-200);">
        <div><span class="text-muted">Patient:</span> <strong id="prx-pat-name">Arthur Pendleton</strong></div>
        <div><span class="text-muted">MRN / Code:</span> <code id="prx-pat-code">PAT-0001</code></div>
        <div><span class="text-muted">Age / Gender:</span> <strong id="prx-pat-demog">52 yrs / Male</strong></div>
        <div><span class="text-muted">Blood Group:</span> <strong id="prx-pat-blood">O+</strong></div>
      </div>

      <!-- CRITICAL ALLERGY ALERT IF ANY -->
      <div id="prx-allergy-bar" style="display: none; background: #fee2e2; border: 1px solid #f87171; border-radius: var(--radius-md); padding: 6px 12px; font-size: 0.75rem; color: #991b1b; margin-bottom: var(--space-3);">
        <strong>⚠️ ALLERGY WARNING:</strong> <span id="prx-allergy-text"></span>
      </div>

      <div style="margin-bottom: var(--space-4);">
        <span class="text-muted text-xs">Clinical Diagnosis:</span>
        <strong style="display: block; font-size: 0.95rem; color: var(--color-navy-900);" id="prx-diagnosis">Diagnosis text</strong>
      </div>

      <!-- RX SYMBOL & MEDICINES TABLE -->
      <div style="margin-bottom: var(--space-4);">
        <div style="font-family: serif; font-size: 2.2rem; font-weight: bold; color: #0f766e; line-height: 1; margin-bottom: 4px;">&#8478;</div>
        <table class="table-modern" style="width: 100%; border: 1px solid var(--color-slate-200); font-size: 0.8rem;">
          <thead style="background: #f8fafc;">
            <tr>
              <th>#</th>
              <th>Medication & Generic Name</th>
              <th>Dosage</th>
              <th>Frequency & Route</th>
              <th>Duration</th>
              <th>Quantity</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody id="prx-items-tbody">
            <!-- Dynamic Printable Lines -->
          </tbody>
        </table>
      </div>

      <!-- ADVICE & NOTES -->
      <div id="prx-advice-box" style="background: #fafaf9; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 10px 14px; font-size: 0.8rem; margin-bottom: 3rem;">
        <strong>Patient Instructions / Advice:</strong>
        <p id="prx-advice-text" style="margin: 4px 0 0 0; color: var(--color-slate-700);"></p>
      </div>

      <!-- SIGNATURE BLOCK & STAMP -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1rem; border-top: 1px dashed var(--color-slate-300);">
        <div class="text-xs text-muted">
          <div>This digital prescription is electronically signed and secured.</div>
          <div>Dispense strictly in accordance with regulatory pharmacy standards.</div>
        </div>
        <div style="text-align: center; width: 220px;">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 1.4rem; color: #0f766e; border-bottom: 1px solid var(--color-slate-400); padding-bottom: 4px;" id="prx-sig-doctor">Dr. Doctor Signature</div>
          <div class="text-xs font-bold" style="margin-top: 4px;">Authorized Attending Physician</div>
        </div>
      </div>

    </div>
  </div>
</div>

<script>
  let allAvailableMeds = [];
  let allPatientsRegistry = [];
  let currentEditingRx = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await Auth.guardPage(["doctor","super_admin","hospital_admin"]);
    loadPrescriptionStats();
    loadMedsAndPatients();
    loadPrescriptionList();

    document.getElementById('rx-search').addEventListener('input', () => {
      loadPrescriptionList();
    });
  });

  async function loadPrescriptionStats() {
    try {
      const res = await API.get('/prescriptions/stats');
      if (res.success && res.data) {
        document.getElementById('rx-stat-total').textContent = res.data.total || 0;
        document.getElementById('rx-stat-final').textContent = res.data.finalized_count || 0;
        document.getElementById('rx-stat-draft').textContent = res.data.draft_count || 0;
        document.getElementById('rx-stat-meds').textContent = res.data.active_medicines || 0;
      }
    } catch (_) {}
  }

  async function loadMedsAndPatients() {
    try {
      const [medRes, patRes] = await Promise.all([
        API.get('/prescriptions/medicines'),
        API.get('/patients', { limit: 100 })
      ]);

      if (medRes.success && medRes.data) allAvailableMeds = medRes.data;

      if (patRes.success && patRes.data) {
        allPatientsRegistry = patRes.data;
        const filterSelect = document.getElementById('rx-patient-filter');
        const modalSelect = document.getElementById('edit-rx-patient');
        allPatientsRegistry.forEach(p => {
          filterSelect.innerHTML += \`<option value="\${p.id}">\${p.first_name} \${p.last_name} (\${p.patient_code})</option>\`;
          modalSelect.innerHTML += \`<option value="\${p.id}">\${p.first_name} \${p.last_name} (\${p.patient_code}) - \${p.phone}</option>\`;
        });
      }
    } catch (_) {}
  }

  async function loadPrescriptionList() {
    const tbody = document.getElementById('rx-master-tbody');
    try {
      const params = {
        search: document.getElementById('rx-search').value.trim() || undefined,
        status: document.getElementById('rx-status-filter').value,
        patient_id: document.getElementById('rx-patient-filter').value || undefined,
        limit: 50
      };

      const res = await API.get('/prescriptions', params);
      if (res.success && res.data) {
        document.getElementById('rx-count-badge').textContent = res.data.length + ' Prescriptions';

        if (res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">No prescription orders matching filter criteria.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        res.data.forEach(po => {
          const tr = document.createElement('tr');
          const isDraft = po.status === 'draft';

          tr.innerHTML = \`
            <td><code class="font-bold">\${po.prescription_number}</code></td>
            <td><strong>\${po.prescription_date}</strong></td>
            <td>
              <strong>\${po.patient_name}</strong><br>
              <span class="text-xs text-muted"><code>\${po.patient_code}</code> • \${po.patient_gender}</span>
            </td>
            <td><strong class="text-primary">\${po.diagnosis || 'Clinical Prescription'}</strong></td>
            <td><span class="badge badge-light">\${po.items_count} Medication(s)</span></td>
            <td><span class="badge status-badge-\${po.status}">\${po.status.toUpperCase()}</span></td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-primary btn-sm" onclick="openPrintViewModal(\${po.id})" title="View & Print"><i class="fa-solid fa-print"></i> View / Print</button>
              \${isDraft ? \`
                <button class="btn btn-outline btn-sm" onclick="editPrescriptionModal(\${po.id})" title="Edit Draft"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-success btn-sm" onclick="finalizePrescriptionOrder(\${po.id})" title="Finalize & Lock"><i class="fa-solid fa-lock"></i></button>
              \` : ''}
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      tbody.innerHTML = \`<tr><td colspan="7" class="text-center text-danger" style="padding: var(--space-6);">Error: \${err.message}</td></tr>\`;
    }
  }

  function openNewRxModal() {
    currentEditingRx = null;
    document.getElementById('edit-rx-id').value = '';
    document.getElementById('rx-editor-title').innerHTML = '<i class="fa-solid fa-file-prescription text-primary"></i> New Prescription Order';
    document.getElementById('edit-rx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('edit-rx-patient').value = '';
    document.getElementById('edit-rx-diagnosis').value = '';
    document.getElementById('edit-rx-advice').value = '';
    document.getElementById('edit-rx-doc-notes').value = '';
    document.getElementById('modal-rx-allergy-alert').style.display = 'none';
    document.getElementById('modal-rx-items-container').innerHTML = '';
    addModalRxItemRow();
    document.getElementById('modal-prescription-editor').style.display = 'flex';
  }

  function closeRxModal() {
    document.getElementById('modal-prescription-editor').style.display = 'none';
  }

  function onRxModalPatientChange(patId) {
    if (!patId) {
      document.getElementById('modal-rx-allergy-alert').style.display = 'none';
      return;
    }
    const pat = allPatientsRegistry.find(p => p.id == patId);
    if (pat && pat.allergies && pat.allergies.trim().length > 0 && !pat.allergies.toLowerCase().includes('nkda')) {
      document.getElementById('modal-rx-allergy-text').textContent = pat.allergies;
      document.getElementById('modal-rx-allergy-alert').style.display = 'block';
    } else {
      document.getElementById('modal-rx-allergy-alert').style.display = 'none';
    }
  }

  function addModalRxItemRow(prefill = {}) {
    const container = document.getElementById('modal-rx-items-container');
    const row = document.createElement('div');
    row.className = 'rx-modal-item-row';
    row.style.cssText = 'background: #f8fafc; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 6px;';

    let medOptions = '<option value="">-- Choose Medicine from Formulary or Enter Below --</option>';
    allAvailableMeds.forEach(m => {
      medOptions += \`<option value="\${m.id}" data-name="\${m.name}" data-generic="\${m.generic_name}" data-strength="\${m.strength}">\${m.name} (\${m.generic_name} - \${m.strength})</option>\`;
    });

    row.innerHTML = \`
      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 6px; align-items: center;">
        <select class="form-select text-xs rx-med-select" onchange="onMedSelectChange(this)">
          \${medOptions}
        </select>
        <input type="text" class="form-input text-xs rx-custom-name" placeholder="Medicine Name *" value="\${prefill.medicine_name || ''}" required>
        <input type="text" class="form-input text-xs rx-generic" placeholder="Generic Name" value="\${prefill.generic_name || ''}">
        <input type="text" class="form-input text-xs rx-dosage" placeholder="Dosage (500mg) *" value="\${prefill.dosage || ''}" required>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.rx-modal-item-row').remove()" style="padding: 4px 8px;">&times;</button>
      </div>
      <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 2fr; gap: 6px; align-items: center;">
        <select class="form-select text-xs rx-freq">
          <option value="Once daily (OD)">Once daily (OD)</option>
          <option value="Twice daily (BD)">Twice daily (BD)</option>
          <option value="Thrice daily (TDS)">Thrice daily (TDS)</option>
          <option value="Four times daily (QDS)">Four times daily (QDS)</option>
          <option value="Every 8 hours">Every 8 hours</option>
          <option value="As needed (PRN)">As needed (PRN)</option>
          <option value="At bedtime">At bedtime</option>
        </select>
        <select class="form-select text-xs rx-route">
          <option value="Oral">Oral</option>
          <option value="Intravenous">Intravenous</option>
          <option value="Intramuscular">Intramuscular</option>
          <option value="Inhalation">Inhalation</option>
          <option value="Topical">Topical</option>
          <option value="Sublingual">Sublingual</option>
          <option value="Ophthalmic">Ophthalmic</option>
          <option value="Otic">Otic</option>
        </select>
        <input type="text" class="form-input text-xs rx-dur" placeholder="Duration (7 days) *" value="\${prefill.duration || '7 days'}" required>
        <input type="text" class="form-input text-xs rx-qty" placeholder="Quantity (14 Tabs)" value="\${prefill.quantity || ''}">
        <input type="text" class="form-input text-xs rx-inst" placeholder="Instructions (after meals)" value="\${prefill.instructions || ''}">
      </div>
    \`;

    container.appendChild(row);
    if (prefill.medicine_id) {
      row.querySelector('.rx-med-select').value = prefill.medicine_id;
    }
    if (prefill.frequency) {
      row.querySelector('.rx-freq').value = prefill.frequency;
    }
    if (prefill.route) {
      row.querySelector('.rx-route').value = prefill.route;
    }
  }

  function onMedSelectChange(selectElem) {
    const row = selectElem.closest('.rx-modal-item-row');
    const opt = selectElem.selectedOptions[0];
    if (opt && opt.value) {
      row.querySelector('.rx-custom-name').value = opt.getAttribute('data-name');
      row.querySelector('.rx-generic').value = opt.getAttribute('data-generic');
      row.querySelector('.rx-dosage').value = opt.getAttribute('data-strength') || '';
    }
  }

  async function editPrescriptionModal(id) {
    try {
      const res = await API.get('/prescriptions/' + id);
      if (res.success && res.data) {
        const po = res.data;
        currentEditingRx = po;

        document.getElementById('edit-rx-id').value = po.id;
        document.getElementById('rx-editor-title').innerHTML = \`<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Draft Prescription (\${po.prescription_number})\`;
        document.getElementById('edit-rx-date').value = po.prescription_date;
        document.getElementById('edit-rx-patient').value = po.patient_id;
        onRxModalPatientChange(po.patient_id);
        document.getElementById('edit-rx-diagnosis').value = po.diagnosis || '';
        document.getElementById('edit-rx-advice').value = po.patient_advice || '';
        document.getElementById('edit-rx-doc-notes').value = po.doctor_notes || '';

        const container = document.getElementById('modal-rx-items-container');
        container.innerHTML = '';
        if (po.items && po.items.length > 0) {
          po.items.forEach(it => addModalRxItemRow(it));
        } else {
          addModalRxItemRow();
        }

        document.getElementById('modal-prescription-editor').style.display = 'flex';
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load prescription.');
    }
  }

  async function submitRxModal(finalize = false) {
    const patId = document.getElementById('edit-rx-patient').value;
    const diagnosis = document.getElementById('edit-rx-diagnosis').value.trim();

    if (!patId || !diagnosis) {
      Toast.warning('Please select patient and specify clinical diagnosis.');
      return;
    }

    const rows = document.querySelectorAll('.rx-modal-item-row');
    const items = [];
    rows.forEach(r => {
      const medId = r.querySelector('.rx-med-select').value;
      const medName = r.querySelector('.rx-custom-name').value.trim();
      const generic = r.querySelector('.rx-generic').value.trim();
      const dosage = r.querySelector('.rx-dosage').value.trim();
      const freq = r.querySelector('.rx-freq').value;
      const route = r.querySelector('.rx-route').value;
      const dur = r.querySelector('.rx-dur').value.trim();
      const qty = r.querySelector('.rx-qty').value.trim();
      const inst = r.querySelector('.rx-inst').value.trim();

      if (medName && dosage && dur) {
        items.push({
          medicine_id: medId ? parseInt(medId, 10) : undefined,
          medicine_name: medName,
          generic_name: generic || undefined,
          dosage,
          frequency: freq,
          route,
          duration: dur,
          quantity: qty || undefined,
          instructions: inst || undefined
        });
      }
    });

    if (items.length === 0) {
      Toast.warning('Please add at least one valid medication item with dosage and duration.');
      return;
    }

    const payload = {
      patient_id: parseInt(patId, 10),
      prescription_date: document.getElementById('edit-rx-date').value || undefined,
      diagnosis,
      patient_advice: document.getElementById('edit-rx-advice').value.trim() || undefined,
      doctor_notes: document.getElementById('edit-rx-doc-notes').value.trim() || undefined,
      status: finalize ? 'finalized' : 'draft',
      items
    };

    const editId = document.getElementById('edit-rx-id').value;

    try {
      let res = null;
      if (editId) {
        res = await API.put('/prescriptions/' + editId, payload);
      } else {
        res = await API.post('/prescriptions', payload);
      }

      if (res.success) {
        Toast.success(res.message);
        closeRxModal();
        loadPrescriptionStats();
        loadPrescriptionList();
      } else {
        Toast.error(res.message || 'Prescription save failed.');
      }
    } catch (err) {
      Toast.error(err.message || 'Server error.');
    }
  }

  async function finalizePrescriptionOrder(id) {
    if (!confirm('Are you sure you want to finalize this prescription? Once finalized, the order is locked and dispatched to the pharmacy.')) return;

    try {
      const res = await API.patch('/prescriptions/' + id + '/finalize');
      if (res.success) {
        Toast.success(res.message);
        loadPrescriptionStats();
        loadPrescriptionList();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to finalize prescription.');
    }
  }

  async function openPrintViewModal(id) {
    try {
      const res = await API.get('/prescriptions/' + id);
      if (res.success && res.data) {
        const po = res.data;
        document.getElementById('prx-doc-name').textContent = 'Dr. ' + po.doctor_name;
        document.getElementById('prx-doc-spec').textContent = (po.doctor_specialization || 'Clinical Specialist') + ' • ' + (po.department_name || 'Hospital Department');
        document.getElementById('prx-doc-lic').textContent = po.doctor_license || 'LIC-REG-2026';
        document.getElementById('prx-sig-doctor').textContent = 'Dr. ' + po.doctor_name;

        document.getElementById('prx-number').textContent = po.prescription_number;
        document.getElementById('prx-date').textContent = po.prescription_date;
        document.getElementById('prx-status-pill').textContent = po.status.toUpperCase();

        document.getElementById('prx-pat-name').textContent = po.patient_name;
        document.getElementById('prx-pat-code').textContent = po.patient_code;
        document.getElementById('prx-pat-demog').textContent = (po.patient_age ? po.patient_age + ' yrs' : 'Age N/A') + ' / ' + po.patient_gender;
        document.getElementById('prx-pat-blood').textContent = po.patient_blood_group || 'Unknown';

        const allergyBar = document.getElementById('prx-allergy-bar');
        if (po.patient_allergies && po.patient_allergies.trim().length > 0 && !po.patient_allergies.toLowerCase().includes('nkda')) {
          document.getElementById('prx-allergy-text').textContent = po.patient_allergies;
          allergyBar.style.display = 'block';
        } else {
          allergyBar.style.display = 'none';
        }

        document.getElementById('prx-diagnosis').textContent = po.diagnosis || 'Clinical Outpatient Encounter';
        document.getElementById('prx-advice-text').textContent = po.patient_advice || 'Take prescribed medications strictly according to directions. Complete full course.';

        const tbody = document.getElementById('prx-items-tbody');
        tbody.innerHTML = '';
        if (po.items && po.items.length > 0) {
          po.items.forEach((it, idx) => {
            tbody.innerHTML += \`
              <tr>
                <td><strong>\${idx + 1}</strong></td>
                <td>
                  <strong>\${it.medicine_name}</strong>
                  \${it.generic_name ? \`<div class="text-xs text-muted">\${it.generic_name}</div>\` : ''}
                </td>
                <td><strong>\${it.dosage}</strong></td>
                <td>\${it.frequency} (\${it.route || 'Oral'})</td>
                <td>\${it.duration}</td>
                <td>\${it.quantity || '—'}</td>
                <td class="text-xs">\${it.instructions || 'Standard dosing'}</td>
              </tr>
            \`;
          });
        }

        document.getElementById('modal-rx-print-view').style.display = 'flex';
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load printable prescription.');
    }
  }

  function closePrintViewModal() {
    document.getElementById('modal-rx-print-view').style.display = 'none';
  }

  function printPrescriptionDoc() {
    const printContents = document.getElementById('printable-rx-document').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(\`
      <html>
        <head>
          <title>Prescription - AuraCare Medical Centre</title>
          <link rel="stylesheet" href="/css/main.css">
          <style>
            body { background: white; color: black; padding: 20px; font-family: Outfit, sans-serif; }
            @media print {
              body { padding: 0; }
              @page { margin: 15mm; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          \${printContents}
        </body>
      </html>
    \`);
    printWindow.document.close();
  }
</script>
`;

const docLabOrdersContent = `
<div class="grid-4-col" style="margin-bottom: var(--space-4);">
  <div class="card" style="padding: var(--space-4); border-left: 4px solid var(--color-primary);">
    <div class="text-xs text-muted font-bold text-uppercase">Total Lab Requisitions</div>
    <div class="text-2xl font-extrabold text-navy" id="lab-stat-total">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #f59e0b;">
    <div class="text-xs text-muted font-bold text-uppercase">Pending Sample Collection</div>
    <div class="text-2xl font-extrabold text-warning" id="lab-stat-ordered">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #0284c7;">
    <div class="text-xs text-muted font-bold text-uppercase">In Analytical Processing</div>
    <div class="text-2xl font-extrabold text-info" id="lab-stat-proc">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #16a34a;">
    <div class="text-xs text-muted font-bold text-uppercase">Verified & Released Reports</div>
    <div class="text-2xl font-extrabold text-success" id="lab-stat-verified">0</div>
  </div>
</div>

<div class="card" style="margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-3) var(--space-4);">
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto auto; gap: var(--space-3); align-items: center;">
      <div style="position: relative;">
        <input type="text" id="lab-search" class="form-input" placeholder="Search Order #, Patient, Test..." style="padding-left: 2rem;">
        <i class="fa-solid fa-magnifying-glass text-muted" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);"></i>
      </div>
      <div>
        <select id="lab-status-filter" class="form-select" onchange="loadLabOrdersList()">
          <option value="all">All Workflow Statuses</option>
          <option value="ordered">Ordered (Awaiting Sample)</option>
          <option value="sample_collected">Sample Collected</option>
          <option value="processing">In Processing</option>
          <option value="completed">Completed (Pending Verification)</option>
          <option value="verified">Verified & Released</option>
        </select>
      </div>
      <div>
        <select id="lab-priority-filter" class="form-select" onchange="loadLabOrdersList()">
          <option value="all">All Priorities</option>
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT (Critical)</option>
        </select>
      </div>
      <div>
        <select id="lab-patient-filter" class="form-select" onchange="loadLabOrdersList()">
          <option value="">All Patients</option>
        </select>
      </div>
      <div>
        <button class="btn btn-outline btn-sm" onclick="loadLabOrdersList()"><i class="fa-solid fa-rotate-right"></i> Refresh</button>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" onclick="openNewLabOrderModal()"><i class="fa-solid fa-plus"></i> + New Lab Order</button>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-vials text-primary"></i> Diagnostic Laboratory Requisitions & Reports</h4>
    <span class="badge badge-success" id="lab-count-badge">0 Orders</span>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date & Priority</th>
            <th>Patient Details</th>
            <th>Diagnostic Tests Included</th>
            <th>Sample Type</th>
            <th>Status</th>
            <th style="text-align: right;">Clinical Actions</th>
          </tr>
        </thead>
        <tbody id="lab-master-tbody">
          <tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Loading laboratory requisitions...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- CREATE NEW LAB REQUISITION MODAL (CSS GRID) -->
<div id="modal-lab-order-builder" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 850px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-flask-vial text-primary"></i> New Diagnostic Laboratory Requisition</h4>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeLabOrderModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
    </div>
    
    <div class="card-body" style="overflow-y: auto; padding: var(--space-4); flex: 1;">
      <div class="grid-3-col" style="gap: var(--space-3); margin-bottom: var(--space-3);">
        <div class="form-group">
          <label class="form-label font-bold">Select Patient *</label>
          <select id="nlab-patient" class="form-select" required onchange="onLabModalPatientChange(this.value)">
            <option value="">-- Choose Patient --</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label font-bold">Requisition Priority</label>
          <select id="nlab-priority" class="form-select font-bold">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT (Critical Emergency)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label font-bold">Order Date</label>
          <input type="date" id="nlab-date" class="form-input">
        </div>
      </div>

      <!-- ALLERGY ALERT WARNING BANNER -->
      <div id="modal-lab-allergy-alert" style="display: none; background: #fee2e2; border: 1px solid #f87171; border-radius: var(--radius-md); padding: 8px 12px; font-size: 0.8rem; color: #991b1b; margin-bottom: var(--space-3);">
        <i class="fa-solid fa-triangle-exclamation"></i> <strong>PATIENT ALLERGY WARNING:</strong> <span id="modal-lab-allergy-text"></span>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-4);">
        <label class="form-label font-bold">Clinical Indication / Reason for Requisition</label>
        <input type="text" id="nlab-notes" class="form-input" placeholder="e.g. Routine metabolic surveillance, suspected thyroid dysfunction...">
      </div>

      <!-- DYNAMIC LAB TESTS CATALOG SELECTION (CSS GRID) -->
      <div style="border-top: 1px solid var(--color-slate-200); padding-top: var(--space-3); margin-bottom: var(--space-3);">
        <h5 class="text-xs font-bold text-uppercase" style="margin-bottom: var(--space-2);"><i class="fa-solid fa-list-check text-primary"></i> Select Diagnostic Tests / Panels *</h5>
        <div id="nlab-tests-catalog-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); max-height: 250px; overflow-y: auto; padding: 4px;">
          <!-- Dynamic Test Checkboxes -->
        </div>
      </div>

    </div>

    <div class="card-footer" style="background: var(--color-slate-50); display: flex; justify-content: space-between; align-items: center;">
      <button type="button" class="btn btn-outline" onclick="closeLabOrderModal()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="submitNewLabOrder()">
        <i class="fa-solid fa-paper-plane"></i> Submit Lab Requisition
      </button>
    </div>
  </div>
</div>

<!-- MULTI-PARAMETER RESULT ENTRY MODAL (CSS GRID) -->
<div id="modal-lab-result-entry" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 900px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;" id="lre-title"><i class="fa-solid fa-flask-vial text-primary"></i> Enter Laboratory Diagnostic Results</h4>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeResultEntryModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
    </div>

    <div class="card-body" style="overflow-y: auto; padding: var(--space-4); flex: 1;">
      <input type="hidden" id="lre-order-id">
      
      <div style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-slate-200); margin-bottom: var(--space-3); display: flex; justify-content: space-between; font-size: 0.85rem;">
        <div>Patient: <strong id="lre-pat-name">Patient Name</strong> (<code id="lre-pat-code">PAT-0001</code>)</div>
        <div>Order: <strong id="lre-order-num" class="text-primary">LAB-2026-0000</strong></div>
      </div>

      <div style="margin-bottom: var(--space-3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
          <h5 class="text-xs font-bold text-uppercase" style="margin: 0;">Multi-Parameter Test Results Table</h5>
          <button type="button" class="btn btn-outline btn-sm" onclick="addLreResultRow()"><i class="fa-solid fa-plus"></i> Add Parameter</button>
        </div>
        <div id="lre-parameters-container" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Parameter Rows -->
        </div>
      </div>

      <div class="form-group">
        <label class="form-label font-bold text-xs">Pathologist Overall Clinical Interpretation & Notes</label>
        <textarea id="lre-notes" class="form-textarea" rows="2" placeholder="Clinical interpretation of findings..."></textarea>
      </div>

    </div>

    <div class="card-footer" style="background: var(--color-slate-50); display: flex; justify-content: space-between; align-items: center;">
      <button type="button" class="btn btn-outline" onclick="closeResultEntryModal()">Cancel</button>
      <div style="display: flex; gap: var(--space-2);">
        <button type="button" class="btn btn-outline" onclick="submitLabResults(false)">
          <i class="fa-solid fa-floppy-disk"></i> Save Results (Draft)
        </button>
        <button type="button" class="btn btn-success" onclick="submitLabResults(true)">
          <i class="fa-solid fa-circle-check"></i> Save & Verify Report
        </button>
      </div>
    </div>
  </div>
</div>

<!-- VIEW & PRINT OFFICIAL LABORATORY REPORT MODAL -->
<div id="modal-lab-print-view" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.75); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 820px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-print text-primary"></i> Official Diagnostic Laboratory Report</h4>
      <div style="display: flex; gap: var(--space-2);">
        <button type="button" class="btn btn-primary btn-sm" onclick="printLabDoc()"><i class="fa-solid fa-print"></i> Print Report</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeLabPrintModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
      </div>
    </div>

    <div class="card-body" id="printable-lab-report-doc" style="overflow-y: auto; padding: 2.5rem; background: white; color: var(--color-slate-900);">
      <!-- Letterhead -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f766e; padding-bottom: var(--space-3); margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-flask-vial" style="font-size: 1.75rem; color: #0f766e;"></i>
          <div>
            <h2 style="margin: 0; font-size: 1.4rem; color: var(--color-navy-900); font-weight: 800;">AURACARE PATHOLOGY LABS</h2>
            <span style="font-size: 0.75rem; color: var(--color-slate-500); letter-spacing: 0.05em; font-weight: 700;">CAP & ISO 15189 ACCREDITED CLINICAL LABORATORY</span>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.75rem; color: var(--color-slate-600);">
          <div>Accreditation #: <strong>CLIA-99824-AURA</strong></div>
          <div>100 Healthcare Boulevard, Lab Wing 2</div>
          <div>Tel: +1 (800) 555-AURA • lab@auracare.com</div>
        </div>
      </div>

      <!-- Report Metadata Header -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.8rem; background: #f8fafc; padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-slate-200); margin-bottom: var(--space-3);">
        <div>
          <div>Order Ref: <strong id="lrp-order-num" style="color: #0f766e; font-size: 0.95rem;">LAB-2026-0000</strong></div>
          <div>Ordering Doctor: <strong id="lrp-doc-name">Dr. Specialist</strong></div>
          <div>Department: <span id="lrp-doc-dept">Cardiology</span></div>
        </div>
        <div>
          <div>Sample Type: <strong id="lrp-sample-type">Whole Blood (EDTA)</strong></div>
          <div>Collected: <span id="lrp-collected-at">2026-08-15 10:00</span></div>
          <div>Status: <span class="badge badge-success" id="lrp-status-pill">VERIFIED</span></div>
        </div>
        <div style="text-align: right;">
          <div>Order Date: <strong id="lrp-order-date">2026-08-15</strong></div>
          <div>Verified At: <strong id="lrp-verified-at">2026-08-15 14:00</strong></div>
          <div>Verified By: <span id="lrp-verified-by">Chief Pathologist</span></div>
        </div>
      </div>

      <!-- Patient Demographics Bar -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 0.8rem; background: #f1f5f9; padding: 10px; border-radius: var(--radius-md); margin-bottom: var(--space-4); border: 1px solid var(--color-slate-200);">
        <div><span class="text-muted">Patient:</span> <strong id="lrp-pat-name">Arthur Pendleton</strong></div>
        <div><span class="text-muted">MRN:</span> <code id="lrp-pat-code">PAT-0001</code></div>
        <div><span class="text-muted">Age / Gender:</span> <strong id="lrp-pat-demog">52 yrs / Male</strong></div>
        <div><span class="text-muted">Blood Group:</span> <strong id="lrp-pat-blood">O+</strong></div>
      </div>

      <!-- Tests Ordered Title -->
      <div style="margin-bottom: var(--space-3);">
        <span class="text-muted text-xs">Diagnostic Panels / Procedures:</span>
        <div id="lrp-panels-chips" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
          <!-- Test badges -->
        </div>
      </div>

      <!-- Results Table -->
      <div style="margin-bottom: var(--space-4);">
        <table class="table-modern" style="width: 100%; border: 1px solid var(--color-slate-200); font-size: 0.8rem;">
          <thead style="background: #f8fafc;">
            <tr>
              <th>#</th>
              <th>Test Parameter</th>
              <th>Observed Result</th>
              <th>Unit</th>
              <th>Reference Interval</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody id="lrp-results-tbody">
            <!-- Dynamic Printable Lines -->
          </tbody>
        </table>
      </div>

      <!-- Pathologist Notes -->
      <div id="lrp-notes-box" style="background: #fafaf9; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 10px 14px; font-size: 0.8rem; margin-bottom: 2.5rem;">
        <strong>Pathologist Clinical Notes:</strong>
        <p id="lrp-notes-text" style="margin: 4px 0 0 0; color: var(--color-slate-700);"></p>
      </div>

      <!-- Verification Stamp & Signatures -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1rem; border-top: 1px dashed var(--color-slate-300); font-size: 0.75rem; color: var(--color-slate-500);">
        <div>
          <div>Electronically verified and authorized for clinical release.</div>
          <div>Report generated from AuraCare LIS Core Engine.</div>
        </div>
        <div style="text-align: center; width: 220px;">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 1.4rem; color: #0f766e; border-bottom: 1px solid var(--color-slate-400); padding-bottom: 4px;" id="lrp-sig-name">Dr. Chief Pathologist</div>
          <div class="text-xs font-bold" style="margin-top: 4px;">Verified Consultant Pathologist</div>
        </div>
      </div>

    </div>
  </div>
</div>

<script>
  let allAvailableLabTests = [];
  let allPatientsList = [];

  document.addEventListener('DOMContentLoaded', async () => {
    await Auth.guardPage(["doctor","super_admin","hospital_admin"]);
    loadLabStats();
    loadCatalogAndPatients();
    loadLabOrdersList();

    document.getElementById('lab-search').addEventListener('input', () => {
      loadLabOrdersList();
    });
  });

  async function loadLabStats() {
    try {
      const res = await API.get('/lab/stats');
      if (res.success && res.data) {
        document.getElementById('lab-stat-total').textContent = res.data.total_orders || 0;
        document.getElementById('lab-stat-ordered').textContent = res.data.ordered_count || 0;
        document.getElementById('lab-stat-proc').textContent = res.data.processing_count || 0;
        document.getElementById('lab-stat-verified').textContent = res.data.verified_count || 0;
      }
    } catch (_) {}
  }

  async function loadCatalogAndPatients() {
    try {
      const [testsRes, patRes] = await Promise.all([
        API.get('/lab/tests'),
        API.get('/patients', { limit: 100 })
      ]);

      if (testsRes.success && testsRes.data) {
        allAvailableLabTests = testsRes.data;
        const catalogContainer = document.getElementById('nlab-tests-catalog-grid');
        catalogContainer.innerHTML = '';
        allAvailableLabTests.forEach(t => {
          catalogContainer.innerHTML += \`
            <label style="display: flex; align-items: flex-start; gap: 8px; background: #f8fafc; border: 1px solid var(--color-slate-200); padding: 8px; border-radius: var(--radius-md); cursor: pointer;">
              <input type="checkbox" class="nlab-test-chk" value="\${t.id}" style="margin-top: 3px;">
              <div>
                <strong style="font-size: 0.8rem; display: block;">\${t.name}</strong>
                <span class="text-xs text-muted"><code>\${t.code}</code> • \${t.category || 'Lab'} • <strong>$\${parseFloat(t.price).toFixed(2)}</strong></span>
              </div>
            </label>
          \`;
        });
      }

      if (patRes.success && patRes.data) {
        allPatientsList = patRes.data;
        const filterSelect = document.getElementById('lab-patient-filter');
        const modalSelect = document.getElementById('nlab-patient');
        allPatientsList.forEach(p => {
          filterSelect.innerHTML += \`<option value="\${p.id}">\${p.first_name} \${p.last_name} (\${p.patient_code})</option>\`;
          modalSelect.innerHTML += \`<option value="\${p.id}">\${p.first_name} \${p.last_name} (\${p.patient_code})</option>\`;
        });
      }
    } catch (_) {}
  }

  async function loadLabOrdersList() {
    const tbody = document.getElementById('lab-master-tbody');
    try {
      const params = {
        search: document.getElementById('lab-search').value.trim() || undefined,
        status: document.getElementById('lab-status-filter').value,
        priority: document.getElementById('lab-priority-filter').value,
        patient_id: document.getElementById('lab-patient-filter').value || undefined,
        limit: 50
      };

      const res = await API.get('/lab/orders', params);
      if (res.success && res.data) {
        document.getElementById('lab-count-badge').textContent = res.data.length + ' Orders';

        if (res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">No laboratory requisitions matching filter criteria.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        res.data.forEach(lo => {
          const tr = document.createElement('tr');
          const isOrdered = lo.status === 'ordered';
          const isSample = lo.status === 'sample_collected';
          const isProc = lo.status === 'processing';
          const isComp = lo.status === 'completed';

          tr.innerHTML = \`
            <td><code class="font-bold">\${lo.order_number}</code></td>
            <td>
              <strong>\${lo.order_date}</strong><br>
              <span class="badge \${lo.priority === 'stat' ? 'badge-danger' : (lo.priority === 'urgent' ? 'badge-warning' : 'badge-light')}" style="font-size: 0.65rem; text-transform: uppercase;">\${lo.priority}</span>
            </td>
            <td>
              <strong>\${lo.patient_name}</strong><br>
              <span class="text-xs text-muted"><code>\${lo.patient_code}</code> • \${lo.patient_gender}</span>
            </td>
            <td>
              <span class="badge badge-light">\${lo.items_count || 1} Test(s)</span>
              \${lo.results_count > 0 ? \`<span class="badge badge-info text-xs">\${lo.results_count} Parameters</span>\` : ''}
            </td>
            <td class="text-xs">\${lo.sample_type || 'Venous Blood'}</td>
            <td><span class="badge status-badge-\${lo.status}">\${lo.status.replace('_', ' ').toUpperCase()}</span></td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-primary btn-sm" onclick="openLabPrintViewModal(\${lo.id})" title="View / Print Report"><i class="fa-solid fa-file-medical"></i> Report</button>
              \${isOrdered ? \`
                <button class="btn btn-outline btn-sm" onclick="transitionLabStatus(\${lo.id}, 'sample_collected')" title="Sample Collected"><i class="fa-solid fa-droplet text-primary"></i> Collect</button>
              \` : ''}
              \${(isSample || isProc || isOrdered) ? \`
                <button class="btn btn-warning btn-sm" onclick="openResultEntryModal(\${lo.id})" title="Enter Results"><i class="fa-solid fa-pen-to-square"></i> Results</button>
              \` : ''}
              \${isComp ? \`
                <button class="btn btn-success btn-sm" onclick="verifyLabOrder(\${lo.id})" title="Verify Report"><i class="fa-solid fa-circle-check"></i> Verify</button>
              \` : ''}
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      tbody.innerHTML = \`<tr><td colspan="7" class="text-center text-danger" style="padding: var(--space-6);">Error: \${err.message}</td></tr>\`;
    }
  }

  function openNewLabOrderModal() {
    document.getElementById('nlab-patient').value = '';
    document.getElementById('nlab-priority').value = 'routine';
    document.getElementById('nlab-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('nlab-notes').value = '';
    document.getElementById('modal-lab-allergy-alert').style.display = 'none';
    document.querySelectorAll('.nlab-test-chk').forEach(c => c.checked = false);
    document.getElementById('modal-lab-order-builder').style.display = 'flex';
  }

  function closeLabOrderModal() {
    document.getElementById('modal-lab-order-builder').style.display = 'none';
  }

  function onLabModalPatientChange(patId) {
    if (!patId) {
      document.getElementById('modal-lab-allergy-alert').style.display = 'none';
      return;
    }
    const pat = allPatientsList.find(p => p.id == patId);
    if (pat && pat.allergies && pat.allergies.trim().length > 0 && !pat.allergies.toLowerCase().includes('nkda')) {
      document.getElementById('modal-lab-allergy-text').textContent = pat.allergies;
      document.getElementById('modal-lab-allergy-alert').style.display = 'block';
    } else {
      document.getElementById('modal-lab-allergy-alert').style.display = 'none';
    }
  }

  async function submitNewLabOrder() {
    const patId = document.getElementById('nlab-patient').value;
    if (!patId) {
      Toast.warning('Please select a patient.');
      return;
    }

    const selectedTests = [];
    document.querySelectorAll('.nlab-test-chk:checked').forEach(c => selectedTests.push(parseInt(c.value, 10)));

    if (selectedTests.length === 0) {
      Toast.warning('Please select at least one laboratory diagnostic test.');
      return;
    }

    const payload = {
      patient_id: parseInt(patId, 10),
      priority: document.getElementById('nlab-priority').value,
      order_date: document.getElementById('nlab-date').value || undefined,
      clinical_notes: document.getElementById('nlab-notes').value.trim() || undefined,
      test_ids: selectedTests
    };

    try {
      const res = await API.post('/lab/orders', payload);
      if (res.success) {
        Toast.success(res.message);
        closeLabOrderModal();
        loadLabStats();
        loadLabOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to create order.');
    }
  }

  async function transitionLabStatus(id, newStatus) {
    try {
      const res = await API.patch('/lab/orders/' + id + '/status', { status: newStatus });
      if (res.success) {
        Toast.success(res.message);
        loadLabStats();
        loadLabOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Status transition failed.');
    }
  }

  async function openResultEntryModal(orderId) {
    try {
      const res = await API.get('/lab/orders/' + orderId);
      if (res.success && res.data) {
        const o = res.data;
        document.getElementById('lre-order-id').value = o.id;
        document.getElementById('lre-pat-name').textContent = o.patient_name;
        document.getElementById('lre-pat-code').textContent = o.patient_code;
        document.getElementById('lre-order-num').textContent = o.order_number;
        document.getElementById('lre-notes').value = o.result_notes || '';

        const container = document.getElementById('lre-parameters-container');
        container.innerHTML = '';

        if (o.results && o.results.length > 0) {
          o.results.forEach(r => addLreResultRow(r));
        } else if (o.items && o.items.length > 0) {
          // Preload default parameter templates from test items
          o.items.forEach(it => {
            if (it.default_parameters) {
              try {
                const params = JSON.parse(it.default_parameters);
                params.forEach(p => addLreResultRow({ parameter_name: p.name, unit: p.unit, reference_range: p.ref_range, order_item_id: it.id }));
              } catch (_) {
                addLreResultRow({ parameter_name: it.test_name, order_item_id: it.id });
              }
            } else {
              addLreResultRow({ parameter_name: it.test_name, order_item_id: it.id });
            }
          });
        } else {
          addLreResultRow();
        }

        document.getElementById('modal-lab-result-entry').style.display = 'flex';
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load order for result entry.');
    }
  }

  function closeResultEntryModal() {
    document.getElementById('modal-lab-result-entry').style.display = 'none';
  }

  function addLreResultRow(prefill = {}) {
    const container = document.getElementById('lre-parameters-container');
    const row = document.createElement('div');
    row.className = 'lre-param-row';
    row.style.cssText = 'background: #f8fafc; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 8px; display: grid; grid-template-columns: 2fr 1.2fr 1fr 1.5fr 1fr 2fr auto; gap: 6px; align-items: center;';

    row.innerHTML = \`
      <input type="text" class="form-input text-xs lre-name" placeholder="Parameter Name *" value="\${prefill.parameter_name || ''}" required>
      <input type="text" class="form-input text-xs lre-val font-bold" placeholder="Measured Value *" value="\${prefill.result_value || ''}" required>
      <input type="text" class="form-input text-xs lre-unit" placeholder="Unit (mg/dL)" value="\${prefill.unit || ''}">
      <input type="text" class="form-input text-xs lre-ref font-mono" placeholder="Ref Range (70-99)" value="\${prefill.reference_range || ''}">
      <select class="form-select text-xs lre-flag">
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="low">Low</option>
        <option value="critical">Critical</option>
      </select>
      <input type="text" class="form-input text-xs lre-comm" placeholder="Interpretation / Comments" value="\${prefill.comments || ''}">
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.lre-param-row').remove()" style="padding: 4px 8px;">&times;</button>
    \`;

    container.appendChild(row);
    if (prefill.flag) row.querySelector('.lre-flag').value = prefill.flag;
  }

  async function submitLabResults(verify = false) {
    const orderId = document.getElementById('lre-order-id').value;
    const rows = document.querySelectorAll('.lre-param-row');
    const results = [];

    rows.forEach(r => {
      const name = r.querySelector('.lre-name').value.trim();
      const val = r.querySelector('.lre-val').value.trim();
      const unit = r.querySelector('.lre-unit').value.trim();
      const ref = r.querySelector('.lre-ref').value.trim();
      const flag = r.querySelector('.lre-flag').value;
      const comm = r.querySelector('.lre-comm').value.trim();

      if (name && val) {
        results.push({
          parameter_name: name,
          result_value: val,
          unit: unit || undefined,
          reference_range: ref || undefined,
          flag,
          comments: comm || undefined
        });
      }
    });

    if (results.length === 0) {
      Toast.warning('Please enter at least one parameter with name and value.');
      return;
    }

    const payload = {
      status: verify ? 'verified' : 'completed',
      result_notes: document.getElementById('lre-notes').value.trim() || undefined,
      results
    };

    try {
      const res = await API.post('/lab/orders/' + orderId + '/results', payload);
      if (res.success) {
        Toast.success(res.message);
        closeResultEntryModal();
        loadLabStats();
        loadLabOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to save results.');
    }
  }

  async function verifyLabOrder(orderId) {
    try {
      const res = await API.patch('/lab/orders/' + orderId + '/verify');
      if (res.success) {
        Toast.success(res.message);
        loadLabStats();
        loadLabOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Verification failed.');
    }
  }

  async function openLabPrintViewModal(orderId) {
    try {
      const res = await API.get('/lab/orders/' + orderId);
      if (res.success && res.data) {
        const o = res.data;
        document.getElementById('lrp-order-num').textContent = o.order_number;
        document.getElementById('lrp-doc-name').textContent = 'Dr. ' + (o.doctor_name || 'Specialist');
        document.getElementById('lrp-doc-dept').textContent = o.department_name || 'Hospital Department';
        document.getElementById('lrp-sample-type').textContent = o.sample_type || 'Venous Blood';
        document.getElementById('lrp-collected-at').textContent = o.sample_collected_at ? o.sample_collected_at.substring(0, 16).replace('T', ' ') : '—';
        document.getElementById('lrp-status-pill').textContent = o.status.toUpperCase();
        document.getElementById('lrp-order-date').textContent = o.order_date;
        document.getElementById('lrp-verified-at').textContent = o.verified_at ? o.verified_at.substring(0, 16).replace('T', ' ') : 'Pending';
        document.getElementById('lrp-verified-by').textContent = o.verified_by_name || 'Attending Pathologist';
        document.getElementById('lrp-sig-name').textContent = o.verified_by_name ? 'Dr. ' + o.verified_by_name : 'Dr. ' + (o.doctor_name || 'Physician');

        document.getElementById('lrp-pat-name').textContent = o.patient_name;
        document.getElementById('lrp-pat-code').textContent = o.patient_code;
        document.getElementById('lrp-pat-demog').textContent = (o.patient_age ? o.patient_age + ' yrs' : 'Age N/A') + ' / ' + o.patient_gender;
        document.getElementById('lrp-pat-blood').textContent = o.patient_blood_group || 'Unknown';

        const chips = document.getElementById('lrp-panels-chips');
        chips.innerHTML = '';
        if (o.items && o.items.length > 0) {
          o.items.forEach(it => {
            chips.innerHTML += \`<span class="badge badge-light" style="font-size: 0.75rem;">\${it.test_name}</span>\`;
          });
        }

        const tbody = document.getElementById('lrp-results-tbody');
        tbody.innerHTML = '';
        if (o.results && o.results.length > 0) {
          o.results.forEach((r, idx) => {
            const isHigh = r.flag === 'high' || r.flag === 'critical';
            const isLow = r.flag === 'low';
            const flagBadge = isHigh ? '<span class="badge badge-danger">HIGH</span>' : (isLow ? '<span class="badge badge-warning">LOW</span>' : '<span class="badge badge-success">NORMAL</span>');

            tbody.innerHTML += \`
              <tr>
                <td><strong>\${idx + 1}</strong></td>
                <td><strong>\${r.parameter_name}</strong></td>
                <td><strong style="\${isHigh ? 'color: #dc2626;' : (isLow ? 'color: #d97706;' : '')}">\${r.result_value}</strong> \${flagBadge}</td>
                <td>\${r.unit || '—'}</td>
                <td class="font-mono text-xs">\${r.reference_range || '—'}</td>
                <td class="text-xs text-muted">\${r.comments || 'Within reference limit'}</td>
              </tr>
            \`;
          });
        } else {
          tbody.innerHTML = \`<tr><td colspan="6" class="text-center" style="padding: var(--space-4);"><strong>Summary:</strong> \${o.result_value || 'Pending analysis'}</td></tr>\`;
        }

        document.getElementById('lrp-notes-text').textContent = o.result_notes || 'All diagnostic indices evaluated according to standard clinical laboratory procedures.';
        document.getElementById('modal-lab-print-view').style.display = 'flex';
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load report document.');
    }
  }

  function closeLabPrintModal() {
    document.getElementById('modal-lab-print-view').style.display = 'none';
  }

  function printLabDoc() {
    const printContents = document.getElementById('printable-lab-report-doc').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(\`
      <html>
        <head>
          <title>Laboratory Diagnostic Report - AuraCare</title>
          <link rel="stylesheet" href="/css/main.css">
          <style>body { background: white; color: black; padding: 20px; font-family: Outfit, sans-serif; }</style>
        </head>
        <body onload="window.print(); window.close();">
          \${printContents}
        </body>
      </html>
    \`);
    printWindow.document.close();
  }
</script>
`;

const docRadiologyContent = `
<div class="grid-4-col" style="margin-bottom: var(--space-4);">
  <div class="card" style="padding: var(--space-4); border-left: 4px solid var(--color-primary);">
    <div class="text-xs text-muted font-bold text-uppercase">Total Imaging Orders</div>
    <div class="text-2xl font-extrabold text-navy" id="rad-stat-total">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #0284c7;">
    <div class="text-xs text-muted font-bold text-uppercase">Scheduled Procedures</div>
    <div class="text-2xl font-extrabold text-info" id="rad-stat-sched">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #f59e0b;">
    <div class="text-xs text-muted font-bold text-uppercase">Pending Imaging / Scan</div>
    <div class="text-2xl font-extrabold text-warning" id="rad-stat-pending">0</div>
  </div>
  <div class="card" style="padding: var(--space-4); border-left: 4px solid #16a34a;">
    <div class="text-xs text-muted font-bold text-uppercase">Verified PACS Reports</div>
    <div class="text-2xl font-extrabold text-success" id="rad-stat-verified">0</div>
  </div>
</div>

<div class="card" style="margin-bottom: var(--space-4);">
  <div class="card-body" style="padding: var(--space-3) var(--space-4);">
    <div style="display: grid; grid-template-columns: 2fr 1.2fr 1fr 1fr auto auto; gap: var(--space-3); align-items: center;">
      <div style="position: relative;">
        <input type="text" id="rad-search" class="form-input" placeholder="Search Order #, Patient, Service..." style="padding-left: 2rem;">
        <i class="fa-solid fa-magnifying-glass text-muted" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);"></i>
      </div>
      <div>
        <select id="rad-modality-filter" class="form-select" onchange="loadRadiologyOrdersList()">
          <option value="all">All Modalities (XR/USG/CT/MRI/ECG)</option>
        </select>
      </div>
      <div>
        <select id="rad-status-filter" class="form-select" onchange="loadRadiologyOrdersList()">
          <option value="all">All Workflow Statuses</option>
          <option value="ordered">Ordered (Pending Schedule)</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed (Pending Verify)</option>
          <option value="verified">Verified & Released</option>
        </select>
      </div>
      <div>
        <select id="rad-priority-filter" class="form-select" onchange="loadRadiologyOrdersList()">
          <option value="all">All Priorities</option>
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT (Critical)</option>
        </select>
      </div>
      <div>
        <button class="btn btn-outline btn-sm" onclick="loadRadiologyOrdersList()"><i class="fa-solid fa-rotate-right"></i> Refresh</button>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" onclick="openNewRadOrderModal()"><i class="fa-solid fa-plus"></i> + New Imaging Order</button>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h4 style="font-size: var(--font-size-base); margin: 0;"><i class="fa-solid fa-x-ray text-primary"></i> Radiology PACS Imaging & Procedure Queue</h4>
    <span class="badge badge-success" id="rad-count-badge">0 Orders</span>
  </div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date & Priority</th>
            <th>Patient Details</th>
            <th>Imaging Modality & Service</th>
            <th>Scheduled Unit / Time</th>
            <th>Status</th>
            <th style="text-align: right;">Clinical Actions</th>
          </tr>
        </thead>
        <tbody id="rad-master-tbody">
          <tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Loading imaging requisitions...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- CREATE NEW IMAGING REQUISITION MODAL (CSS GRID) -->
<div id="modal-rad-order-builder" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 820px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-x-ray text-primary"></i> New Diagnostic Radiology Requisition</h4>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeRadOrderModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
    </div>
    
    <div class="card-body" style="overflow-y: auto; padding: var(--space-4); flex: 1;">
      <div class="grid-3-col" style="gap: var(--space-3); margin-bottom: var(--space-3);">
        <div class="form-group">
          <label class="form-label font-bold">Select Patient *</label>
          <select id="nrad-patient" class="form-select" required onchange="onRadModalPatientChange(this.value)">
            <option value="">-- Choose Patient --</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label font-bold">Requisition Priority</label>
          <select id="nrad-priority" class="form-select font-bold">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT (Critical Emergency)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label font-bold">Order Date</label>
          <input type="date" id="nrad-date" class="form-input">
        </div>
      </div>

      <!-- ALLERGY ALERT WARNING BANNER -->
      <div id="modal-rad-allergy-alert" style="display: none; background: #fee2e2; border: 1px solid #f87171; border-radius: var(--radius-md); padding: 8px 12px; font-size: 0.8rem; color: #991b1b; margin-bottom: var(--space-3);">
        <i class="fa-solid fa-triangle-exclamation"></i> <strong>PATIENT ALLERGY WARNING (Contrast Caution):</strong> <span id="modal-rad-allergy-text"></span>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold">Imaging Modality & Examination Service *</label>
        <select id="nrad-service" class="form-select" required onchange="onRadServiceSelect(this.value)">
          <option value="">-- Choose Imaging Service from Catalog --</option>
        </select>
      </div>

      <div id="nrad-service-info-box" style="display: none; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: var(--radius-md); padding: 8px 12px; font-size: 0.8rem; color: #0f766e; margin-bottom: var(--space-3);">
        <strong>Modality:</strong> <span id="nrad-info-mod"></span> • <strong>Body Part:</strong> <span id="nrad-info-part"></span> • <strong>Price:</strong> <span id="nrad-info-price"></span><br>
        <span id="nrad-info-prep" class="text-xs"></span>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold">Clinical Indication / Reason for Examination *</label>
        <textarea id="nrad-indication" class="form-textarea" rows="2" placeholder="e.g. Unresolved chest discomfort, evaluate for pneumothorax or consolidation..." required></textarea>
      </div>

      <div style="border-top: 1px solid var(--color-slate-200); padding-top: var(--space-3);">
        <h5 class="text-xs font-bold text-uppercase" style="margin-bottom: var(--space-2);"><i class="fa-solid fa-calendar-check text-primary"></i> Optional Immediate Scheduling</h5>
        <div class="grid-3-col" style="gap: var(--space-3);">
          <div class="form-group">
            <label class="form-label text-xs">Schedule Date</label>
            <input type="date" id="nrad-sched-date" class="form-input text-xs">
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Schedule Time</label>
            <input type="time" id="nrad-sched-time" class="form-input text-xs">
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Equipment Room / Unit</label>
            <input type="text" id="nrad-sched-room" class="form-input text-xs" placeholder="e.g. MRI Bay East">
          </div>
        </div>
      </div>

    </div>

    <div class="card-footer" style="background: var(--color-slate-50); display: flex; justify-content: space-between; align-items: center;">
      <button type="button" class="btn btn-outline" onclick="closeRadOrderModal()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="submitNewRadOrder()">
        <i class="fa-solid fa-paper-plane"></i> Submit Imaging Requisition
      </button>
    </div>
  </div>
</div>

<!-- SCHEDULE PROCEDURE MODAL -->
<div id="modal-rad-schedule" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 520px; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-calendar-plus text-primary"></i> Schedule Imaging Procedure</h4>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeScheduleModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
    </div>
    <div class="card-body" style="padding: var(--space-4);">
      <input type="hidden" id="sch-order-id">
      <div style="background: #f8fafc; padding: 8px 12px; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: var(--space-3); border: 1px solid var(--color-slate-200);">
        Order: <strong id="sch-order-num" class="text-primary">RAD-2026-0000</strong><br>
        Exam: <strong id="sch-exam-name">Chest X-Ray</strong>
      </div>
      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold">Procedure Date *</label>
        <input type="date" id="sch-date" class="form-input" required>
      </div>
      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold">Procedure Time *</label>
        <input type="time" id="sch-time" class="form-input" required>
      </div>
      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold">Equipment Room / Imaging Suite</label>
        <input type="text" id="sch-room" class="form-input" placeholder="e.g. CT Suite 101">
      </div>
      <div class="form-group">
        <label class="form-label font-bold">Assigned Radiologic Technologist</label>
        <input type="text" id="sch-tech" class="form-input" placeholder="e.g. Sarah Jenkins, RT(R)">
      </div>
    </div>
    <div class="card-footer" style="background: var(--color-slate-50); display: flex; justify-content: space-between;">
      <button type="button" class="btn btn-outline" onclick="closeScheduleModal()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="submitProcedureSchedule()"><i class="fa-solid fa-check"></i> Confirm Schedule</button>
    </div>
  </div>
</div>

<!-- DIAGNOSTIC PACS REPORT ENTRY MODAL (CSS GRID) -->
<div id="modal-rad-report-entry" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 880px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-file-waveform text-primary"></i> Diagnostic Radiology PACS Report Entry</h4>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeReportEntryModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
    </div>

    <div class="card-body" style="overflow-y: auto; padding: var(--space-4); flex: 1;">
      <input type="hidden" id="rep-order-id">
      
      <div style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-slate-200); margin-bottom: var(--space-3); display: flex; justify-content: space-between; font-size: 0.85rem;">
        <div>Patient: <strong id="rep-pat-name">Patient Name</strong> (<code id="rep-pat-code">PAT-0001</code>)</div>
        <div>Examination: <strong id="rep-service-name" class="text-primary">Chest X-Ray PA & Lateral</strong></div>
        <div>Order: <strong id="rep-order-num">RAD-2026-0000</strong></div>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold">Detailed Anatomical Findings *</label>
        <textarea id="rep-findings" class="form-textarea" rows="4" placeholder="Describe findings across anatomical compartments, lung fields, cardiac silhouette, osseous structures..." required></textarea>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold">Diagnostic Impression / Summary Conclusion *</label>
        <textarea id="rep-impression" class="form-textarea" rows="3" placeholder="Numbered diagnostic conclusion & differential diagnosis..." required></textarea>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-3);">
        <label class="form-label font-bold text-xs">Clinical Recommendations / Follow-up</label>
        <input type="text" id="rep-recs" class="form-input text-xs" placeholder="e.g. Routine clinical correlation. Repeat scan in 6 months.">
      </div>

      <div class="grid-3-col" style="gap: var(--space-3); margin-bottom: var(--space-3);">
        <div class="form-group">
          <label class="form-label text-xs font-bold">Radiation Dose Estimate</label>
          <input type="text" id="rep-dose" class="form-input text-xs" placeholder="e.g. 0.02 mSv (DAP 0.12 dGy*cm²)">
        </div>
        <div class="form-group">
          <label class="form-label text-xs font-bold">Contrast Administration Details</label>
          <input type="text" id="rep-contrast" class="form-input text-xs" placeholder="e.g. Non-contrast study performed">
        </div>
        <div class="form-group">
          <label class="form-label text-xs font-bold">Key Representative Image URL</label>
          <input type="text" id="rep-pacs-url" class="form-input text-xs" placeholder="https://images.unsplash.com/...">
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid var(--color-slate-200); padding: 8px 12px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="rep-critical-flag" style="margin-top: 1px;">
        <label for="rep-critical-flag" style="font-size: 0.8rem; font-weight: bold; color: #dc2626; cursor: pointer;">
          Flag as CRITICAL / URGENT Radiologic Finding (Immediate physician notification)
        </label>
      </div>

    </div>

    <div class="card-footer" style="background: var(--color-slate-50); display: flex; justify-content: space-between; align-items: center;">
      <button type="button" class="btn btn-outline" onclick="closeReportEntryModal()">Cancel</button>
      <div style="display: flex; gap: var(--space-2);">
        <button type="button" class="btn btn-outline" onclick="submitRadiologyReport(false)">
          <i class="fa-solid fa-floppy-disk"></i> Save Findings (Draft)
        </button>
        <button type="button" class="btn btn-success" onclick="submitRadiologyReport(true)">
          <i class="fa-solid fa-circle-check"></i> Save & Verify PACS Report
        </button>
      </div>
    </div>
  </div>
</div>

<!-- VIEW & PRINT OFFICIAL RADIOLOGY PACS REPORT MODAL -->
<div id="modal-rad-print-view" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.75); z-index: var(--z-modal); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: var(--space-4);">
  <div class="card" style="width: 100%; max-width: 820px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-2xl);">
    <div class="card-header" style="background: var(--color-navy-900); color: white; display: flex; justify-content: space-between; align-items: center;">
      <h4 style="margin: 0; color: white;"><i class="fa-solid fa-print text-primary"></i> Diagnostic Radiology PACS Report</h4>
      <div style="display: flex; gap: var(--space-2);">
        <button type="button" class="btn btn-primary btn-sm" onclick="printRadDoc()"><i class="fa-solid fa-print"></i> Print Report</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeRadPrintModal()" style="color: white; border-color: rgba(255,255,255,0.2);">&times;</button>
      </div>
    </div>

    <div class="card-body" id="printable-rad-report-doc" style="overflow-y: auto; padding: 2.5rem; background: white; color: var(--color-slate-900);">
      <!-- Letterhead -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f766e; padding-bottom: var(--space-3); margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-x-ray" style="font-size: 1.75rem; color: #0f766e;"></i>
          <div>
            <h2 style="margin: 0; font-size: 1.4rem; color: var(--color-navy-900); font-weight: 800;">AURACARE RADIOLOGY INSTITUTE</h2>
            <span style="font-size: 0.75rem; color: var(--color-slate-500); letter-spacing: 0.05em; font-weight: 700;">ACR ACCREDITED ADVANCED IMAGING & PACS CENTRE</span>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.75rem; color: var(--color-slate-600);">
          <div>100 Healthcare Boulevard, Suite 100</div>
          <div>Tel: +1 (800) 555-AURA • imaging@auracare.com</div>
          <div>PACS Network: <strong>AURA-PACS-CORE</strong></div>
        </div>
      </div>

      <!-- Report Metadata Header -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.8rem; background: #f8fafc; padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-slate-200); margin-bottom: var(--space-3);">
        <div>
          <div>Order Ref: <strong id="rrp-order-num" style="color: #0f766e; font-size: 0.95rem;">RAD-2026-0000</strong></div>
          <div>Ordering Doctor: <strong id="rrp-doc-name">Dr. Specialist</strong></div>
          <div>Department: <span id="rrp-doc-dept">Cardiology</span></div>
        </div>
        <div>
          <div>Modality: <strong id="rrp-modality">Digital X-Ray</strong></div>
          <div>Room: <span id="rrp-room">Suite 101</span></div>
          <div>Status: <span class="badge badge-success" id="rrp-status-pill">VERIFIED</span></div>
        </div>
        <div style="text-align: right;">
          <div>Exam Date: <strong id="rrp-exam-date">2026-08-15</strong></div>
          <div>Verified At: <strong id="rrp-verified-at">2026-08-15 14:00</strong></div>
          <div>Verified By: <span id="rrp-verified-by">Consultant Radiologist</span></div>
        </div>
      </div>

      <!-- Patient Demographics Bar -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 0.8rem; background: #f1f5f9; padding: 10px; border-radius: var(--radius-md); margin-bottom: var(--space-3); border: 1px solid var(--color-slate-200);">
        <div><span class="text-muted">Patient:</span> <strong id="rrp-pat-name">Arthur Pendleton</strong></div>
        <div><span class="text-muted">MRN:</span> <code id="rrp-pat-code">PAT-0001</code></div>
        <div><span class="text-muted">Age / Gender:</span> <strong id="rrp-pat-demog">52 yrs / Male</strong></div>
        <div><span class="text-muted">Blood Group:</span> <strong id="rrp-pat-blood">O+</strong></div>
      </div>

      <!-- Examination Title & Indication -->
      <div style="background: #fafaf9; border: 1px solid var(--color-slate-200); padding: 10px; border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: 0.85rem;">
        <div>Examination: <strong id="rrp-service-title" style="color: var(--color-navy-900); font-size: 1rem;">Chest X-Ray (PA & Lateral)</strong></div>
        <div class="text-xs text-muted" style="margin-top: 2px;">Clinical Indication: <span id="rrp-indication-text">Post-CABG surveillance</span></div>
      </div>

      <!-- Key Representative Image Thumbnail if present -->
      <div id="rrp-image-container" style="margin-bottom: var(--space-4); display: none; text-align: center;">
        <img id="rrp-pacs-img" src="" alt="PACS Key Image" style="max-height: 220px; border-radius: var(--radius-md); border: 1px solid var(--color-slate-300); box-shadow: var(--shadow-sm);">
        <div class="text-xs text-muted" style="margin-top: 4px;">Figure 1: Representative Diagnostic Image Capture</div>
      </div>

      <!-- Findings Section -->
      <div style="margin-bottom: var(--space-4);">
        <h4 style="font-size: 0.95rem; color: var(--color-navy-900); border-bottom: 2px solid var(--color-slate-200); padding-bottom: 4px; margin-bottom: 8px;">RADIOLOGICAL FINDINGS:</h4>
        <div id="rrp-findings-text" style="font-size: 0.85rem; line-height: 1.6; white-space: pre-line; color: var(--color-slate-800);"></div>
      </div>

      <!-- Impression Section -->
      <div style="margin-bottom: var(--space-4); background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 12px;">
        <h4 style="font-size: 0.95rem; color: #166534; margin: 0 0 6px 0;">IMPRESSION / DIAGNOSTIC CONCLUSION:</h4>
        <div id="rrp-impression-text" style="font-size: 0.85rem; line-height: 1.6; white-space: pre-line; color: #14532d; font-weight: 600;"></div>
      </div>

      <!-- Recommendations & Technical Meta -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; font-size: 0.75rem; color: var(--color-slate-600); margin-bottom: 2.5rem; background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">
        <div>
          <strong>Recommendations:</strong> <span id="rrp-recs-text">Routine clinical correlation.</span>
        </div>
        <div>
          <div>Dose: <strong id="rrp-dose-text">0.02 mSv</strong></div>
          <div>Contrast: <span id="rrp-contrast-text">None</span></div>
        </div>
      </div>

      <!-- Verification Stamp & Signatures -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1rem; border-top: 1px dashed var(--color-slate-300); font-size: 0.75rem; color: var(--color-slate-500);">
        <div>
          <div>Electronically verified and signed by board-certified radiologist.</div>
          <div>PACS Series ID: <code id="rrp-pacs-id">AURA-RAD-2026</code></div>
        </div>
        <div style="text-align: center; width: 220px;">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 1.4rem; color: #0f766e; border-bottom: 1px solid var(--color-slate-400); padding-bottom: 4px;" id="rrp-sig-name">Dr. Chief Radiologist</div>
          <div class="text-xs font-bold" style="margin-top: 4px;">Verified Consultant Radiologist</div>
        </div>
      </div>

    </div>
  </div>
</div>

<script>
  let allRadServicesList = [];
  let allRadPatientsList = [];
  let allModalitiesList = [];

  document.addEventListener('DOMContentLoaded', async () => {
    await Auth.guardPage(["doctor","super_admin","hospital_admin"]);
    loadRadiologyStats();
    loadServicesAndPatients();
    loadRadiologyOrdersList();

    document.getElementById('rad-search').addEventListener('input', () => {
      loadRadiologyOrdersList();
    });
  });

  async function loadRadiologyStats() {
    try {
      const res = await API.get('/radiology/stats');
      if (res.success && res.data) {
        document.getElementById('rad-stat-total').textContent = res.data.total_orders || 0;
        document.getElementById('rad-stat-sched').textContent = res.data.scheduled_count || 0;
        document.getElementById('rad-stat-pending').textContent = (res.data.ordered_count || 0) + (res.data.in_progress_count || 0);
        document.getElementById('rad-stat-verified').textContent = res.data.verified_count || 0;
      }
    } catch (_) {}
  }

  async function loadServicesAndPatients() {
    try {
      const [svcRes, modRes, patRes] = await Promise.all([
        API.get('/radiology/services'),
        API.get('/radiology/modalities'),
        API.get('/patients', { limit: 100 })
      ]);

      if (modRes.success && modRes.data) {
        allModalitiesList = modRes.data;
        const filterSelect = document.getElementById('rad-modality-filter');
        allModalitiesList.forEach(m => {
          filterSelect.innerHTML += \`<option value="\${m.code}">\${m.name}</option>\`;
        });
      }

      if (svcRes.success && svcRes.data) {
        allRadServicesList = svcRes.data;
        const svcSelect = document.getElementById('nrad-service');
        allRadServicesList.forEach(s => {
          svcSelect.innerHTML += \`<option value="\${s.id}">[\${s.modality_name}] \${s.name} - $\${parseFloat(s.price).toFixed(2)}</option>\`;
        });
      }

      if (patRes.success && patRes.data) {
        allRadPatientsList = patRes.data;
        const patSelect = document.getElementById('nrad-patient');
        allRadPatientsList.forEach(p => {
          patSelect.innerHTML += \`<option value="\${p.id}">\${p.first_name} \${p.last_name} (\${p.patient_code})</option>\`;
        });
      }
    } catch (_) {}
  }

  function onRadServiceSelect(svcId) {
    const box = document.getElementById('nrad-service-info-box');
    if (!svcId) {
      box.style.display = 'none';
      return;
    }
    const svc = allRadServicesList.find(s => s.id == svcId);
    if (svc) {
      document.getElementById('nrad-info-mod').textContent = svc.modality_name;
      document.getElementById('nrad-info-part').textContent = svc.body_part;
      document.getElementById('nrad-info-price').textContent = '$' + parseFloat(svc.price).toFixed(2);
      document.getElementById('nrad-info-prep').textContent = svc.preparation_instructions ? 'Prep: ' + svc.preparation_instructions : 'Standard preparation';
      document.getElementById('nrad-sched-room').value = svc.equipment_room || '';
      box.style.display = 'block';
    }
  }

  async function loadRadiologyOrdersList() {
    const tbody = document.getElementById('rad-master-tbody');
    try {
      const params = {
        search: document.getElementById('rad-search').value.trim() || undefined,
        status: document.getElementById('rad-status-filter').value,
        priority: document.getElementById('rad-priority-filter').value,
        modality_code: document.getElementById('rad-modality-filter').value,
        limit: 50
      };

      const res = await API.get('/radiology/orders', params);
      if (res.success && res.data) {
        document.getElementById('rad-count-badge').textContent = res.data.length + ' Orders';

        if (res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">No radiology imaging orders matching filter criteria.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        res.data.forEach(ro => {
          const tr = document.createElement('tr');
          const isOrdered = ro.status === 'ordered';
          const isSched = ro.status === 'scheduled';
          const isProg = ro.status === 'in_progress';
          const isComp = ro.status === 'completed';

          tr.innerHTML = \`
            <td><code class="font-bold">\${ro.order_number}</code></td>
            <td>
              <strong>\${ro.order_date}</strong><br>
              <span class="badge \${ro.priority === 'stat' ? 'badge-danger' : (ro.priority === 'urgent' ? 'badge-warning' : 'badge-light')}" style="font-size: 0.65rem; text-transform: uppercase;">\${ro.priority}</span>
            </td>
            <td>
              <strong>\${ro.patient_name}</strong><br>
              <span class="text-xs text-muted"><code>\${ro.patient_code}</code> • \${ro.patient_gender}</span>
            </td>
            <td>
              <strong class="text-primary">\${ro.service_name}</strong><br>
              <span class="badge badge-light text-xs">\${ro.modality_name} • \${ro.body_part}</span>
            </td>
            <td class="text-xs">
              \${ro.scheduled_date ? \`<strong>\${ro.scheduled_date} \${ro.scheduled_time?.substring(0, 5) || ''}</strong><br><span class="text-muted">\${ro.room_number || 'Suite'}</span>\` : '<span class="text-muted">Unscheduled</span>'}
            </td>
            <td><span class="badge status-badge-\${ro.status}">\${ro.status.replace('_', ' ').toUpperCase()}</span></td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-primary btn-sm" onclick="openRadPrintViewModal(\${ro.id})" title="View PACS Report"><i class="fa-solid fa-file-waveform"></i> Report</button>
              \${isOrdered ? \`
                <button class="btn btn-outline btn-sm" onclick="openScheduleModal(\${ro.id})" title="Schedule Procedure"><i class="fa-solid fa-calendar-plus text-primary"></i> Schedule</button>
              \` : ''}
              \${(isSched || isProg || isOrdered) ? \`
                <button class="btn btn-warning btn-sm" onclick="openReportEntryModal(\${ro.id})" title="Enter Diagnostic Report"><i class="fa-solid fa-pen-to-square"></i> Findings</button>
              \` : ''}
              \${isComp ? \`
                <button class="btn btn-success btn-sm" onclick="verifyRadiologyOrder(\${ro.id})" title="Verify PACS Report"><i class="fa-solid fa-circle-check"></i> Verify</button>
              \` : ''}
            </td>
          \`;
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      tbody.innerHTML = \`<tr><td colspan="7" class="text-center text-danger" style="padding: var(--space-6);">Error: \${err.message}</td></tr>\`;
    }
  }

  function openNewRadOrderModal() {
    document.getElementById('nrad-patient').value = '';
    document.getElementById('nrad-service').value = '';
    document.getElementById('nrad-priority').value = 'routine';
    document.getElementById('nrad-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('nrad-indication').value = '';
    document.getElementById('nrad-sched-date').value = '';
    document.getElementById('nrad-sched-time').value = '';
    document.getElementById('nrad-sched-room').value = '';
    document.getElementById('modal-rad-allergy-alert').style.display = 'none';
    document.getElementById('nrad-service-info-box').style.display = 'none';
    document.getElementById('modal-rad-order-builder').style.display = 'flex';
  }

  function closeRadOrderModal() {
    document.getElementById('modal-rad-order-builder').style.display = 'none';
  }

  function onRadModalPatientChange(patId) {
    if (!patId) {
      document.getElementById('modal-rad-allergy-alert').style.display = 'none';
      return;
    }
    const pat = allRadPatientsList.find(p => p.id == patId);
    if (pat && pat.allergies && pat.allergies.trim().length > 0 && !pat.allergies.toLowerCase().includes('nkda')) {
      document.getElementById('modal-rad-allergy-text').textContent = pat.allergies;
      document.getElementById('modal-rad-allergy-alert').style.display = 'block';
    } else {
      document.getElementById('modal-rad-allergy-alert').style.display = 'none';
    }
  }

  async function submitNewRadOrder() {
    const patId = document.getElementById('nrad-patient').value;
    const svcId = document.getElementById('nrad-service').value;
    const indication = document.getElementById('nrad-indication').value.trim();

    if (!patId || !svcId || !indication) {
      Toast.warning('Please select patient, imaging service, and provide clinical indication.');
      return;
    }

    const payload = {
      patient_id: parseInt(patId, 10),
      service_id: parseInt(svcId, 10),
      priority: document.getElementById('nrad-priority').value,
      order_date: document.getElementById('nrad-date').value || undefined,
      clinical_indication: indication,
      scheduled_date: document.getElementById('nrad-sched-date').value || undefined,
      scheduled_time: document.getElementById('nrad-sched-time').value || undefined,
      room_number: document.getElementById('nrad-sched-room').value.trim() || undefined
    };

    try {
      const res = await API.post('/radiology/orders', payload);
      if (res.success) {
        Toast.success(res.message);
        closeRadOrderModal();
        loadRadiologyStats();
        loadRadiologyOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to create imaging order.');
    }
  }

  async function openScheduleModal(orderId) {
    try {
      const res = await API.get('/radiology/orders/' + orderId);
      if (res.success && res.data) {
        const o = res.data;
        document.getElementById('sch-order-id').value = o.id;
        document.getElementById('sch-order-num').textContent = o.order_number;
        document.getElementById('sch-exam-name').textContent = o.service_name;
        document.getElementById('sch-date').value = o.scheduled_date || new Date().toISOString().split('T')[0];
        document.getElementById('sch-time').value = o.scheduled_time || '10:00';
        document.getElementById('sch-room').value = o.room_number || o.equipment_room || '';
        document.getElementById('sch-tech').value = o.technician_name || '';
        document.getElementById('modal-rad-schedule').style.display = 'flex';
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load order.');
    }
  }

  function closeScheduleModal() {
    document.getElementById('modal-rad-schedule').style.display = 'none';
  }

  async function submitProcedureSchedule() {
    const orderId = document.getElementById('sch-order-id').value;
    const date = document.getElementById('sch-date').value;
    const time = document.getElementById('sch-time').value;

    if (!date || !time) {
      Toast.warning('Please specify procedure date and time.');
      return;
    }

    const payload = {
      scheduled_date: date,
      scheduled_time: time,
      room_number: document.getElementById('sch-room').value.trim() || undefined,
      technician_name: document.getElementById('sch-tech').value.trim() || undefined
    };

    try {
      const res = await API.patch('/radiology/orders/' + orderId + '/schedule', payload);
      if (res.success) {
        Toast.success(res.message);
        closeScheduleModal();
        loadRadiologyStats();
        loadRadiologyOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to schedule procedure.');
    }
  }

  async function openReportEntryModal(orderId) {
    try {
      const res = await API.get('/radiology/orders/' + orderId);
      if (res.success && res.data) {
        const o = res.data;
        document.getElementById('rep-order-id').value = o.id;
        document.getElementById('rep-pat-name').textContent = o.patient_name;
        document.getElementById('rep-pat-code').textContent = o.patient_code;
        document.getElementById('rep-service-name').textContent = o.service_name;
        document.getElementById('rep-order-num').textContent = o.order_number;

        document.getElementById('rep-findings').value = o.findings || '';
        document.getElementById('rep-impression').value = o.impression || '';
        document.getElementById('rep-recs').value = o.recommendations || '';
        document.getElementById('rep-dose').value = o.radiation_dose || '';
        document.getElementById('rep-contrast').value = o.contrast_details || '';
        document.getElementById('rep-pacs-url').value = o.pacs_image_url || '';
        document.getElementById('rep-critical-flag').checked = o.is_critical_finding === 1;

        document.getElementById('modal-rad-report-entry').style.display = 'flex';
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load order for report entry.');
    }
  }

  function closeReportEntryModal() {
    document.getElementById('modal-rad-report-entry').style.display = 'none';
  }

  async function submitRadiologyReport(verify = false) {
    const orderId = document.getElementById('rep-order-id').value;
    const findings = document.getElementById('rep-findings').value.trim();
    const impression = document.getElementById('rep-impression').value.trim();

    if (!findings || !impression) {
      Toast.warning('Please enter both findings and diagnostic impression.');
      return;
    }

    const payload = {
      findings,
      impression,
      recommendations: document.getElementById('rep-recs').value.trim() || undefined,
      radiation_dose: document.getElementById('rep-dose').value.trim() || undefined,
      contrast_details: document.getElementById('rep-contrast').value.trim() || undefined,
      pacs_image_url: document.getElementById('rep-pacs-url').value.trim() || undefined,
      is_critical_finding: document.getElementById('rep-critical-flag').checked,
      status: verify ? 'verified' : 'completed'
    };

    try {
      const res = await API.post('/radiology/orders/' + orderId + '/report', payload);
      if (res.success) {
        Toast.success(res.message);
        closeReportEntryModal();
        loadRadiologyStats();
        loadRadiologyOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to save report.');
    }
  }

  async function verifyRadiologyOrder(orderId) {
    try {
      const res = await API.patch('/radiology/orders/' + orderId + '/verify');
      if (res.success) {
        Toast.success(res.message);
        loadRadiologyStats();
        loadRadiologyOrdersList();
      }
    } catch (err) {
      Toast.error(err.message || 'Verification failed.');
    }
  }

  async function openRadPrintViewModal(orderId) {
    try {
      const res = await API.get('/radiology/orders/' + orderId);
      if (res.success && res.data) {
        const o = res.data;
        document.getElementById('rrp-order-num').textContent = o.order_number;
        document.getElementById('rrp-doc-name').textContent = 'Dr. ' + (o.doctor_name || 'Specialist');
        document.getElementById('rrp-doc-dept').textContent = o.department_name || 'Hospital Department';
        document.getElementById('rrp-modality').textContent = o.modality_name || 'Diagnostic Imaging';
        document.getElementById('rrp-room').textContent = o.room_number || o.equipment_room || 'Imaging Suite';
        document.getElementById('rrp-status-pill').textContent = o.status.toUpperCase();
        document.getElementById('rrp-exam-date').textContent = o.scheduled_date || o.order_date;
        document.getElementById('rrp-verified-at').textContent = o.verified_at ? o.verified_at.substring(0, 16).replace('T', ' ') : 'Pending Verification';
        document.getElementById('rrp-verified-by').textContent = o.verified_by_name || 'Attending Radiologist';
        document.getElementById('rrp-sig-name').textContent = o.verified_by_name ? 'Dr. ' + o.verified_by_name : 'Dr. ' + (o.doctor_name || 'Physician');

        document.getElementById('rrp-pat-name').textContent = o.patient_name;
        document.getElementById('rrp-pat-code').textContent = o.patient_code;
        document.getElementById('rrp-pat-demog').textContent = (o.patient_age ? o.patient_age + ' yrs' : 'Age N/A') + ' / ' + o.patient_gender;
        document.getElementById('rrp-pat-blood').textContent = o.patient_blood_group || 'Unknown';

        document.getElementById('rrp-service-title').textContent = o.service_name + ' (' + (o.body_part || 'General') + ')';
        document.getElementById('rrp-indication-text').textContent = o.clinical_indication || 'Clinical assessment';

        document.getElementById('rrp-findings-text').textContent = o.findings || 'Imaging procedure completed. Findings pending final radiologic dictation.';
        document.getElementById('rrp-impression-text').textContent = o.impression || 'Pending final radiologic interpretation.';
        document.getElementById('rrp-recs-text').textContent = o.recommendations || 'Clinical correlation recommended.';
        document.getElementById('rrp-dose-text').textContent = o.radiation_dose || 'Standard dose';
        document.getElementById('rrp-contrast-text').textContent = o.contrast_details || 'None';
        document.getElementById('rrp-pacs-id').textContent = o.order_number;

        const imgContainer = document.getElementById('rrp-image-container');
        if (o.pacs_image_url && o.pacs_image_url.trim().length > 0) {
          document.getElementById('rrp-pacs-img').src = o.pacs_image_url;
          imgContainer.style.display = 'block';
        } else {
          imgContainer.style.display = 'none';
        }

        document.getElementById('modal-rad-print-view').style.display = 'flex';
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to load report document.');
    }
  }

  function closeRadPrintModal() {
    document.getElementById('modal-rad-print-view').style.display = 'none';
  }

  function printRadDoc() {
    const printContents = document.getElementById('printable-rad-report-doc').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(\`
      <html>
        <head>
          <title>Diagnostic Radiology PACS Report - AuraCare</title>
          <link rel="stylesheet" href="/css/main.css">
          <style>body { background: white; color: black; padding: 20px; font-family: Outfit, sans-serif; }</style>
        </head>
        <body onload="window.print(); window.close();">
          \${printContents}
        </body>
      </html>
    \`);
    printWindow.document.close();
  }
</script>
`;

fs.writeFileSync(path.join(docDir, 'dashboard.html'), wrapDoctorPage('dashboard', 'Physician Clinical Workspace', docDashContent));
fs.writeFileSync(path.join(docDir, 'appointments.html'), wrapDoctorPage('appointments', 'Assigned Patient Appointments', docApptsContent));
fs.writeFileSync(path.join(docDir, 'patients.html'), wrapDoctorPage('patients', 'My Patient Roster & EMR Charts', docPatientsContent));
fs.writeFileSync(path.join(docDir, 'consultations.html'), wrapDoctorPage('consultations', 'Doctor Clinical Consultation & EMR Workspace', docConsultationContent));
fs.writeFileSync(path.join(docDir, 'medical-records.html'), wrapDoctorPage('medical-records', 'Electronic Medical Records (EMR) Archive', docMedicalRecordsContent));
fs.writeFileSync(path.join(docDir, 'prescriptions.html'), wrapDoctorPage('prescriptions', 'Doctor Prescription Management Studio', docPrescriptionsContent));
fs.writeFileSync(path.join(docDir, 'lab-orders.html'), wrapDoctorPage('lab-orders', 'Diagnostic Laboratory Orders & Reports Workspace', docLabOrdersContent));
fs.writeFileSync(path.join(docDir, 'radiology.html'), wrapDoctorPage('radiology', 'Radiology PACS Imaging & Diagnostic Reporting', docRadiologyContent));
fs.writeFileSync(path.join(docDir, 'follow-ups.html'), wrapDoctorPage('follow-ups', 'Patient Follow-up Schedule', '<div class="card"><div class="card-body"><p class="text-muted">Post-discharge and chronic disease monitoring schedule.</p></div></div>'));
fs.writeFileSync(path.join(docDir, 'schedule.html'), wrapDoctorPage('schedule', 'Weekly Consultation Timetable', docScheduleContent));
fs.writeFileSync(path.join(docDir, 'profile.html'), wrapDoctorPage('profile', 'Doctor Professional Profile', docProfileContent));

console.log('✅ [MPA BUILDER] All 11 Doctor pages generated in public/doctor/');






