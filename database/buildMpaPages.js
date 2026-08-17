/**
 * AuraCare Multi-Page Application (MPA) Master Build Script
 * Generates and bundles all public pages, admin pages, doctor portals, patient portals, and staff workstations.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('====================================================');
console.log('🏥 AURACARE MULTI-PAGE APPLICATION MASTER BUILD');
console.log('====================================================\n');

try {
  console.log('1. Building Public Pages & Standardizing Headers...');
  execSync('node database/updatePublicHeaders.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('\n2. Generating Admin Console (24 Modules)...');
  execSync('node database/generateAdminPages.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('\n3. Generating Doctor Portal (11 Workspaces)...');
  execSync('node database/generateDoctorPages.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('\n4. Generating Patient Portal (7 Health Suites)...');
  execSync('node database/generatePatientPages.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('\n5. Generating Staff Workstations (Reception, Nurse, Lab, Pharmacy, Billing)...');
  execSync('node database/generateStaffPages.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('\n====================================================');
  console.log('✅ BUILD COMPLETED SUCCESSFULLY (All 55+ Pages Built)');
  console.log('====================================================\n');
} catch (err) {
  console.error('\n❌ Build Error:', err.message);
  process.exit(1);
}
