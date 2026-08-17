const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
let updatedCount = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      // Ensure responsive.js is present before closing body
      if (!content.includes('responsive.js')) {
        if (content.includes('</body>')) {
          content = content.replace('</body>', '  <script src="/js/responsive.js"></script>\n</body>');
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        updatedCount++;
        console.log(`[UPDATED] Added responsive.js to: ${path.relative(publicDir, fullPath)}`);
      }
    }
  }
}

scanDir(publicDir);
console.log(`Total HTML files updated with responsive.js: ${updatedCount}`);
