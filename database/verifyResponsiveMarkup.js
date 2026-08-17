const http = require('http');

const urls = [
  '/',
  '/pages/about.html',
  '/pages/doctors.html',
  '/pages/departments.html',
  '/pages/services.html',
  '/pages/appointments.html',
  '/pages/emergency.html',
  '/pages/blog.html',
  '/pages/contact.html',
  '/admin/dashboard',
  '/admin/search',
  '/doctor/dashboard',
  '/patient/dashboard'
];

async function checkUrl(u) {
  return new Promise((resolve) => {
    http.get('http://localhost:5000' + u, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const hasViewport = body.includes('viewport');
        const hasMainCss = body.includes('/css/main.css');
        const hasResponsiveJs = body.includes('/js/responsive.js');
        const status = res.statusCode;
        resolve({ url: u, status, hasViewport, hasMainCss, hasResponsiveJs });
      });
    }).on('error', err => resolve({ url: u, error: err.message }));
  });
}

async function main() {
  console.log('=== RESPONSIVE ASSET & MARKUP VERIFICATION ===\n');
  for (const u of urls) {
    const res = await checkUrl(u);
    const ok = res.status >= 200 && res.status < 400 && res.hasViewport && res.hasMainCss && res.hasResponsiveJs;
    console.log(`${ok ? '✅ PASS' : '❌ FAIL'}: ${res.url.padEnd(26)} | Status: ${res.status} | Viewport: ${res.hasViewport} | MainCSS: ${res.hasMainCss} | ResponsiveJS: ${res.hasResponsiveJs}`);
  }
  console.log('\n=== VERIFICATION COMPLETE ===');
}

main();
