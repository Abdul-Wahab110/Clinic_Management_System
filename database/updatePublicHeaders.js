const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../public/pages');

const publicPages = [
  { file: 'about.html', title: 'About Us', active: 'about' },
  { file: 'departments.html', title: 'Medical Departments', active: 'departments' },
  { file: 'doctors.html', title: 'Specialist Physicians', active: 'doctors' },
  { file: 'services.html', title: 'Clinical Services', active: 'services' },
  { file: 'appointments.html', title: 'Doctor Appointments', active: 'appointments' },
  { file: 'emergency.html', title: 'Level-1 Emergency & Trauma', active: 'emergency' },
  { file: 'blog.html', title: 'Healthcare News & Articles', active: 'blog' },
  { file: 'blog-details.html', title: 'Health Article', active: 'blog' },
  { file: 'faq.html', title: 'Frequently Asked Questions', active: 'faq' },
  { file: 'contact.html', title: 'Contact Us', active: 'contact' }
];

function getHeaderHtml(activeNav) {
  return `  <!-- Top Bar -->
  <div class="site-topbar">
    <div class="container site-topbar-inner">
      <div class="topbar-left">
        <span><i class="fa-solid fa-phone" style="color: #2dd4bf;"></i> 24/7 Trauma: <strong>+1 (800) 555-AURA</strong></span>
        <span style="background: rgba(45,212,191,0.15); color: #2dd4bf; padding: 2px 8px; border-radius: 4px; font-weight: 600;"><i class="fa-solid fa-clock"></i> Open 24/7</span>
      </div>
      <div class="topbar-right">
        <span><i class="fa-solid fa-location-dot" style="color: #2dd4bf;"></i> 100 Medical Plaza, Metro Health District</span>
      </div>
    </div>
  </div>

  <!-- Main Header -->
  <header class="site-header">
    <div class="container header-container">
      <!-- Brand Logo -->
      <a href="/" class="brand-logo-grid">
        <div class="brand-icon-box">
          <i class="fa-solid fa-staff-snake"></i>
        </div>
        <div>
          <span class="brand-name">AuraCare</span>
          <span class="brand-sub">MEDICAL CENTER</span>
        </div>
      </a>

      <!-- Desktop Navigation Menu -->
      <nav class="desktop-nav" aria-label="Main Navigation">
        <ul class="nav-links-list">
          <li><a href="/" class="nav-link ${activeNav === 'home' ? 'active' : ''}">Home</a></li>
          <li><a href="/about" class="nav-link ${activeNav === 'about' ? 'active' : ''}">About</a></li>
          <li><a href="/departments" class="nav-link ${activeNav === 'departments' ? 'active' : ''}">Departments</a></li>
          <li><a href="/doctors" class="nav-link ${activeNav === 'doctors' ? 'active' : ''}">Doctors</a></li>
          <li><a href="/services" class="nav-link ${activeNav === 'services' ? 'active' : ''}">Services</a></li>
          <li><a href="/appointments" class="nav-link ${activeNav === 'appointments' ? 'active' : ''}">Appointments</a></li>
          <li><a href="/emergency" class="nav-link nav-link-emergency ${activeNav === 'emergency' ? 'active' : ''}"><i class="fa-solid fa-truck-medical"></i> Emergency</a></li>
          <li><a href="/contact" class="nav-link ${activeNav === 'contact' ? 'active' : ''}">Contact</a></li>
        </ul>
      </nav>

      <!-- Header Actions -->
      <div class="header-actions">
        <!-- Live System Health Badge (Pill) -->
        <div class="health-badge" id="system-health-badge" title="Connecting to backend...">
          <span class="health-dot" id="health-dot"></span>
          <span class="health-text" id="health-text">Online • MySQL</span>
        </div>

        <!-- Auth Action Buttons (Desktop & Tablet) -->
        <div id="header-auth-actions" class="header-auth-actions">
          <button class="btn btn-outline-primary btn-sm" data-modal-target="modal-login">
            <i class="fa-solid fa-user-lock"></i> <span>Sign In</span>
          </button>
          <a href="/appointments" class="btn btn-primary btn-sm">
            <i class="fa-regular fa-calendar-check"></i> <span>Book Visit</span>
          </a>
        </div>

        <!-- Mobile Hamburger Toggle Button -->
        <button class="mobile-nav-toggle" id="mobile-nav-toggle" aria-label="Toggle navigation menu">
          <i class="fa-solid fa-bars" id="mobile-nav-icon"></i>
        </button>
      </div>
    </div>

    <!-- Mobile Navigation Drawer / Dropdown -->
    <div class="mobile-nav-drawer" id="mobile-nav-drawer">
      <ul class="mobile-nav-links">
        <li><a href="/" class="mobile-nav-link ${activeNav === 'home' ? 'active' : ''}"><i class="fa-solid fa-house"></i> Home</a></li>
        <li><a href="/about" class="mobile-nav-link ${activeNav === 'about' ? 'active' : ''}"><i class="fa-solid fa-circle-info"></i> About Us</a></li>
        <li><a href="/departments" class="mobile-nav-link ${activeNav === 'departments' ? 'active' : ''}"><i class="fa-solid fa-hospital"></i> Medical Departments</a></li>
        <li><a href="/doctors" class="mobile-nav-link ${activeNav === 'doctors' ? 'active' : ''}"><i class="fa-solid fa-user-doctor"></i> Our Physicians</a></li>
        <li><a href="/services" class="mobile-nav-link ${activeNav === 'services' ? 'active' : ''}"><i class="fa-solid fa-stethoscope"></i> Clinical Services</a></li>
        <li><a href="/appointments" class="mobile-nav-link ${activeNav === 'appointments' ? 'active' : ''}"><i class="fa-regular fa-calendar-check"></i> Book Appointment</a></li>
        <li><a href="/emergency" class="mobile-nav-link text-danger font-bold ${activeNav === 'emergency' ? 'active' : ''}"><i class="fa-solid fa-truck-medical"></i> Emergency 24/7</a></li>
        <li><a href="/contact" class="mobile-nav-link ${activeNav === 'contact' ? 'active' : ''}"><i class="fa-solid fa-envelope"></i> Contact Us</a></li>
      </ul>
      <div class="mobile-nav-auth" id="mobile-nav-auth">
        <button class="btn btn-outline-primary btn-block" data-modal-target="modal-login">
          <i class="fa-solid fa-user-lock"></i> Staff / Patient Sign In
        </button>
        <a href="/appointments" class="btn btn-primary btn-block">
          <i class="fa-regular fa-calendar-check"></i> Request Consultation
        </a>
      </div>
    </div>
  </header>`;
}

publicPages.forEach(p => {
  const filePath = path.join(pagesDir, p.file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace Topbar & Header
  const headerRegex = /<!-- Public Top Bar -->[\s\S]*?<\/header>/i;
  const oldHeaderRegex = /<header[\s\S]*?<\/header>/i;

  const newHeader = getHeaderHtml(p.active);

  if (headerRegex.test(content)) {
    content = content.replace(headerRegex, newHeader);
  } else if (oldHeaderRegex.test(content)) {
    // Check if there was top bar before header
    const topBarRegex = /<!-- Top Bar[\s\S]*?<\/header>/i;
    if (topBarRegex.test(content)) {
      content = content.replace(topBarRegex, newHeader);
    } else {
      content = content.replace(oldHeaderRegex, newHeader);
    }
  }

  if (!content.includes('/js/responsive.js')) {
    content = content.replace('</body>', '  <script src="/js/responsive.js"></script>\n</body>');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Standardized Header & Responsive Scripts in: ${p.file}`);
});

console.log('🎉 All public pages updated with responsive header & drawer!');
