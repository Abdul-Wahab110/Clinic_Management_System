const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');

function getHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allPages = getHtmlFiles(publicDir);
let updatedCount = 0;

for (const filePath of allPages) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const relPath = path.relative(publicDir, filePath).replace(/\\/g, '/');

  // 1. Ensure viewport meta exists
  if (!content.includes('viewport')) {
    content = content.replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    modified = true;
  }

  // 2. Ensure responsive.js is included if api.js or auth.js is included
  if (content.includes('api.js') && !content.includes('responsive.js')) {
    if (content.includes('<script src="/js/auth.js"></script>')) {
      content = content.replace('<script src="/js/auth.js"></script>', '<script src="/js/auth.js"></script>\n  <script src="/js/responsive.js"></script>');
      modified = true;
    } else if (content.includes('<script src="/js/api.js"></script>')) {
      content = content.replace('<script src="/js/api.js"></script>', '<script src="/js/api.js"></script>\n  <script src="/js/responsive.js"></script>');
      modified = true;
    }
  }

  // 3. Ensure title exists
  if (!content.includes('<title')) {
    content = content.replace('<head>', '<head>\n  <title>AuraCare Medical Center</title>');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedCount++;
    console.log(`Updated scripts & meta in ${relPath}`);
  }
}

console.log(`\nUpdated ${updatedCount} HTML pages with responsive scripts and meta tags.`);
