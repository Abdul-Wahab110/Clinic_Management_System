const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function testAutofill() {
  console.log('====================================================');
  console.log('🧪 TESTING DEMO CREDENTIALS AUTOFILL FUNCTIONALITY');
  console.log('====================================================\n');

  const authJs = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');

  // Create lightweight DOM mock
  function createMockElement(id, type = 'text', name = '') {
    return {
      id,
      type,
      name,
      value: '',
      style: {},
      classList: {
        classes: new Set(),
        add(cls) { this.classes.add(cls); },
        remove(cls) { this.classes.delete(cls); },
        contains(cls) { return this.classes.has(cls); }
      },
      dispatchEvent(event) {},
      closest(sel) { return null; }
    };
  }

  const elements = {
    'modal-login-email': createMockElement('modal-login-email', 'email', 'email'),
    'modal-login-password': createMockElement('modal-login-password', 'password', 'password'),
    'login-email': createMockElement('login-email', 'email', 'email'),
    'login-password': createMockElement('login-password', 'password', 'password'),
  };

  const listeners = [];

  const mockWindow = {
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel.includes('email')) return elements['login-email'];
        if (sel.includes('password')) return elements['login-password'];
        return null;
      },
      querySelectorAll(sel) {
        return [];
      },
      addEventListener(type, cb) {
        listeners.push({ type, cb });
      }
    },
    Event: class Event { constructor(type, opts) { this.type = type; } },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '' },
    Toast: { success: (msg) => console.log(`   [Toast Feedback]: ${msg}`) },
    setTimeout: (fn) => fn(),
    console: console
  };
  mockWindow.window = mockWindow;

  const context = vm.createContext(mockWindow);
  vm.runInContext(authJs, context);

  // Test 1: fillModalCredentials
  console.log('--- 1. Testing fillModalCredentials (Modal Form) ---');
  mockWindow.fillModalCredentials('superadmin@auracare.com');
  if (elements['modal-login-email'].value !== 'superadmin@auracare.com') {
    throw new Error(`Email fill failed: got ${elements['modal-login-email'].value}`);
  }
  if (elements['modal-login-password'].value !== 'Clinic2026!') {
    throw new Error(`Password fill failed: got ${elements['modal-login-password'].value}`);
  }
  console.log('  ✅ PASS: fillModalCredentials correctly filled email and Clinic2026!\n');

  // Test 2: fillCredentials (Standalone Page)
  console.log('--- 2. Testing fillCredentials (Standalone Form) ---');
  delete elements['modal-login-email'];
  delete elements['modal-login-password'];

  mockWindow.fillCredentials('marcus.vance@auracare.com');
  if (elements['login-email'].value !== 'marcus.vance@auracare.com') {
    throw new Error(`Standalone Email fill failed: got ${elements['login-email'].value}`);
  }
  if (elements['login-password'].value !== 'Clinic2026!') {
    throw new Error(`Standalone Password fill failed: got ${elements['login-password'].value}`);
  }
  console.log('  ✅ PASS: fillCredentials correctly filled email and Clinic2026!\n');

  // Test 3: Event delegation for role buttons
  console.log('--- 3. Testing Event Delegation ---');
  const clickListeners = listeners.filter(l => l.type === 'click');
  if (clickListeners.length === 0) throw new Error('Global click listener not registered');

  const mockBtn = createMockElement('btn-doc');
  mockBtn.getAttribute = (attr) => attr === 'data-demo-email' ? 'patient@auracare.com' : null;
  mockBtn.textContent = '👤 Patient';
  mockBtn.closest = (sel) => mockBtn;

  const mockEvent = {
    target: mockBtn,
    preventDefault: () => {},
    stopPropagation: () => {}
  };

  clickListeners.forEach(l => l.cb(mockEvent));

  if (elements['login-email'].value !== 'patient@auracare.com') {
    throw new Error(`Delegation failed: got ${elements['login-email'].value}`);
  }
  if (elements['login-password'].value !== 'Clinic2026!') {
    throw new Error(`Delegation password failed: got ${elements['login-password'].value}`);
  }
  console.log('  ✅ PASS: Click delegation auto-filled email and password successfully!\n');

  console.log('====================================================');
  console.log('🏁 AUTOFILL LOGIC VERIFIED WITH 100% SUCCESS');
  console.log('====================================================\n');
}

testAutofill().catch(err => {
  console.error(err);
  process.exit(1);
});
