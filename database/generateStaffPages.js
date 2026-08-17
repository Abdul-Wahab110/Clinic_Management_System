const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');

function generateRoleModule(roleKey, roleName, roleTitle, roleGuard, links, sampleContent) {
  const dir = path.join(publicDir, roleKey);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  links.forEach(link => {
    const filePath = path.join(dir, `${link.key}.html`);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${link.label} | AuraCare ${roleTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body class="dashboard-layout">
  <aside class="dashboard-sidebar">
    <div>
      <a href="/" class="brand-logo-grid" style="color: white; margin-bottom: var(--space-4);">
        <div class="brand-icon-box"><i class="fa-solid fa-hospital"></i></div>
        <div>
          <span>AuraCare</span>
          <span style="display: block; font-size: 0.65rem; color: #2dd4bf; letter-spacing: 0.05em; font-weight: bold;">${roleTitle.toUpperCase()}</span>
        </div>
      </a>
      <ul class="sidebar-nav-grid">
        ${links.map(l => `
          <li>
            <a href="/${roleKey}/${l.key}" class="btn ${link.key === l.key ? 'btn-primary' : 'btn-outline'} btn-block" style="justify-content: start; text-align: left; ${link.key === l.key ? '' : 'color: var(--color-slate-300); border-color: rgba(255,255,255,0.08);'}">
              <i class="fa-solid ${l.icon}"></i> ${l.label}
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
    <div class="sidebar-user-box">
      <div class="sidebar-user-header">
        <div class="sidebar-user-avatar"><i class="fa-solid fa-user-shield"></i></div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" data-user-name>${roleName}</div>
          <div class="sidebar-user-role" data-user-role>${roleTitle}</div>
        </div>
      </div>
      <button class="btn btn-outline-danger btn-sm btn-block" data-action-logout style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; color: #fca5a5; border-color: rgba(239,68,68,0.35);">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
      </button>
    </div>
  </aside>

  <div class="dashboard-main">
    <header class="dashboard-topbar-grid">
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <h3 style="font-size: var(--font-size-lg); margin: 0;">${link.label}</h3>
      </div>
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <span class="badge badge-success" data-user-role-badge>${roleTitle} Station</span>
        <button class="btn btn-outline-danger btn-sm" data-action-logout title="Sign Out">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Sign Out</span>
        </button>
        <a href="/" class="btn btn-outline btn-sm">Clinic Home &rarr;</a>
      </div>
    </header>
    <main class="dashboard-content-grid">
      ${sampleContent(link.key, link.label)}
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
      await Auth.guardPage(${JSON.stringify(roleGuard)});
    });
  </script>
</body>
</html>`;
    fs.writeFileSync(filePath, html.trim(), 'utf8');
    console.log(`✅ Generated: ${roleKey}/${link.key}.html`);
  });
}

// 1. RECEPTION PAGES (6 pages)
generateRoleModule(
  'reception',
  'Receptionist',
  'Front Desk Reception',
  ['receptionist', 'super_admin', 'hospital_admin'],
  [
    { key: 'dashboard', icon: 'fa-id-card-clip', label: 'Front Desk Hub' },
    { key: 'patients', icon: 'fa-user-plus', label: 'Patient Registration' },
    { key: 'appointments', icon: 'fa-calendar-check', label: 'Bookings Queue' },
    { key: 'opd', icon: 'fa-stethoscope', label: 'OPD Token Triage' },
    { key: 'check-in', icon: 'fa-door-open', label: 'Patient Check-In' },
    { key: 'billing', icon: 'fa-cash-register', label: 'Intake Cash Desk' }
  ],
  (key, label) => {
    if (key === 'patients') {
      return `
      <!-- Search & Filters -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-body" style="padding: var(--space-4);">
          <div class="filter-bar-grid">
            <div style="position: relative;">
              <input type="text" id="rec-filter-search" class="form-input" placeholder="Search by name, patient ID, CNIC, phone, email..." style="padding-left: 2.25rem;">
              <i class="fa-solid fa-magnifying-glass text-muted" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%);"></i>
            </div>
            <div>
              <select id="rec-filter-status" class="form-select">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <select id="rec-filter-gender" class="form-select">
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <select id="rec-filter-blood" class="form-select">
                <option value="all">All Blood Groups</option>
                <option value="A+">A+</option><option value="A-">A-</option>
                <option value="B+">B+</option><option value="B-">B-</option>
                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                <option value="O+">O+</option><option value="O-">O-</option>
              </select>
            </div>
            <div>
              <button id="rec-btn-reset" class="btn btn-outline btn-sm"><i class="fa-solid fa-rotate-left"></i> Reset</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Patients Table -->
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-size: var(--font-size-base); margin: 0;">Registered Patients Directory</h4>
          <span class="text-xs text-muted" id="rec-count">Loading patients...</span>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-responsive" style="border: none;">
            <table class="table-modern">
              <thead>
                <tr>
                  <th>Patient Details</th>
                  <th>Gender & Age</th>
                  <th>Blood Group</th>
                  <th>Phone & Email</th>
                  <th>CNIC / National ID</th>
                  <th>Status</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="rec-patients-tbody">
                <tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">Loading patients...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <script>
        let recPage = 1;
        let recLimit = 10;
        let recDebounce = null;

        document.addEventListener('DOMContentLoaded', async () => {
          await Auth.guardPage(["receptionist","super_admin","hospital_admin"]);

          document.getElementById('rec-filter-search')?.addEventListener('input', () => {
            clearTimeout(recDebounce);
            recDebounce = setTimeout(() => { recPage = 1; loadReceptionPatients(); }, 300);
          });
          document.getElementById('rec-filter-status')?.addEventListener('change', () => { recPage = 1; loadReceptionPatients(); });
          document.getElementById('rec-filter-gender')?.addEventListener('change', () => { recPage = 1; loadReceptionPatients(); });
          document.getElementById('rec-filter-blood')?.addEventListener('change', () => { recPage = 1; loadReceptionPatients(); });
          document.getElementById('rec-btn-reset')?.addEventListener('click', () => {
            document.getElementById('rec-filter-search').value = '';
            document.getElementById('rec-filter-status').value = 'all';
            document.getElementById('rec-filter-gender').value = 'all';
            document.getElementById('rec-filter-blood').value = 'all';
            recPage = 1;
            loadReceptionPatients();
          });

          loadReceptionPatients();
        });

        async function loadReceptionPatients() {
          const search = document.getElementById('rec-filter-search')?.value.trim() || '';
          const status = document.getElementById('rec-filter-status')?.value || 'all';
          const gender = document.getElementById('rec-filter-gender')?.value || 'all';
          const blood_group = document.getElementById('rec-filter-blood')?.value || 'all';

          const tbody = document.getElementById('rec-patients-tbody');
          if (!tbody) return;
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);"><i class="fa-solid fa-spinner fa-spin"></i> Fetching patients...</td></tr>';

          try {
            const res = await API.get('/patients', { search, status, gender, blood_group, page: recPage, limit: recLimit });
            if (res.success && res.data) {
              tbody.innerHTML = '';
              if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-6);">No patients found.</td></tr>';
                return;
              }
              const cnt = document.getElementById('rec-count');
              if (cnt) cnt.textContent = 'Total: ' + res.pagination.total + ' patients';

              res.data.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`
                  <td><strong>\${p.full_name}</strong><br><code style="font-size: 0.725rem;">\${p.patient_code}</code></td>
                  <td>\${p.gender} (\${p.age !== null ? p.age + ' yrs' : 'N/A'})</td>
                  <td><span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 700;">\${p.blood_group || 'Unknown'}</span></td>
                  <td>\${p.phone}<br><span class="text-xs text-muted">\${p.email || ''}</span></td>
                  <td><span class="font-mono text-xs">\${p.identification_number || 'N/A'}</span></td>
                  <td><span class="badge \${p.status === 'active' ? 'badge-success' : 'badge-warning'}">\${p.status}</span></td>
                  <td style="text-align: right;">
                    <a href="/admin/patient-profile?id=\${p.id}" class="btn btn-outline btn-sm"><i class="fa-solid fa-eye text-primary"></i> EMR Profile</a>
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
    }

    return `
    <div class="card">
      <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">${label}</h4></div>
      <div class="card-body"><p class="text-muted">Real-time front desk intake, appointment queue, and triage desk connected to MySQL.</p></div>
    </div>
    `;
  }
);

// 2. NURSE PAGES (6 pages)
generateRoleModule(
  'nurse',
  'Nurse',
  'Nursing Station',
  ['nurse', 'super_admin', 'hospital_admin'],
  [
    { key: 'dashboard', icon: 'fa-user-nurse', label: 'Nursing Station' },
    { key: 'patients', icon: 'fa-hospital-user', label: 'Inpatient Roster' },
    { key: 'wards', icon: 'fa-bed-pulse', label: 'Ward Bed Census' },
    { key: 'vitals', icon: 'fa-heart-pulse', label: 'Vital Signs Entry' },
    { key: 'medications', icon: 'fa-pills', label: 'Medication Administration' },
    { key: 'notes', icon: 'fa-clipboard-user', label: 'Nursing Shift Notes' }
  ],
  (key, label) => `
    <div class="card">
      <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">${label}</h4></div>
      <div class="card-body"><p class="text-muted">Inpatient monitoring, vital signs tracking (BP, pulse, SpO2, temp), and ward bed occupancy.</p></div>
    </div>
  `
);

// 3. LAB TECHNICIAN PAGES (6 pages)
generateRoleModule(
  'lab',
  'Lab Technician',
  'Pathology Laboratory',
  ['lab_technician', 'super_admin', 'hospital_admin'],
  [
    { key: 'dashboard', icon: 'fa-vials', label: 'Laboratory Console' },
    { key: 'orders', icon: 'fa-list-check', label: 'Test Orders Queue' },
    { key: 'samples', icon: 'fa-vial-virus', label: 'Specimen Collection' },
    { key: 'results', icon: 'fa-microscope', label: 'Enter Lab Results' },
    { key: 'reports', icon: 'fa-file-lines', label: 'Verified Reports' },
    { key: 'tests', icon: 'fa-clipboard-list', label: 'Diagnostic Test Catalog' }
  ],
  (key, label) => `
    <div class="card">
      <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">${label}</h4></div>
      <div class="card-body"><p class="text-muted">Automated diagnostic analyzer processing, specimen barcode tracking, and pathology reports.</p></div>
    </div>
  `
);

// 4. PHARMACIST PAGES (6 pages)
generateRoleModule(
  'pharmacy',
  'Pharmacist',
  'Hospital Pharmacy',
  ['pharmacist', 'super_admin', 'hospital_admin'],
  [
    { key: 'dashboard', icon: 'fa-prescription-bottle', label: 'Pharmacy Console' },
    { key: 'medicines', icon: 'fa-pills', label: 'Medicines Inventory' },
    { key: 'prescriptions', icon: 'fa-receipt', label: 'Dispense Prescriptions' },
    { key: 'sales', icon: 'fa-chart-pie', label: 'Dispensary Sales' },
    { key: 'inventory', icon: 'fa-boxes-stacked', label: 'Stock Reordering' },
    { key: 'suppliers', icon: 'fa-truck-fast', label: 'Pharma Suppliers' }
  ],
  (key, label) => `
    <div class="card">
      <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">${label}</h4></div>
      <div class="card-body"><p class="text-muted">Medication stock inventory, batch tracking, expiry date monitoring, and digital prescription fulfillment.</p></div>
    </div>
  `
);

// 5. ACCOUNTANT / BILLING PAGES (5 pages)
generateRoleModule(
  'billing',
  'Accountant',
  'Finance & Invoicing',
  ['accountant', 'super_admin', 'hospital_admin'],
  [
    { key: 'dashboard', icon: 'fa-scale-balanced', label: 'Finance Ledger' },
    { key: 'invoices', icon: 'fa-file-invoice-dollar', label: 'Patient Invoices' },
    { key: 'payments', icon: 'fa-money-check-dollar', label: 'Payment Receipts' },
    { key: 'refunds', icon: 'fa-hand-holding-dollar', label: 'Insurance & Refunds' },
    { key: 'reports', icon: 'fa-chart-simple', label: 'Revenue Analytics' }
  ],
  (key, label) => `
    <div class="card">
      <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">${label}</h4></div>
      <div class="card-body"><p class="text-muted">Patient hospital billing, insurance claim submissions, payment processing, and revenue reporting.</p></div>
    </div>
  `
);

console.log('✅ [MPA BUILDER] All Staff Workstation pages generated successfully.');
