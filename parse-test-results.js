const fs = require('fs');
const path = require('path');

// Read the HTML report
const htmlPath = path.join(__dirname, 'playwright-report', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extract test statistics from the HTML
const totalMatch = html.match(/(\d+)\s+tests?/);
const passedMatch = html.match(/(\d+)\s+passed/);
const failedMatch = html.match(/(\d+)\s+failed/);
const skippedMatch = html.match(/(\d+)\s+skipped/);

console.log('=== PLAYWRIGHT E2E TEST RESULTS ===\n');
console.log(`Total Tests: ${totalMatch ? totalMatch[1] : 'Unknown'}`);
console.log(`Passed: ${passedMatch ? passedMatch[1] : '0'}`);
console.log(`Failed: ${failedMatch ? failedMatch[1] : '0'}`);
console.log(`Skipped: ${skippedMatch ? skippedMatch[1] : '0'}`);

// Try to extract test file information
const fileMatches = html.matchAll(/data-test-id="[^"]*"\s+class="[^"]*test[^"]*"[^>]*>([^<]+)</g);
const tests = [];

for (const match of fileMatches) {
  tests.push(match[1]);
}

console.log(`\nTest files found in report: ${tests.length}`);
