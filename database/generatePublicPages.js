const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const pagesDir = path.join(publicDir, 'pages');
if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

function wrapPublicPage(title, activeNav, metaDesc, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | AuraCare Medical Center</title>
  <meta name="description" content="${metaDesc}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body class="page-shell">

  <!-- Top Bar -->
  <div style="background: var(--color-navy-950); color: var(--color-slate-300); font-size: var(--font-size-xs); padding: var(--space-2) var(--space-6); border-bottom: 1px solid rgba(255,255,255,0.08);">
    <div style="max-width: 1280px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; gap: var(--space-4);">
        <span><i class="fa-solid fa-phone" style="color: #2dd4bf;"></i> 24/7 Trauma: <strong>+1 (800) 555-AURA</strong></span>
        <span><i class="fa-solid fa-clock" style="color: #2dd4bf;"></i> Emergency Open 24 Hours</span>
      </div>
      <div>
        <span><i class="fa-solid fa-location-dot" style="color: #2dd4bf;"></i> 100 Medical Plaza, Metro Health District</span>
      </div>
    </div>
  </div>

  <!-- Navigation Header (Real MPA Navigation) -->
  <header style="background: var(--color-surface); border-bottom: 1px solid var(--color-slate-200); position: sticky; top: 0; z-index: 100;">
    <div style="max-width: 1280px; margin: 0 auto; padding: var(--space-3) var(--space-6); display: flex; justify-content: space-between; align-items: center;">
      <a href="/" class="brand-logo-grid">
        <div class="brand-icon-box"><i class="fa-solid fa-hospital"></i></div>
        <div>
          <span>AuraCare</span>
          <span style="display: block; font-size: 0.65rem; color: var(--color-primary); letter-spacing: 0.05em; font-weight: bold;">MEDICAL CENTER</span>
        </div>
      </a>

      <nav style="display: flex; gap: var(--space-5); align-items: center;">
        <a href="/" style="color: ${activeNav === 'home' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'home' ? 'bold' : 'normal'}; text-decoration: none;">Home</a>
        <a href="/about" style="color: ${activeNav === 'about' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'about' ? 'bold' : 'normal'}; text-decoration: none;">About</a>
        <a href="/departments" style="color: ${activeNav === 'departments' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'departments' ? 'bold' : 'normal'}; text-decoration: none;">Departments</a>
        <a href="/doctors" style="color: ${activeNav === 'doctors' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'doctors' ? 'bold' : 'normal'}; text-decoration: none;">Doctors</a>
        <a href="/services" style="color: ${activeNav === 'services' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'services' ? 'bold' : 'normal'}; text-decoration: none;">Services</a>
        <a href="/appointments" style="color: ${activeNav === 'appointments' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'appointments' ? 'bold' : 'normal'}; text-decoration: none;">Appointments</a>
        <a href="/emergency" style="color: var(--color-danger); font-weight: bold; text-decoration: none;"><i class="fa-solid fa-truck-medical"></i> Emergency</a>
        <a href="/blog" style="color: ${activeNav === 'blog' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'blog' ? 'bold' : 'normal'}; text-decoration: none;">Blog</a>
        <a href="/faq" style="color: ${activeNav === 'faq' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'faq' ? 'bold' : 'normal'}; text-decoration: none;">FAQ</a>
        <a href="/contact" style="color: ${activeNav === 'contact' ? 'var(--color-primary)' : 'var(--color-navy-800)'}; font-weight: ${activeNav === 'contact' ? 'bold' : 'normal'}; text-decoration: none;">Contact</a>
      </nav>

      <div style="display: flex; gap: var(--space-3); align-items: center;">
        <button class="btn btn-outline btn-sm" data-modal-target="modal-login"><i class="fa-solid fa-user-lock"></i> Portal Login</button>
        <a href="/appointments" class="btn btn-primary btn-sm"><i class="fa-regular fa-calendar-check"></i> Book Visit</a>
      </div>
    </div>
  </header>

  <!-- Page Header Banner (CSS Grid) -->
  <section style="background: var(--gradient-primary); color: white; padding: var(--space-10) var(--space-6);">
    <div style="max-width: 1280px; margin: 0 auto;">
      <span class="badge badge-primary" style="background: rgba(255,255,255,0.15); color: #2dd4bf; margin-bottom: var(--space-2);">${activeNav.toUpperCase()}</span>
      <h1 style="color: white; font-size: var(--font-size-3xl); margin-bottom: var(--space-2);">${title}</h1>
      <p style="color: var(--color-slate-200); font-size: var(--font-size-base); max-width: 720px; margin: 0;">${metaDesc}</p>
    </div>
  </section>

  <!-- Main Content Container -->
  <main style="max-width: 1280px; margin: var(--space-8) auto; padding: 0 var(--space-6); min-height: 50vh;">
    ${bodyContent}
  </main>

  <!-- Portal Login Modal with Background Blur, Dummy Passwords & Cancel Option -->
  <div class="modal-backdrop" id="modal-login" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="modal-dialog" style="max-width: 520px;">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <div class="brand-icon-box" style="width: 38px; height: 38px; font-size: 1.1rem;">
            <i class="fa-solid fa-user-lock"></i>
          </div>
          <div>
            <h3 class="modal-title" style="font-size: var(--font-size-base); margin: 0;">AuraCare Portal Sign In</h3>
            <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0;">Multi-Role Clinical & Patient Access</p>
          </div>
        </div>
        <button class="modal-close" data-modal-close aria-label="Close modal">&times;</button>
      </div>

      <div class="modal-body" style="padding: var(--space-6);">
        <div id="modal-auth-alert-box" class="hidden mb-4" style="padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs);"></div>

        <form id="form-modal-login">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="modal-login-email">Email Address <span class="required">*</span></label>
              <input type="email" id="modal-login-email" name="email" class="form-input" placeholder="e.g. admin@auracare.com" required autocomplete="email">
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label class="form-label" for="modal-login-password">Password <span class="required">*</span></label>
                <a href="/forgot-password" style="font-size: var(--font-size-xs);">Forgot Password?</a>
              </div>
              <div class="input-password-wrapper">
                <input type="password" id="modal-login-password" name="password" class="form-input" placeholder="••••••••" required autocomplete="current-password">
                <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('modal-login-password', this)" aria-label="Toggle password view" title="Show password">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr auto; gap: var(--space-3); margin-top: var(--space-2);">
              <button type="submit" id="btn-modal-login-submit" class="btn btn-primary btn-block">
                <i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal
              </button>
              <button type="button" class="btn btn-outline" data-modal-close>
                <i class="fa-solid fa-xmark"></i> Cancel
              </button>
            </div>
          </div>
        </form>

        <div style="margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--color-slate-200);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <span style="font-size: 0.7rem; font-weight: bold; color: var(--color-slate-600); text-transform: uppercase;">
              <i class="fa-solid fa-key" style="color: var(--color-primary);"></i> Quick Demo Role Sign In (Password: <code>Clinic2026!</code>)
            </span>
          </div>
          <div class="role-pills-grid">
            <button type="button" class="role-pill-btn" data-demo-email="superadmin@auracare.com" onclick="fillModalCredentials('superadmin@auracare.com', this)">👑 Super Admin</button>
            <button type="button" class="role-pill-btn" data-demo-email="admin@auracare.com" onclick="fillModalCredentials('admin@auracare.com', this)">🏥 Hospital Admin</button>
            <button type="button" class="role-pill-btn" data-demo-email="marcus.vance@auracare.com" onclick="fillModalCredentials('marcus.vance@auracare.com', this)">🩺 Doctor</button>
            <button type="button" class="role-pill-btn" data-demo-email="patient@auracare.com" onclick="fillModalCredentials('patient@auracare.com', this)">👤 Patient</button>
            <button type="button" class="role-pill-btn" data-demo-email="reception@auracare.com" onclick="fillModalCredentials('reception@auracare.com', this)">📋 Receptionist</button>
            <button type="button" class="role-pill-btn" data-demo-email="nurse@auracare.com" onclick="fillModalCredentials('nurse@auracare.com', this)">💉 Nurse</button>
            <button type="button" class="role-pill-btn" data-demo-email="lab@auracare.com" onclick="fillModalCredentials('lab@auracare.com', this)">🔬 Lab Tech</button>
            <button type="button" class="role-pill-btn" data-demo-email="pharmacy@auracare.com" onclick="fillModalCredentials('pharmacy@auracare.com', this)">💊 Pharmacist</button>
            <button type="button" class="role-pill-btn" data-demo-email="billing@auracare.com" onclick="fillModalCredentials('billing@auracare.com', this)">💰 Accountant</button>
          </div>
        </div>

        <div style="text-align: center; margin-top: var(--space-4); font-size: var(--font-size-xs); color: var(--color-slate-500);">
          New Patient? <a href="/register" class="font-semibold">Register for Patient Account</a>
        </div>
      </div>

      <div class="modal-footer" style="justify-content: space-between;">
        <span style="font-size: var(--font-size-xs); color: var(--color-slate-400);">
          <i class="fa-solid fa-lock" style="color: #2dd4bf;"></i> Secure JWT & MySQL RBAC
        </span>
        <button type="button" class="btn btn-outline btn-sm" data-modal-close>
          <i class="fa-solid fa-arrow-left"></i> Cancel & Return
        </button>
      </div>
    </div>
  </div>

  <!-- Public Footer -->
  <footer style="background: var(--color-navy-950); color: var(--color-slate-400); padding: var(--space-12) var(--space-6) var(--space-6); margin-top: var(--space-12); border-top: 1px solid rgba(255,255,255,0.08);">
    <div style="max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: var(--space-8); margin-bottom: var(--space-8);">
      <div>
        <div class="brand-logo-grid" style="color: white; margin-bottom: var(--space-3);">
          <div class="brand-icon-box"><i class="fa-solid fa-hospital"></i></div>
          <span>AuraCare Medical</span>
        </div>
        <p style="font-size: var(--font-size-sm); color: var(--color-slate-400); margin-bottom: var(--space-4);">
          International healthcare excellence delivering specialized cardiology, neurology, pediatrics, and diagnostic pathology with board-certified physicians.
        </p>
      </div>
      <div>
        <h4 style="color: white; font-size: var(--font-size-sm); margin-bottom: var(--space-3);">Quick Links</h4>
        <ul style="list-style: none; display: grid; gap: var(--space-2); font-size: var(--font-size-xs);">
          <li><a href="/about" style="color: inherit; text-decoration: none;">About Hospital</a></li>
          <li><a href="/departments" style="color: inherit; text-decoration: none;">Clinical Departments</a></li>
          <li><a href="/doctors" style="color: inherit; text-decoration: none;">Find a Doctor</a></li>
          <li><a href="/appointments" style="color: inherit; text-decoration: none;">Book Consultation</a></li>
          <li><a href="/emergency" style="color: inherit; text-decoration: none;">Emergency Services</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color: white; font-size: var(--font-size-sm); margin-bottom: var(--space-3);">Patient Care</h4>
        <ul style="list-style: none; display: grid; gap: var(--space-2); font-size: var(--font-size-xs);">
          <li><a href="javascript:void(0)" data-modal-target="modal-login" style="color: inherit; text-decoration: none;">Patient Portal</a></li>
          <li><a href="/register" style="color: inherit; text-decoration: none;">Register Online</a></li>
          <li><a href="/blog" style="color: inherit; text-decoration: none;">Health Articles</a></li>
          <li><a href="/faq" style="color: inherit; text-decoration: none;">Patient FAQs</a></li>
          <li><a href="/contact" style="color: inherit; text-decoration: none;">Contact & Directions</a></li>
        </ul>
      </div>
      <div>
        <h4 style="color: white; font-size: var(--font-size-sm); margin-bottom: var(--space-3);">Emergency & Support</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-slate-300); margin-bottom: var(--space-2);">
          <strong>24/7 Trauma Hotline:</strong><br>
          <span style="font-size: var(--font-size-base); color: #2dd4bf; font-weight: bold;">+1 (800) 555-AURA</span>
        </p>
        <p style="font-size: var(--font-size-xs); color: var(--color-slate-400);">
          100 Medical Plaza, Metro Health District<br>
          Email: concierge@auracare.com
        </p>
      </div>
    </div>
    <div style="max-width: 1280px; margin: 0 auto; padding-top: var(--space-4); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: var(--font-size-xs); color: var(--color-slate-500);">
      &copy; 2026 AuraCare Medical Center. True Multi-Page Application (MPA) Architecture.
    </div>
  </footer>

  <div class="toast-container"></div>
  <script src="/js/api.js"></script>
  <script src="/js/toast.js"></script>
  <script src="/js/modal.js"></script>
  <script src="/js/auth.js"></script>
</body>
</html>`;
}

// 1. ABOUT PAGE (/about)
const aboutContent = `
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8); align-items: center; margin-bottom: var(--space-10);">
  <div>
    <span class="badge badge-primary" style="margin-bottom: var(--space-2);">OUR MISSION</span>
    <h2 style="font-size: var(--font-size-2xl); margin-bottom: var(--space-4);">Pioneering Healthcare Excellence Since 2012</h2>
    <p class="text-muted" style="margin-bottom: var(--space-3);">
      AuraCare Medical Center is a state-of-the-art multi-specialty tertiary care hospital dedicated to providing evidence-based medicine, advanced surgical interventions, and patient-centered compassionate healthcare.
    </p>
    <p class="text-muted" style="margin-bottom: var(--space-4);">
      Equipped with 250+ inpatient beds, 12 cutting-edge operating theaters, a Level-1 Trauma Center, and a fully automated pathology diagnostic laboratory, our medical faculty serves over 100,000 patients annually.
    </p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
      <div style="padding: var(--space-3); background: var(--color-slate-50); border-radius: var(--radius-md);">
        <strong style="color: var(--color-primary); font-size: 1.25rem;">150+</strong>
        <div style="font-size: var(--font-size-xs); color: var(--color-slate-600);">Board Certified Specialists</div>
      </div>
      <div style="padding: var(--space-3); background: var(--color-slate-50); border-radius: var(--radius-md);">
        <strong style="color: var(--color-primary); font-size: 1.25rem;">99.8%</strong>
        <div style="font-size: var(--font-size-xs); color: var(--color-slate-600);">Clinical Safety Index</div>
      </div>
    </div>
  </div>
  <div class="card" style="background: var(--gradient-card); padding: var(--space-8); text-align: center;">
    <i class="fa-solid fa-hospital-user" style="font-size: 4rem; color: var(--color-primary); margin-bottom: var(--space-4);"></i>
    <h3>Joint Commission International (JCI) Accredited</h3>
    <p class="text-muted" style="font-size: var(--font-size-sm);">Certified for highest international standards of patient safety, clinical efficacy, and hygiene protocols.</p>
    <a href="/doctors" class="btn btn-primary" style="margin-top: var(--space-3);">Meet Our Medical Faculty &rarr;</a>
  </div>
</div>
`;
fs.writeFileSync(path.join(pagesDir, 'about.html'), wrapPublicPage('About Our Hospital', 'about', 'Learn about our mission, clinical faculty, accreditations, and patient-first healthcare standards.', aboutContent));

// 2. DEPARTMENTS PAGE (/departments)
const deptsContent = `
<div style="margin-bottom: var(--space-6); display: flex; justify-content: space-between; align-items: center;">
  <div>
    <h2 style="font-size: var(--font-size-2xl); margin: 0;">Clinical Centers of Excellence</h2>
    <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">Explore our specialized medical divisions backed by board-certified physicians</p>
  </div>
  <a href="/appointments" class="btn btn-primary btn-sm"><i class="fa-regular fa-calendar-check"></i> Book Consultation</a>
</div>
<div class="grid-cards-auto" id="public-depts-grid">
  <div class="card" style="padding: var(--space-6); text-align: center;"><p class="text-muted">Loading clinical departments from database...</p></div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/departments');
      if (res.success && res.data) {
        const grid = document.getElementById('public-depts-grid');
        grid.innerHTML = '';
        res.data.forEach(d => {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = \`
            <div class="card-body" style="text-align: center; padding: var(--space-6);">
              <div class="stat-icon-wrapper stat-icon-teal" style="margin: 0 auto var(--space-4); width: 64px; height: 64px; font-size: 1.75rem;">
                <i class="fa-solid \${d.icon || 'fa-heart-pulse'}"></i>
              </div>
              <h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-2);">\${d.name}</h3>
              <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-4); min-height: 48px;">
                \${d.description || 'Specialized diagnostics, treatment protocols, and inpatient recovery.'}
              </p>
              <div style="font-size: var(--font-size-xs); font-weight: bold; color: var(--color-primary); margin-bottom: var(--space-4);">
                \${d.doctor_count || 2} Available Doctors
              </div>
              <a href="/doctors?dept=\${d.id}" class="btn btn-outline btn-sm btn-block">View Specialists &rarr;</a>
            </div>
          \`;
          grid.appendChild(card);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(pagesDir, 'departments.html'), wrapPublicPage('Clinical Departments', 'departments', 'Explore AuraCare medical divisions: Cardiology, Neurology, Pediatrics, Orthopedics, General Medicine, and Dermatology.', deptsContent));

// 3. DOCTORS DIRECTORY PAGE (/doctors)
const doctorsContent = `
<div style="margin-bottom: var(--space-6); display: flex; justify-content: space-between; align-items: center;">
  <div>
    <h2 style="font-size: var(--font-size-2xl); margin: 0;">Our Medical Faculty & Specialists</h2>
    <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">Consult with certified healthcare leaders in their respective medical specialties</p>
  </div>
</div>
<div class="grid-cards-auto" id="public-doctors-grid">
  <div class="card" style="padding: var(--space-6); text-align: center;"><p class="text-muted">Loading doctor directory from MySQL...</p></div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/doctors');
      if (res.success && res.data) {
        const grid = document.getElementById('public-doctors-grid');
        grid.innerHTML = '';
        res.data.forEach(doc => {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = \`
            <div class="card-body" style="padding: var(--space-6); text-align: center;">
              <div class="doctor-avatar-placeholder" style="margin: 0 auto var(--space-4); width: 84px; height: 84px; font-size: 2.25rem;">
                <i class="fa-solid fa-user-doctor"></i>
              </div>
              <h3 style="font-size: var(--font-size-lg); margin-bottom: 2px;">\${doc.name}</h3>
              <div style="color: var(--color-primary); font-size: var(--font-size-sm); font-weight: bold; margin-bottom: var(--space-1);">\${doc.specialization}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-slate-500); margin-bottom: var(--space-3);">\${doc.department_name} • \${doc.qualification}</div>
              <p class="text-muted" style="font-size: var(--font-size-xs); min-height: 36px; margin-bottom: var(--space-4);">
                \${doc.bio || 'Specialized in advanced clinical consultations and preventative treatment.'}
              </p>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-slate-100); padding-top: var(--space-3); margin-bottom: var(--space-4); font-size: var(--font-size-xs);">
                <span>Fee: <strong>$\${parseFloat(doc.consultation_fee).toFixed(2)}</strong></span>
                <span>Exp: <strong>\${doc.experience_years} yrs</strong></span>
              </div>
              <a href="/appointments?doctor=\${doc.id}" class="btn btn-primary btn-sm btn-block">Book Consultation</a>
            </div>
          \`;
          grid.appendChild(card);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(pagesDir, 'doctors.html'), wrapPublicPage('Find a Doctor', 'doctors', 'Browse our physician directory by department, credentials, experience, and consultation fees.', doctorsContent));

// 4. SERVICES PAGE (/services)
const servicesContent = `
<div style="margin-bottom: var(--space-6);">
  <h2 style="font-size: var(--font-size-2xl); margin: 0;">Comprehensive Hospital & Diagnostic Services</h2>
  <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">Advanced medical infrastructure designed for swift diagnostic accuracy and recovery</p>
</div>
<div class="grid-cards-auto" id="public-services-grid">
  <div class="card" style="padding: var(--space-6); text-align: center;"><p class="text-muted">Loading services from database...</p></div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/services');
      if (res.success && res.data) {
        const grid = document.getElementById('public-services-grid');
        grid.innerHTML = '';
        res.data.forEach(s => {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = \`
            <div class="card-body" style="padding: var(--space-6);">
              <div class="stat-icon-wrapper stat-icon-blue" style="margin-bottom: var(--space-4);">
                <i class="fa-solid \${s.icon}"></i>
              </div>
              <h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-2);">\${s.name}</h3>
              <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
                \${s.description}
              </p>
              <a href="/appointments" class="btn btn-outline btn-sm">Schedule Service &rarr;</a>
            </div>
          \`;
          grid.appendChild(card);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(pagesDir, 'services.html'), wrapPublicPage('Clinical Services', 'services', 'Inpatient wards, emergency trauma care, robotic surgery, digital pathology, radiology, and outpatient clinics.', servicesContent));

// 5. APPOINTMENTS PAGE (/appointments)
const appointmentsContent = `
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8); align-items: start;">
  <div class="card" style="padding: var(--space-6);">
    <h3 style="margin-bottom: var(--space-1);"><i class="fa-regular fa-calendar-check text-primary"></i> Book Doctor Appointment</h3>
    <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-4);">Direct scheduling into AuraCare clinical calendar in MySQL</p>
    <form id="public-booking-form">
      <div class="form-grid">
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="pb-fname">First Name <span class="required">*</span></label>
            <input type="text" id="pb-fname" name="first_name" class="form-input" placeholder="David" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="pb-lname">Last Name <span class="required">*</span></label>
            <input type="text" id="pb-lname" name="last_name" class="form-input" placeholder="Miller" required>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="pb-phone">Mobile Phone <span class="required">*</span></label>
            <input type="tel" id="pb-phone" name="phone" class="form-input" placeholder="+1 (555) 019-2834" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="pb-email">Email Address</label>
            <input type="email" id="pb-email" name="email" class="form-input" placeholder="david.miller@example.com">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="pb-dept">Specialty Department <span class="required">*</span></label>
            <select id="pb-dept" name="department_id" class="form-select" required>
              <option value="1">Cardiology</option>
              <option value="2">Neurology</option>
              <option value="3">Pediatrics</option>
              <option value="4">Orthopedics</option>
              <option value="5" selected>General Medicine</option>
              <option value="6">Dermatology</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="pb-date">Preferred Date <span class="required">*</span></label>
            <input type="date" id="pb-date" name="appointment_date" class="form-input" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="pb-reason">Chief Complaint / Medical Reason <span class="required">*</span></label>
          <textarea id="pb-reason" name="reason" rows="3" class="form-textarea" placeholder="Describe symptoms, duration, or follow-up reason..." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-submit-appt">Confirm & Schedule Visit</button>
      </div>
    </form>
  </div>

  <div>
    <div class="card" style="padding: var(--space-6); background: var(--gradient-card); margin-bottom: var(--space-4);">
      <h4><i class="fa-solid fa-circle-info text-primary"></i> Consultation Guidelines</h4>
      <ul style="padding-left: var(--space-4); font-size: var(--font-size-sm); color: var(--color-slate-600); display: grid; gap: var(--space-2); margin-top: var(--space-3);">
        <li>Please arrive 15 minutes before your scheduled appointment time for biometric check-in.</li>
        <li>Bring prior medical reports, recent blood test results, and current medication lists.</li>
        <li>You will receive an automated appointment confirmation reference number upon booking.</li>
        <li>Existing registered patients can also log in to their <a href="/login">Patient Portal</a> to view upcoming visits.</li>
      </ul>
    </div>
    <div class="card" style="padding: var(--space-6); text-align: center;">
      <div style="font-size: 2.5rem; color: var(--color-danger); margin-bottom: var(--space-2);"><i class="fa-solid fa-truck-medical"></i></div>
      <h4>Experiencing a Medical Emergency?</h4>
      <p class="text-muted" style="font-size: var(--font-size-sm);">For severe chest pain, stroke symptoms, or acute trauma, call our immediate emergency line or proceed directly to our 24/7 ER.</p>
      <a href="tel:8005552872" class="btn btn-danger btn-lg"><i class="fa-solid fa-phone"></i> Call +1 (800) 555-AURA</a>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('pb-date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.min = today;
      dateInput.value = today;
    }

    const form = document.getElementById('public-booking-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-appt');
      btn.disabled = true;
      btn.textContent = 'Processing Booking...';

      const payload = {
        first_name: form.first_name.value.trim(),
        last_name: form.last_name.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim() || undefined,
        department_id: parseInt(form.department_id.value, 10),
        appointment_date: form.appointment_date.value,
        reason: form.reason.value.trim()
      };

      try {
        const res = await API.post('/appointments', payload);
        if (res.success) {
          Toast.success(\`Appointment booked! Reference: \${res.data.appointmentNumber}\`);
          form.reset();
          dateInput.value = new Date().toISOString().split('T')[0];
        }
      } catch (err) {
        Toast.error(err.message || 'Failed to submit appointment.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm & Schedule Visit';
      }
    });
  });
</script>
`;
fs.writeFileSync(path.join(pagesDir, 'appointments.html'), wrapPublicPage('Book an Appointment', 'appointments', 'Schedule outpatient clinical consultations with board-certified physicians in our MySQL management system.', appointmentsContent));

// 6. EMERGENCY PAGE (/emergency)
const emergencyContent = `
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8); align-items: center;">
  <div>
    <span class="badge badge-danger" style="margin-bottom: var(--space-2);">LEVEL-1 TRAUMA CENTER</span>
    <h2 style="font-size: var(--font-size-3xl); color: var(--color-danger); margin-bottom: var(--space-3);">24/7 Emergency & Acute Resuscitation</h2>
    <p class="text-muted" style="margin-bottom: var(--space-4);">
      AuraCare Emergency Department operates 24 hours a day, 365 days a year. Our board-certified emergency physicians, trauma surgeons, and critical care nurses are on standby with zero triage delay for life-threatening conditions.
    </p>
    <div style="background: var(--color-danger-light); border-left: 4px solid var(--color-danger); padding: var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-6);">
      <h4 style="color: var(--color-danger); margin-bottom: var(--space-1);">Immediate Emergency Hotline</h4>
      <div style="font-size: 1.75rem; font-weight: bold; color: var(--color-danger);">+1 (800) 555-AURA</div>
      <div style="font-size: var(--font-size-xs); color: var(--color-slate-600);">Direct ambulance dispatch & trauma team alert</div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
      <div class="card" style="padding: var(--space-4);"><i class="fa-solid fa-heart-pulse text-danger"></i> <strong>STEMI Center</strong><p class="text-muted text-xs">90-minute door-to-balloon cardiac cath lab</p></div>
      <div class="card" style="padding: var(--space-4);"><i class="fa-solid fa-brain text-primary"></i> <strong>Comprehensive Stroke</strong><p class="text-muted text-xs">24/7 tPA & neuro-endovascular intervention</p></div>
    </div>
  </div>
  <div class="card" style="padding: var(--space-8); background: var(--color-slate-900); color: white;">
    <h3 style="color: white; margin-bottom: var(--space-4);">When to Seek Emergency Care</h3>
    <ul style="list-style: none; display: grid; gap: var(--space-3); font-size: var(--font-size-sm); color: var(--color-slate-300);">
      <li><i class="fa-solid fa-triangle-exclamation text-danger"></i> Sudden crushing chest pain or pressure</li>
      <li><i class="fa-solid fa-triangle-exclamation text-danger"></i> Facial drooping, arm weakness, slurred speech</li>
      <li><i class="fa-solid fa-triangle-exclamation text-danger"></i> Severe respiratory distress or anaphylaxis</li>
      <li><i class="fa-solid fa-triangle-exclamation text-danger"></i> Uncontrolled bleeding or major fractures</li>
      <li><i class="fa-solid fa-triangle-exclamation text-danger"></i> Sudden loss of consciousness or head trauma</li>
    </ul>
    <div style="margin-top: var(--space-6);">
      <a href="tel:8005552872" class="btn btn-danger btn-lg btn-block"><i class="fa-solid fa-phone"></i> Call Emergency Dispatch</a>
    </div>
  </div>
</div>
`;
fs.writeFileSync(path.join(pagesDir, 'emergency.html'), wrapPublicPage('Emergency & Trauma Department', 'emergency', 'Level-1 Emergency department equipped for cardiac STEMI arrest, acute stroke, and multi-system trauma resuscitation.', emergencyContent));

// 7. BLOG PAGE (/blog)
const blogContent = `
<div style="margin-bottom: var(--space-6);">
  <h2 style="font-size: var(--font-size-2xl); margin: 0;">Clinical Insights & Medical Discoveries</h2>
  <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">Articles published by AuraCare physicians and research faculty</p>
</div>
<div class="grid-cards-auto" id="public-blog-grid">
  <div class="card" style="padding: var(--space-6); text-align: center;"><p class="text-muted">Loading clinical articles from database...</p></div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await API.get('/blog');
      if (res.success && res.data) {
        const grid = document.getElementById('public-blog-grid');
        grid.innerHTML = '';
        res.data.forEach(p => {
          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = \`
            <div class="card-body" style="padding: var(--space-6);">
              <span class="badge badge-info" style="margin-bottom: var(--space-2);">\${p.category}</span>
              <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);"><a href="/blog-details?slug=\${p.slug}" style="color: inherit; text-decoration: none;">\${p.title}</a></h3>
              <p class="text-muted" style="font-size: var(--font-size-xs); margin-bottom: var(--space-4); min-height: 48px;">
                \${p.summary || p.content.slice(0, 120) + '...'}
              </p>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-slate-400); border-top: 1px solid var(--color-slate-100); padding-top: var(--space-3);">
                <span><i class="fa-solid fa-user-pen"></i> \${p.author}</span>
                <span>\${p.published_at}</span>
              </div>
            </div>
          \`;
          grid.appendChild(card);
        });
      }
    } catch (err) { console.error(err); }
  });
</script>
`;
fs.writeFileSync(path.join(pagesDir, 'blog.html'), wrapPublicPage('Medical Blog & Health News', 'blog', 'Evidence-based clinical health articles on cardiology, neurology, pediatrics, and preventive wellness.', blogContent));

// 8. BLOG DETAILS PAGE (/blog-details)
const blogDetailsContent = `
<div class="card" style="padding: var(--space-8); max-width: 900px; margin: 0 auto;" id="blog-details-container">
  <p class="text-muted">Loading article details...</p>
</div>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug') || 'early-detection-cardiovascular-disease';
    try {
      const res = await API.get('/blog/' + slug);
      if (res.success && res.data) {
        const p = res.data;
        document.getElementById('blog-details-container').innerHTML = \`
          <span class="badge badge-primary" style="margin-bottom: var(--space-2);">\${p.category}</span>
          <h1 style="font-size: var(--font-size-2xl); margin-bottom: var(--space-3); color: var(--color-navy-900);">\${p.title}</h1>
          <div style="font-size: var(--font-size-xs); color: var(--color-slate-400); margin-bottom: var(--space-6); border-bottom: 1px solid var(--color-slate-100); padding-bottom: var(--space-3);">
            Published by <strong>\${p.author}</strong> on \${p.published_at}
          </div>
          <div style="font-size: var(--font-size-base); line-height: 1.8; color: var(--color-slate-700); margin-bottom: var(--space-8);">
            \${p.content}
          </div>
          <a href="/blog" class="btn btn-outline btn-sm">&larr; Back to Health Articles</a>
        \`;
      }
    } catch (err) {
      document.getElementById('blog-details-container').innerHTML = '<p class="text-danger">Article not found.</p>';
    }
  });
</script>
`;
fs.writeFileSync(path.join(pagesDir, 'blog-details.html'), wrapPublicPage('Clinical Article Details', 'blog', 'Read our medical specialist insights and health recommendations.', blogDetailsContent));

// 9. FAQ PAGE (/faq)
const faqContent = `
<div style="max-width: 860px; margin: 0 auto;">
  <h2 style="font-size: var(--font-size-2xl); margin-bottom: var(--space-6); text-align: center;">Frequently Asked Patient Questions</h2>
  <div style="display: grid; gap: var(--space-4);">
    <div class="card" style="padding: var(--space-5);">
      <h4 style="color: var(--color-navy-900); margin-bottom: var(--space-2);"><i class="fa-regular fa-circle-question text-primary"></i> How do I book an appointment with a specialist?</h4>
      <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">You can schedule directly via our <a href="/appointments">Online Appointment Page</a>, call our 24/7 registration desk, or log into the <a href="/login">Patient Portal</a>.</p>
    </div>
    <div class="card" style="padding: var(--space-5);">
      <h4 style="color: var(--color-navy-900); margin-bottom: var(--space-2);"><i class="fa-regular fa-circle-question text-primary"></i> Which insurance plans does AuraCare accept?</h4>
      <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">We accept all major commercial health insurance carriers including BlueCross, Aetna, Cigna, UnitedHealthcare, Medicare, and international policy plans.</p>
    </div>
    <div class="card" style="padding: var(--space-5);">
      <h4 style="color: var(--color-navy-900); margin-bottom: var(--space-2);"><i class="fa-regular fa-circle-question text-primary"></i> How fast are pathology and radiology results available?</h4>
      <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">Routine blood panels (CBC, Metabolic Panel) are processed within 2 to 4 hours. Imaging (X-Ray, CT, MRI) reports are uploaded to your patient portal within 24 hours.</p>
    </div>
    <div class="card" style="padding: var(--space-5);">
      <h4 style="color: var(--color-navy-900); margin-bottom: var(--space-2);"><i class="fa-regular fa-circle-question text-primary"></i> Can I access my medical records and prescriptions online?</h4>
      <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">Yes. Every registered patient has immediate 24/7 access to clinical consultation notes, prescriptions, and billing receipts in the <a href="/patient/dashboard">Patient Portal</a>.</p>
    </div>
  </div>
</div>
`;
fs.writeFileSync(path.join(pagesDir, 'faq.html'), wrapPublicPage('Frequently Asked Questions', 'faq', 'Patient guidelines, insurance coverage, appointment booking, lab turnarounds, and portal access answers.', faqContent));

// 10. CONTACT PAGE (/contact)
const contactContent = `
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8); align-items: start;">
  <div class="card" style="padding: var(--space-6);">
    <h3 style="margin-bottom: var(--space-1);">Send Us a Message</h3>
    <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-4);">Our hospital patient advocacy team will respond within 24 hours.</p>
    <form id="contact-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="cf-name">Full Name <span class="required">*</span></label>
          <input type="text" id="cf-name" name="name" class="form-input" placeholder="Sarah Miller" required>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="cf-email">Email Address <span class="required">*</span></label>
            <input type="email" id="cf-email" name="email" class="form-input" placeholder="sarah@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="cf-phone">Phone Number</label>
            <input type="tel" id="cf-phone" name="phone" class="form-input" placeholder="+1 (555) 019-2233">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="cf-subj">Subject <span class="required">*</span></label>
          <input type="text" id="cf-subj" name="subject" class="form-input" placeholder="Billing inquiry / Appointment follow-up" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="cf-msg">Message <span class="required">*</span></label>
          <textarea id="cf-msg" name="message" rows="4" class="form-textarea" placeholder="How can we assist you today?..." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Send Message to Concierge</button>
      </div>
    </form>
  </div>

  <div>
    <div class="card" style="padding: var(--space-6); margin-bottom: var(--space-4);">
      <h4><i class="fa-solid fa-hospital text-primary"></i> AuraCare Medical Campus</h4>
      <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-3);">
        100 Medical Plaza, Metro Health District, CA 90210
      </p>
      <div style="font-size: var(--font-size-sm); display: grid; gap: var(--space-2); color: var(--color-slate-600);">
        <div><i class="fa-solid fa-phone text-primary"></i> General Inquiries: +1 (800) 555-0100</div>
        <div><i class="fa-solid fa-envelope text-primary"></i> Email: info@auracare.com</div>
        <div><i class="fa-solid fa-clock text-primary"></i> Visiting Hours: 08:00 AM – 08:00 PM Daily</div>
      </div>
    </div>
  </div>
</div>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await API.post('/contact', {
          name: form.name.value.trim(),
          email: form.email.value.trim(),
          phone: form.phone.value.trim() || undefined,
          subject: form.subject.value.trim(),
          message: form.message.value.trim()
        });
        Toast.success(res.message || 'Message sent successfully.');
        form.reset();
      } catch (err) {
        Toast.error(err.message || 'Failed to submit contact message.');
      }
    });
  });
</script>
`;
fs.writeFileSync(path.join(pagesDir, 'contact.html'), wrapPublicPage('Contact & Location', 'contact', 'Get in touch with AuraCare concierge, patient advocacy, visiting hours, and directions.', contactContent));

console.log('✅ [MPA BUILDER] All 10 public pages generated.');
