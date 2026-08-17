const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const patDir = path.join(publicDir, 'patient');
if (!fs.existsSync(patDir)) fs.mkdirSync(patDir, { recursive: true });

function getPatientSidebar(activePage) {
  const links = [
    { key: 'dashboard', href: '/patient/dashboard', icon: 'fa-hospital-user', label: 'My Health Home' },
    { key: 'appointments', href: '/patient/appointments', icon: 'fa-calendar-check', label: 'Appointments' },
    { key: 'medical-history', href: '/patient/medical-history', icon: 'fa-file-waveform', label: 'Medical History' },
    { key: 'prescriptions', href: '/patient/prescriptions', icon: 'fa-prescription-bottle-medical', label: 'My Prescriptions' },
    { key: 'lab-reports', href: '/patient/lab-reports', icon: 'fa-vials', label: 'Lab Reports' },
    { key: 'invoices', href: '/patient/invoices', icon: 'fa-receipt', label: 'Billing Invoices' },
    { key: 'payments', href: '/patient/payments', icon: 'fa-credit-card', label: 'Payment Receipts' },
    { key: 'documents', href: '/patient/documents', icon: 'fa-folder-open', label: 'My Documents' },
    { key: 'profile', href: '/patient/profile', icon: 'fa-user-pen', label: 'Personal Profile' }
  ];

  return `
  <aside class="dashboard-sidebar">
    <div>
      <a href="/" class="brand-logo-grid" style="color: white; margin-bottom: var(--space-4);">
        <div class="brand-icon-box"><i class="fa-solid fa-hospital-user"></i></div>
        <div>
          <span>AuraCare</span>
          <span style="display: block; font-size: 0.65rem; color: #2dd4bf; letter-spacing: 0.05em; font-weight: bold;">PATIENT PORTAL</span>
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
        <div class="sidebar-user-avatar"><i class="fa-solid fa-hospital-user"></i></div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" data-user-name>Patient</div>
          <div class="sidebar-user-role" data-user-role>Patient Portal</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr auto; gap: var(--space-2); margin-top: 2px;">
        <button class="btn btn-outline-danger btn-sm" data-action-logout style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; color: #fca5a5; border-color: rgba(239,68,68,0.35);">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
        </button>
        <a href="/patient/profile" class="btn btn-outline btn-sm" title="My Profile" style="color: white; border-color: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-user-pen"></i>
        </a>
      </div>
    </div>
  </aside>
  `;
}

function wrapPatientPage(pageKey, pageTitle, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle} | AuraCare Patient Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body class="dashboard-layout">
  ${getPatientSidebar(pageKey)}

  <div class="dashboard-main">
    <header class="dashboard-topbar-grid">
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <h3 style="font-size: var(--font-size-lg); margin: 0;">${pageTitle}</h3>
      </div>
      <div style="display: flex; align-items: center; gap: var(--space-3);">
        <a href="/appointments" class="btn btn-primary btn-sm"><i class="fa-regular fa-calendar-plus"></i> Request Appointment</a>
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
      await Auth.guardPage(['patient', 'super_admin']);
    });
  </script>
</body>
</html>`;
}

// 1. DASHBOARD
const patDashContent = `
<div class="card" style="background: var(--gradient-card); margin-bottom: var(--space-6);">
  <div class="card-body">
    <div style="display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-6); align-items: center;">
      <div class="doctor-avatar-placeholder" style="width: 72px; height: 72px; font-size: 1.75rem;"><i class="fa-solid fa-user"></i></div>
      <div>
        <h3 id="pat-name" style="margin-bottom: 2px;">Loading Patient File...</h3>
        <p id="pat-info" class="text-muted text-sm" style="margin: 0;">MRN & Blood Group</p>
      </div>
      <div><span class="badge badge-success" id="pat-mrn-badge">PAT-RECORD</span></div>
    </div>
  </div>
</div>

<div class="grid-2-col">
  <div class="card">
    <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">My Appointments (MySQL Live)</h4></div>
    <div class="card-body" style="padding: 0;">
      <div class="table-responsive" style="border: none;">
        <table class="table-modern">
          <thead><tr><th>Date & Time</th><th>Department & Doctor</th><th>Status</th></tr></thead>
          <tbody id="pat-appts-tbody"><tr><td colspan="3" class="text-center text-muted" style="padding: var(--space-6);">Loading appointments...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Billing & Invoices</h4></div>
    <div class="card-body" style="padding: 0;">
      <div class="table-responsive" style="border: none;">
        <table class="table-modern">
          <thead><tr><th>Invoice #</th><th>Due Date</th><th>Total</th><th>Status</th></tr></thead>
          <tbody id="pat-inv-tbody"><tr><td colspan="4" class="text-center text-muted" style="padding: var(--space-6);">Loading invoices...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    if (prof) {
      document.getElementById('pat-name').textContent = prof.fullName;
      if (prof.patient) {
        document.getElementById('pat-info').textContent = 'MRN: ' + prof.patient.patientCode + ' • Blood Group: ' + prof.patient.bloodGroup;
        document.getElementById('pat-mrn-badge').textContent = prof.patient.patientCode;
      }
    }
    try {
      const res = await API.get('/patient/my-records');
      if (res.success && res.data) {
        const tbody = document.getElementById('pat-appts-tbody');
        if (res.data.appointments && res.data.appointments.length > 0) {
          tbody.innerHTML = '';
          res.data.appointments.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td><strong>\${a.appointment_date}</strong><br><span class="text-xs text-muted">\${a.appointment_time}</span></td>
              <td>\${a.department_name}<br><span class="text-xs text-muted">\${a.doctor_name || 'Specialist'}</span></td>
              <td><span class="badge badge-info">\${a.status}</span></td>
            \`;
            tbody.appendChild(tr);
          });
        }

        const invBody = document.getElementById('pat-inv-tbody');
        if (res.data.invoices && res.data.invoices.length > 0) {
          invBody.innerHTML = '';
          res.data.invoices.forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td><code>\${i.invoice_number}</code></td>
              <td>\${i.due_date}</td>
              <td><strong>$\${parseFloat(i.net_amount).toFixed(2)}</strong></td>
              <td><span class="badge badge-success">\${i.status}</span></td>
            \`;
            invBody.appendChild(tr);
          });
        }
      }
    } catch (err) { console.error(err); }
  });
</script>
`;

// 2. MEDICAL HISTORY
const medHistContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Electronic Medical Records & Diagnosis History</h4></div>
  <div class="card-body" id="pat-history-container" style="padding: var(--space-6);">
    <div class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Loading medical records from MySQL...</div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    const patId = prof?.patient?.id || 1;
    try {
      const res = await API.get('/patients/' + patId + '/records');
      const container = document.getElementById('pat-history-container');
      if (res.success && res.data?.length > 0) {
        container.innerHTML = '';
        res.data.forEach(r => {
          container.innerHTML += \`
            <div class="record-card-box">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
                <h5 style="margin: 0; color: var(--color-navy-900);">Diagnosis: <span class="text-primary">\${r.diagnosis}</span></h5>
                <span class="badge badge-info">\${r.record_date}</span>
              </div>
              <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-2);"><strong>Chief Complaint:</strong> \${r.chief_complaint}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-slate-600);">\${r.clinical_notes || 'No extended notes'}</div>
            </div>
          \`;
        });
      } else {
        container.innerHTML = '<div class="text-center text-muted">No past medical records found.</div>';
      }
    } catch(err) { console.error(err); }
  });
</script>
`;

// 3. PRESCRIPTIONS
const rxContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Active Prescriptions & Dosage Schedules</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Doctor</th><th>Instructions</th></tr></thead>
        <tbody id="pat-rx-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading prescriptions...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    const patId = prof?.patient?.id || 1;
    try {
      const res = await API.get('/patients/' + patId + '/prescriptions');
      const tbody = document.getElementById('pat-rx-tbody');
      if (res.success && res.data?.length > 0) {
        tbody.innerHTML = '';
        res.data.forEach(rx => {
          tbody.innerHTML += \`
            <tr>
              <td><strong>\${rx.medicine_name}</strong></td>
              <td><span class="badge badge-info">\${rx.dosage}</span></td>
              <td>\${rx.frequency}</td>
              <td><strong>\${rx.duration}</strong></td>
              <td>\${rx.doctor_name || 'Physician'}</td>
              <td class="text-xs">\${rx.instructions || 'Standard dosing'}</td>
            </tr>
          \`;
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">No prescriptions on file.</td></tr>';
      }
    } catch(err) { console.error(err); }
  });
</script>
`;

// 4. LAB REPORTS
const labContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Diagnostic Laboratory Results</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Order #</th><th>Test Name</th><th>Date</th><th>Result</th><th>Reference Range</th><th>Status</th></tr></thead>
        <tbody id="pat-lab-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading lab results...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    const patId = prof?.patient?.id || 1;
    try {
      const res = await API.get('/patients/' + patId + '/lab-reports');
      const tbody = document.getElementById('pat-lab-tbody');
      if (res.success && res.data?.length > 0) {
        tbody.innerHTML = '';
        res.data.forEach(l => {
          tbody.innerHTML += \`
            <tr>
              <td><code>\${l.order_number}</code></td>
              <td><strong>\${l.test_name}</strong></td>
              <td>\${l.order_date}</td>
              <td><strong class="text-primary">\${l.result_value || 'Pending'}</strong></td>
              <td class="text-xs font-mono">\${l.normal_range || ''}</td>
              <td><span class="badge badge-success">\${l.status}</span></td>
            </tr>
          \`;
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">No lab results on file.</td></tr>';
      }
    } catch(err) { console.error(err); }
  });
</script>
`;

// 5. INVOICES
const invContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Billing Statements & Invoices</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Invoice #</th><th>Date</th><th>Total</th><th>Net Due</th><th>Paid</th><th>Balance</th><th>Status</th><th>Due Date</th></tr></thead>
        <tbody id="pat-invoices-tbody"><tr><td colspan="8" class="text-center text-muted" style="padding: var(--space-6);">Loading invoices...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    const patId = prof?.patient?.id || 1;
    try {
      const res = await API.get('/patients/' + patId + '/invoices');
      const tbody = document.getElementById('pat-invoices-tbody');
      if (res.success && res.data?.length > 0) {
        tbody.innerHTML = '';
        res.data.forEach(i => {
          tbody.innerHTML += \`
            <tr>
              <td><code>\${i.invoice_number}</code></td>
              <td>\${i.created_at ? i.created_at.split('T')[0] : ''}</td>
              <td>$\${parseFloat(i.total_amount).toFixed(2)}</td>
              <td><strong>$\${parseFloat(i.net_amount).toFixed(2)}</strong></td>
              <td class="text-success">$\${parseFloat(i.total_paid || 0).toFixed(2)}</td>
              <td class="text-danger font-bold">$\${parseFloat(i.balance_due || 0).toFixed(2)}</td>
              <td><span class="badge \${i.status === 'paid' ? 'badge-success' : 'badge-danger'}">\${i.status}</span></td>
              <td>\${i.due_date}</td>
            </tr>
          \`;
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: var(--space-6);">No invoices on file.</td></tr>';
      }
    } catch(err) { console.error(err); }
  });
</script>
`;

// 6. PAYMENTS
const payContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Payment Transaction History</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Transaction Ref</th><th>Invoice #</th><th>Date</th><th>Method</th><th>Amount Paid</th><th>Notes</th></tr></thead>
        <tbody id="pat-pay-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">Loading payments...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    const patId = prof?.patient?.id || 1;
    try {
      const res = await API.get('/patients/' + patId + '/payments');
      const tbody = document.getElementById('pat-pay-tbody');
      if (res.success && res.data?.length > 0) {
        tbody.innerHTML = '';
        res.data.forEach(p => {
          tbody.innerHTML += \`
            <tr>
              <td><code>\${p.transaction_ref || 'TXN'}</code></td>
              <td><code>\${p.invoice_number}</code></td>
              <td>\${p.payment_date ? p.payment_date.split('T')[0] : ''}</td>
              <td><span class="badge" style="background: var(--color-slate-100);">\${p.payment_method}</span></td>
              <td><strong class="text-success">$\${parseFloat(p.amount_paid).toFixed(2)}</strong></td>
              <td class="text-xs text-muted">\${p.notes || ''}</td>
            </tr>
          \`;
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: var(--space-6);">No payments recorded.</td></tr>';
      }
    } catch(err) { console.error(err); }
  });
</script>
`;

// 7. DOCUMENTS
const docContent = `
<div class="card">
  <div class="card-header"><h4 style="font-size: var(--font-size-base); margin: 0;">Medical Files & Attached Documents</h4></div>
  <div class="card-body" style="padding: 0;">
    <div class="table-responsive" style="border: none;">
      <table class="table-modern">
        <thead><tr><th>Document Name</th><th>Type</th><th>Storage Reference</th><th>Size</th><th>Date</th></tr></thead>
        <tbody id="pat-docs-tbody"><tr><td colspan="5" class="text-center text-muted" style="padding: var(--space-6);">Loading documents...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const prof = await Auth.fetchProfile();
    const patId = prof?.patient?.id || 1;
    try {
      const res = await API.get('/patients/' + patId + '/documents');
      const tbody = document.getElementById('pat-docs-tbody');
      if (res.success && res.data?.length > 0) {
        tbody.innerHTML = '';
        res.data.forEach(d => {
          tbody.innerHTML += \`
            <tr>
              <td><i class="fa-regular fa-file-pdf text-danger"></i> <strong>\${d.document_name}</strong></td>
              <td><span class="badge badge-info">\${d.document_type}</span></td>
              <td><code class="text-xs">\${d.file_path}</code></td>
              <td class="text-xs">\${d.file_size_kb || 150} KB</td>
              <td class="text-xs">\${d.uploaded_at ? d.uploaded_at.split('T')[0] : ''}</td>
            </tr>
          \`;
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: var(--space-6);">No documents attached.</td></tr>';
      }
    } catch(err) { console.error(err); }
  });
</script>
`;

fs.writeFileSync(path.join(patDir, 'dashboard.html'), wrapPatientPage('dashboard', 'Personal Health Portal', patDashContent));
fs.writeFileSync(path.join(patDir, 'appointments.html'), wrapPatientPage('appointments', 'My Doctor Appointments', patDashContent));
fs.writeFileSync(path.join(patDir, 'medical-history.html'), wrapPatientPage('medical-history', 'Medical History & EMR', medHistContent));
fs.writeFileSync(path.join(patDir, 'prescriptions.html'), wrapPatientPage('prescriptions', 'My Prescriptions & Medications', rxContent));
fs.writeFileSync(path.join(patDir, 'lab-reports.html'), wrapPatientPage('lab-reports', 'Diagnostic Laboratory Reports', labContent));
fs.writeFileSync(path.join(patDir, 'invoices.html'), wrapPatientPage('invoices', 'Billing Invoices & Breakdown', invContent));
fs.writeFileSync(path.join(patDir, 'payments.html'), wrapPatientPage('payments', 'Payment Receipts & Transactions', payContent));
fs.writeFileSync(path.join(patDir, 'documents.html'), wrapPatientPage('documents', 'Medical Documents & Records', docContent));

console.log('✅ [MPA BUILDER] All live Patient portal pages generated successfully!');
