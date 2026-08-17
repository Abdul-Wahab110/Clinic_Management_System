const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = __dirname;
const testFiles = fs.readdirSync(testDir)
  .filter(file => file.startsWith('test') && file.endsWith('.js') && file !== 'runAllModuleTests.js');

console.log('====================================================');
console.log(`🏥 RUNNING ALL ${testFiles.length} AUTOMATED MODULE TESTS`);
console.log('====================================================\n');

let passedCount = 0;
let failedCount = 0;
const results = [];

for (const file of testFiles) {
  process.stdout.write(`⏳ Testing ${file}... `);
  try {
    const output = execSync(`node "${path.join(testDir, file)}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000
    });
    passedCount++;
    console.log('✅ PASS');
    results.push({ file, status: 'PASS', output });
  } catch (err) {
    failedCount++;
    console.log('❌ FAIL');
    const errMsg = err.stdout ? err.stdout : err.message;
    console.error(errMsg);
    results.push({ file, status: 'FAIL', error: errMsg });
  }
}

console.log('\n====================================================');
console.log(`SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED OUT OF ${testFiles.length} TEST FILES`);
console.log('====================================================\n');

if (failedCount > 0) {
  process.exitCode = 1;
}
