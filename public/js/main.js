/**
 * AuraCare Medical Center - Public Homepage Master Client Script
 * Complete dynamic MySQL integration for all public website sections:
 * Health status, Departments, Doctors, Services, Statistics, Testimonials, Blog Articles, Contact & Quick Booking
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('logged_out')) {
    if (typeof Toast !== 'undefined') {
      Toast.info('You have been signed out successfully.');
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 1. Initialize Hospital Settings Dynamic Loader
  if (typeof HospitalSettings !== 'undefined') {
    await HospitalSettings.load();
  }

  // 2. Initialize Dynamic Public Sections
  initHealthCheck();
  initDepartments();
  initDoctors();
  initTestimonials();
  initHealthArticles();
  initQuickBookingForm();
  initContactInquiryForm();
  initReviewSubmission();

  // 3. Update Header Navigation based on Session
  if (typeof Auth !== 'undefined') {
    Auth.updatePublicHeaderNav();
  }
});

/**
 * 1. Live System & MySQL Health Verification
 */
async function initHealthCheck() {
  const badge = document.getElementById('system-health-badge');
  const dot = document.getElementById('health-dot');
  const text = document.getElementById('health-text');

  if (!badge) return;

  try {
    const res = await API.checkHealth();
    if (res.success && res.data && res.data.status === 'healthy') {
      if (dot) dot.className = 'health-dot online';
      if (text) text.textContent = `Online • MySQL ${res.data.database?.latencyMs || 2}ms`;
      badge.title = `Backend Uptime: ${res.data.uptimeSeconds}s | Latency: ${res.data.database?.latencyMs || 2}ms`;
    } else {
      if (dot) dot.className = 'health-dot degraded';
      if (text) text.textContent = 'Degraded Performance';
    }
  } catch (err) {
    if (dot) dot.className = 'health-dot offline';
    if (text) text.textContent = 'System Offline';
    badge.title = 'Unable to connect to backend API server';
  }
}

/**
 * 2. Fetch & Render Clinical Departments from MySQL (/api/v1/departments)
 */
async function initDepartments() {
  const container = document.getElementById('departments-grid');
  const selectDropdown = document.getElementById('quick-appt-department');
  const contactDeptSelect = document.getElementById('contact-dept-select');
  if (!container) return;

  try {
    const res = await API.get('/departments');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      container.innerHTML = '';
      if (selectDropdown) selectDropdown.innerHTML = '<option value="">-- Select Clinical Department --</option>';
      if (contactDeptSelect) contactDeptSelect.innerHTML = '<option value="">-- General / No Preference --</option>';

      // Update stat count if stat element exists
      const deptStat = document.getElementById('stat-departments-count');
      if (deptStat) deptStat.textContent = `${res.data.length}+`;

      res.data.slice(0, 8).forEach((dept) => {
        const card = document.createElement('div');
        card.className = 'card card-interactive';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';

        let iconClass = 'fa-stethoscope';
        if (dept.code === 'CARD') iconClass = 'fa-heart-pulse';
        else if (dept.code === 'NEUR') iconClass = 'fa-brain';
        else if (dept.code === 'PED') iconClass = 'fa-baby';
        else if (dept.code === 'ORTH') iconClass = 'fa-bone';
        else if (dept.code === 'ONC') iconClass = 'fa-dna';
        else if (dept.code === 'DERM') iconClass = 'fa-hand-dots';
        else if (dept.code === 'EMER') iconClass = 'fa-truck-medical text-danger';

        card.innerHTML = `
          <div class="card-body" style="display: flex; flex-direction: column; flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
              <div class="specialty-icon-box">
                <i class="fa-solid ${iconClass}"></i>
              </div>
              <span class="badge badge-light" style="font-size: 0.65rem; font-weight: 700;">${escapeHtml(dept.code || 'DEPT')}</span>
            </div>
            
            <h4 style="margin: 0 0 var(--space-2) 0; font-size: 1.1rem; color: var(--color-navy-900);">${escapeHtml(dept.name)}</h4>
            <p class="text-muted text-xs" style="margin: 0 0 var(--space-4) 0; line-height: 1.5; flex: 1;">
              ${escapeHtml(dept.description || 'Comprehensive outpatient evaluation, specialized diagnostic workup, and evidence-based therapeutic care.')}
            </p>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-slate-100); padding-top: var(--space-3);">
              <span class="badge badge-primary" style="font-size: 0.68rem;">
                <i class="fa-solid fa-user-doctor"></i> ${dept.doctors_count || dept.doctor_count || 0} Specialists
              </span>
              <button class="btn btn-outline-primary btn-xs" onclick="filterDoctorsByDept(${dept.id}, '${escapeHtml(dept.name)}')">
                View Faculty &rarr;
              </button>
            </div>
          </div>
        `;
        container.appendChild(card);
      });

      // Populate department selectors
      res.data.forEach(dept => {
        if (selectDropdown) {
          const opt = document.createElement('option');
          opt.value = dept.id;
          opt.textContent = `${dept.name} (${dept.code})`;
          selectDropdown.appendChild(opt);
        }
        if (contactDeptSelect) {
          const opt2 = document.createElement('option');
          opt2.value = dept.id;
          opt2.textContent = dept.name;
          contactDeptSelect.appendChild(opt2);
        }
      });

      // Dynamic filter: when department changes, re-filter doctors dropdown
      if (selectDropdown && !selectDropdown.dataset.listenerAttached) {
        selectDropdown.dataset.listenerAttached = 'true';
        selectDropdown.addEventListener('change', (e) => {
          const selectedDeptId = e.target.value ? parseInt(e.target.value, 10) : null;
          initDoctors(selectedDeptId);
        });
      }
    } else {
      if (selectDropdown) selectDropdown.innerHTML = '<option value="">-- No Departments in Database (Run Seeds) --</option>';
      if (contactDeptSelect) contactDeptSelect.innerHTML = '<option value="">-- General / No Preference --</option>';
      container.innerHTML = `<p class="text-muted text-center" style="grid-column: 1 / -1; padding: var(--space-8);">No departments found in MySQL. Please run <code>npm run db:init</code> to seed departments.</p>`;
    }
  } catch (err) {
    if (selectDropdown) selectDropdown.innerHTML = '<option value="">-- Error Loading Departments --</option>';
    container.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: var(--space-6); text-align: center; color: var(--color-danger);">Unable to load clinical departments: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * 3. Fetch & Render Distinguished Doctors from MySQL (/api/v1/doctors)
 */
async function initDoctors(departmentId = null) {
  const container = document.getElementById('doctors-grid');
  const doctorSelect = document.getElementById('quick-appt-doctor');
  if (!container) return;

  try {
    const res = await API.get('/doctors', departmentId ? { department_id: departmentId } : null);
    if (res.success && res.data) {
      const docs = res.data;
      
      const docStat = document.getElementById('stat-doctors-count');
      if (docStat) docStat.textContent = `${docs.length}+`;

      if (docs.length === 0) {
        if (doctorSelect) doctorSelect.innerHTML = '<option value="">-- No Specialists Available --</option>';
        container.innerHTML = `<p class="text-muted text-center" style="grid-column: 1 / -1; padding: var(--space-8);">No specialists available in MySQL right now.</p>`;
        return;
      }

      container.innerHTML = '';
      docs.slice(0, 6).forEach((doc) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';

        const initial = doc.name.replace(/^Dr\.\s*/i, '').charAt(0) || 'D';
        const fee = parseFloat(doc.consultation_fee) || 120;

        card.innerHTML = `
          <div class="card-body" style="display: flex; flex-direction: column; flex: 1;">
            <div style="display: flex; gap: var(--space-3); align-items: center; margin-bottom: var(--space-3);">
              <div class="doctor-avatar-placeholder" style="width: 52px; height: 52px; font-size: 1.3rem; border-radius: var(--radius-lg); background: var(--gradient-primary); color: white; display: grid; place-items: center; font-weight: bold;">
                ${initial}
              </div>
              <div>
                <h4 style="margin: 0; font-size: 1.05rem; color: var(--color-navy-900);">${escapeHtml(doc.name)}</h4>
                <span class="badge badge-info mt-1" style="font-size: 0.65rem;">${escapeHtml(doc.department_name || 'Specialty Clinic')}</span>
              </div>
            </div>

            <div class="text-xs text-muted" style="margin-bottom: var(--space-3); line-height: 1.5; flex: 1;">
              <div><strong>Specialization:</strong> ${escapeHtml(doc.specialization || 'Consultant Physician')}</div>
              <div><strong>Qualifications:</strong> ${escapeHtml(doc.qualification || 'MBBS, MD / Board Certified')}</div>
              <div><strong>Experience:</strong> ${doc.experience_years || 8}+ Years &bull; <strong>Room:</strong> ${doc.room_number || 'OPD'}</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-slate-100); padding-top: var(--space-3);">
              <div>
                <span class="text-xs text-muted">Consultation Fee</span>
                <div style="font-weight: 800; font-size: 1.1rem; color: var(--color-navy-900);">${typeof HospitalSettings !== 'undefined' ? HospitalSettings.formatCurrency(fee) : '$' + fee.toFixed(2)}</div>
              </div>
              <button class="btn btn-primary btn-xs" onclick="selectDoctorForQuickBooking(${doc.id}, ${doc.department_id || "''"})">
                <i class="fa-regular fa-calendar-check"></i> Book Visit
              </button>
            </div>
          </div>
        `;
        container.appendChild(card);
      });

      // Populate doctor select dropdown
      if (doctorSelect) {
        doctorSelect.innerHTML = '<option value="">-- Any Available Specialist --</option>';
        docs.forEach(doc => {
          const opt = document.createElement('option');
          opt.value = doc.id;
          opt.textContent = `${doc.name} - ${doc.specialization} (${doc.department_name})`;
          doctorSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    container.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: var(--space-6); text-align: center; color: var(--color-danger);">Unable to load physicians: ${escapeHtml(err.message)}</div>`;
  }
}

window.filterDoctorsByDept = (deptId, deptName) => {
  const titleEl = document.getElementById('doctors-section-filter-title');
  if (titleEl) titleEl.textContent = `Senior Specialists in ${deptName}`;
  initDoctors(deptId);
  const section = document.getElementById('doctors-section');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
};

window.selectDoctorForQuickBooking = (doctorId, departmentId) => {
  const deptSelect = document.getElementById('quick-appt-department');
  const docSelect = document.getElementById('quick-appt-doctor');
  if (deptSelect && departmentId) deptSelect.value = departmentId;
  if (docSelect && doctorId) docSelect.value = doctorId;

  const intakeCard = document.getElementById('appointment-intake-card');
  if (intakeCard) {
    intakeCard.scrollIntoView({ behavior: 'smooth' });
    intakeCard.style.outline = '3px solid var(--color-primary)';
    setTimeout(() => { intakeCard.style.outline = 'none'; }, 2000);
  }
};

/**
 * 4. Fetch & Render Patient Reviews & Testimonials (/api/v1/reviews)
 */
async function initTestimonials() {
  const container = document.getElementById('testimonials-grid');
  if (!container) return;

  try {
    const res = await API.get('/reviews', { limit: 6 });
    if (res.success && res.data && res.data.length > 0) {
      container.innerHTML = '';
      res.data.forEach(r => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = 'var(--space-5)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
          starsHtml += `<i class="fa-solid fa-star" style="color: ${i <= r.rating ? '#f59e0b' : '#cbd5e1'}; font-size: 0.85rem; margin-right: 2px;"></i>`;
        }

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
            <div>${starsHtml}</div>
            <span class="badge badge-success" style="font-size: 0.6rem;"><i class="fa-solid fa-circle-check"></i> Verified Patient</span>
          </div>

          <p style="font-size: 0.85rem; color: var(--color-slate-700); font-style: italic; line-height: 1.5; margin: 0 0 var(--space-4) 0; flex: 1;">
            "${escapeHtml(r.review_text || r.comment || 'Exceptional clinical care and compassionate attending doctors.')}"
          </p>

          <div style="display: flex; align-items: center; gap: var(--space-3); border-top: 1px solid var(--color-slate-100); padding-top: var(--space-3);">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #e0f2fe; color: #0369a1; display: grid; place-items: center; font-weight: bold; font-size: 0.9rem;">
              ${(r.patient_name || 'Patient').charAt(0)}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.85rem; color: var(--color-navy-900);">${escapeHtml(r.patient_name || 'Verified Patient')}</div>
              <div class="text-xs text-muted">${new Date(r.created_at || Date.now()).toLocaleDateString()}</div>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    } else {
      container.innerHTML = `<p class="text-muted text-center" style="grid-column: 1 / -1;">No public reviews yet. Be the first to share your experience!</p>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center; color: var(--color-slate-400);">Could not load patient testimonials.</div>`;
  }
}

/**
 * 5. Fetch & Render Healthcare Blog & Medical Articles (/api/v1/blog/articles)
 */
async function initHealthArticles() {
  const container = document.getElementById('articles-grid');
  if (!container) return;

  try {
    const res = await API.get('/blog/articles', { limit: 3 });
    if (res.success && res.data && res.data.length > 0) {
      container.innerHTML = '';
      res.data.slice(0, 3).forEach(a => {
        const card = document.createElement('div');
        card.className = 'card card-interactive';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';

        card.innerHTML = `
          <div style="height: 160px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); display: flex; align-items: center; justify-content: center; position: relative; border-top-left-radius: var(--radius-lg); border-top-right-radius: var(--radius-lg);">
            <i class="fa-solid fa-notes-medical" style="font-size: 3rem; color: #2dd4bf; opacity: 0.6;"></i>
            <span class="badge badge-primary" style="position: absolute; top: 12px; left: 12px; font-size: 0.65rem;">${escapeHtml(a.category_name || 'Cardiology')}</span>
            <span style="position: absolute; bottom: 12px; right: 12px; color: rgba(255,255,255,0.7); font-size: 0.7rem;"><i class="fa-regular fa-clock"></i> ${a.read_time_minutes || 5} min read</span>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; flex: 1; padding: var(--space-4);">
            <div class="text-xs text-muted mb-1">${new Date(a.published_at || a.created_at).toLocaleDateString()} &bull; By ${escapeHtml(a.author_name || 'Dr. Marcus Vance')}</div>
            <h4 style="font-size: 1rem; margin: 0 0 var(--space-2) 0; color: var(--color-navy-900); line-height: 1.3;">${escapeHtml(a.title)}</h4>
            <p class="text-muted text-xs" style="margin: 0 0 var(--space-4) 0; line-height: 1.5; flex: 1;">
              ${escapeHtml(a.summary || a.excerpt || 'Evidence-based clinical guidelines and recommendations from our medical faculty.')}
            </p>
            <div style="border-top: 1px solid var(--color-slate-100); padding-top: var(--space-3);">
              <a href="/pages/blog.html" class="btn btn-outline-primary btn-xs btn-block">
                Read Full Article &rarr;
              </a>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    } else {
      container.innerHTML = `<p class="text-muted text-center" style="grid-column: 1 / -1;">No medical articles published yet.</p>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center; color: var(--color-slate-400);">Could not load medical articles.</div>`;
  }
}

/**
 * 6. Quick Interactive Appointment Booking Form (POST /api/v1/appointments)
 */
function initQuickBookingForm() {
  const form = document.getElementById('form-quick-appointment');
  if (!form) return;

  const dateInput = document.getElementById('quick-appt-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    const payload = {
      first_name: document.getElementById('quick-first-name').value.trim(),
      last_name: document.getElementById('quick-last-name').value.trim(),
      phone: document.getElementById('quick-phone').value.trim(),
      email: document.getElementById('quick-email').value.trim() || undefined,
      department_id: parseInt(document.getElementById('quick-appt-department').value, 10),
      doctor_id: document.getElementById('quick-appt-doctor').value ? parseInt(document.getElementById('quick-appt-doctor').value, 10) : undefined,
      appointment_date: document.getElementById('quick-appt-date').value,
      appointment_time: document.getElementById('quick-appt-time').value || '09:00:00',
      reason: document.getElementById('quick-appt-reason').value.trim() || 'General Specialist Consultation',
      type: 'consultation'
    };

    if (!payload.first_name || !payload.last_name || !payload.phone || !payload.department_id) {
      Toast.warning('Please enter patient name, phone number, and clinical department.');
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Booking...';

      const res = await API.post('/appointments', payload);
      if (res.success) {
        Toast.success(`Appointment Confirmed! Confirmation code: ${res.data.appointment_number || res.data.appointmentNumber || 'APT-2026'}`);
        form.reset();
      } else {
        Toast.error(res.message || 'Unable to confirm appointment.');
      }
    } catch (err) {
      Toast.error(err.message || 'Appointment intake failed.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

/**
 * 7. Live Contact & Inquiry Submission Form (POST /api/v1/contact)
 */
function initContactInquiryForm() {
  const form = document.getElementById('form-home-contact');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;

    const payload = {
      name: document.getElementById('contact-name').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      phone: document.getElementById('contact-phone').value.trim() || undefined,
      inquiry_type: document.getElementById('contact-type').value,
      department_id: document.getElementById('contact-dept-select').value ? parseInt(document.getElementById('contact-dept-select').value, 10) : undefined,
      subject: document.getElementById('contact-subject').value.trim(),
      message: document.getElementById('contact-message').value.trim()
    };

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      Toast.warning('Please fill in name, email, subject, and message.');
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending Inquiry...';

      const res = await API.post('/contact', payload);
      Toast.success(res.message || 'Inquiry submitted successfully! Our concierge team will reach out shortly.');
      form.reset();
    } catch (err) {
      Toast.error(err.message || 'Failed to submit inquiry.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  });
}

/**
 * 8. Patient Review Submission Modal
 */
function initReviewSubmission() {
  const form = document.getElementById('form-submit-review');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = parseInt(document.getElementById('rev-rating').value, 10);
    const patientName = document.getElementById('rev-patient-name').value.trim();
    const patientEmail = document.getElementById('rev-patient-email').value.trim();
    const reviewText = document.getElementById('rev-text').value.trim();
    const apptNumber = document.getElementById('rev-appt-ref').value.trim() || undefined;

    try {
      const res = await API.post('/reviews', {
        rating,
        patient_name: patientName,
        patient_email: patientEmail,
        review_text: reviewText,
        appointment_number: apptNumber
      });
      Toast.success(res.message || 'Thank you for your review! It has been submitted for moderation.');
      form.reset();
      const modal = document.getElementById('modal-review');
      if (modal) modal.style.display = 'none';
      initTestimonials();
    } catch (err) {
      Toast.error(err.message || 'Failed to submit review.');
    }
  });
}


function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
