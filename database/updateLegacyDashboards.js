const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../public/pages');

const files = [
  'doctor-dashboard.html',
  'admin-dashboard.html',
  'reception-dashboard.html',
  'nurse-dashboard.html',
  'lab-dashboard.html',
  'pharmacy-dashboard.html',
  'billing-dashboard.html',
  'patient-portal.html'
];

files.forEach(f => {
  const filePath = path.join(pagesDir, f);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace user box
  const oldBoxRegex = /<div style="background:\s*rgba\(255,\s*255,\s*255,\s*0\.06\);[\s\S]*?<\/aside>/i;

  const roleName = f.includes('doctor') ? 'Physician' :
                   f.includes('admin') ? 'Administrator' :
                   f.includes('reception') ? 'Receptionist' :
                   f.includes('nurse') ? 'Nurse' :
                   f.includes('lab') ? 'Lab Tech' :
                   f.includes('pharmacy') ? 'Pharmacist' :
                   f.includes('billing') ? 'Accountant' :
                   f.includes('patient') ? 'Patient' : 'Staff';

  const iconName = f.includes('doctor') ? 'fa-user-doctor' :
                   f.includes('patient') ? 'fa-hospital-user' : 'fa-user-shield';

  const newBox = `<div class="sidebar-user-box">
      <div class="sidebar-user-header">
        <div class="sidebar-user-avatar"><i class="fa-solid ${iconName}"></i></div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" data-user-name>${roleName}</div>
          <div class="sidebar-user-role" data-user-role>${roleName}</div>
        </div>
      </div>
      <button class="btn btn-outline-danger btn-sm btn-block" data-action-logout style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; color: #fca5a5; border-color: rgba(239,68,68,0.35);">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
      </button>
    </div>
  </aside>`;

  if (oldBoxRegex.test(content)) {
    content = content.replace(oldBoxRegex, newBox);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated legacy dashboard sidebar in: ${f}`);
  }
});

console.log('🎉 All legacy dashboards upgraded with modern sidebar user box!');
