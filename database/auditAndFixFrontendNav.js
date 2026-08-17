const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');

function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'uploads') {
        getAllHtmlFiles(fullPath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

const htmlFiles = getAllHtmlFiles(publicDir);
console.log(`Found ${htmlFiles.length} HTML files to inspect.`);

let updatedCount = 0;

htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;

  // 1. Ensure settings.js is included in <script> tags if api.js or auth.js is present
  if (content.includes('/js/api.js') && !content.includes('/js/settings.js')) {
    content = content.replace(
      '<script src="/js/api.js"></script>',
      '<script src="/js/api.js"></script>\n  <script src="/js/settings.js"></script>'
    );
  }

  // 2. Fix dead javascript:void(0) on Patient Portal links in footers
  content = content.replace(/href="javascript:void\(0\)"\s+data-modal-target="modal-login"/g, 'href="/pages/login.html" data-modal-target="modal-login"');
  content = content.replace(/href="javascript:void\(0\)"/g, 'href="/pages/login.html"');

  // 3. Fix demo-reset-link in forgot-password.html if dead
  if (file.endsWith('forgot-password.html')) {
    content = content.replace('href="#" class="btn btn-primary btn-sm btn-block mt-3 hidden"', 'href="/pages/reset-password.html" class="btn btn-primary btn-sm btn-block mt-3 hidden"');
  }

  // 4. Ensure viewport tag exists and is responsive
  if (!content.includes('name="viewport"')) {
    content = content.replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  }

  // 5. Ensure [data-hospital-name] is present on brand name tags
  if (content.includes('class="brand-name"') && !content.includes('data-hospital-name')) {
    content = content.replace(/<span class="brand-name">([^<]+)<\/span>/g, '<span class="brand-name" data-hospital-name>$1</span>');
  }

  // 6. Ensure footer copyright has data-footer-copyright
  if (content.includes('class="footer-copyright"') && !content.includes('data-footer-copyright')) {
    content = content.replace(/class="footer-copyright"/g, 'class="footer-copyright" data-footer-copyright');
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    updatedCount++;
    console.log(`  Updated: ${path.relative(publicDir, file)}`);
  }
});

console.log(`\n✅ Finished! Updated ${updatedCount} HTML files.`);
