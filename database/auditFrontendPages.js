const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const serverFile = path.join(__dirname, '../server/server.js');

console.log('====================================================');
console.log('🔍 COMPREHENSIVE FRONTEND MPA PAGE & ASSET AUDIT');
console.log('====================================================\n');

// 1. Discover all HTML pages
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
console.log(`Found ${allPages.length} HTML pages across public directories.\n`);

let passedPages = 0;
let failedPages = 0;
const pageIssues = [];

// 2. Audit each page
for (const pagePath of allPages) {
  const relPath = path.relative(publicDir, pagePath).replace(/\\/g, '/');
  const content = fs.readFileSync(pagePath, 'utf8');
  const issues = [];

  // A. Check title
  const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
  if (!titleMatch || !titleMatch[1].trim()) {
    issues.push('Missing or empty <title> tag');
  }

  // B. Check viewport
  if (!content.includes('viewport')) {
    issues.push('Missing <meta name="viewport"> tag for responsiveness');
  }

  // C. Check linked stylesheets
  const cssMatches = [...content.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)];
  for (const match of cssMatches) {
    const href = match[1];
    if (href.startsWith('http://') || href.startsWith('https://')) continue;
    
    // Resolve relative or absolute path
    let localCssPath;
    if (href.startsWith('/')) {
      localCssPath = path.join(publicDir, href.slice(1));
    } else {
      localCssPath = path.join(path.dirname(pagePath), href);
    }
    
    if (!fs.existsSync(localCssPath)) {
      issues.push(`Broken stylesheet link: ${href} (not found at ${localCssPath})`);
    }
  }

  // D. Check script tags
  const scriptMatches = [...content.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
  for (const match of scriptMatches) {
    const src = match[1];
    if (src.startsWith('http://') || src.startsWith('https://')) continue;
    
    let localJsPath;
    if (src.startsWith('/')) {
      localJsPath = path.join(publicDir, src.slice(1));
    } else {
      localJsPath = path.join(path.dirname(pagePath), src);
    }
    
    if (!fs.existsSync(localJsPath)) {
      issues.push(`Broken script link: ${src} (not found at ${localJsPath})`);
    }
  }

  // E. Check critical core scripts on dynamic dashboard pages
  const isRedirectStub = content.includes('http-equiv="refresh"') || content.includes('window.location.href');
  const isDashboardPage = relPath.includes('/') && !relPath.startsWith('pages/') && !isRedirectStub;
  if (isDashboardPage) {
    if (!content.includes('api.js')) issues.push('Missing api.js script reference');
    if (!content.includes('auth.js')) issues.push('Missing auth.js script reference');
    if (!content.includes('responsive.js')) issues.push('Missing responsive.js script reference');
  }

  if (issues.length === 0) {
    passedPages++;
    console.log(`  ✅ [PASS] ${relPath} (${titleMatch ? titleMatch[1].trim() : 'OK'})`);
  } else {
    failedPages++;
    console.log(`  ❌ [FAIL] ${relPath}:`);
    issues.forEach(iss => console.log(`       - ${iss}`));
    pageIssues.push({ page: relPath, issues });
  }
}

console.log('\n====================================================');
console.log(`FRONTEND AUDIT SUMMARY: ${passedPages} PASSED, ${failedPages} FAILED OUT OF ${allPages.length} PAGES`);
console.log('====================================================\n');

if (failedPages > 0) {
  process.exitCode = 1;
}
