/**
 * Manual Settings Verification Script
 * Captures settings data from backend and generates a report
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, '..', 'e2e', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Function to make HTTP request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            json: () => JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            json: () => null
          });
        }
      });
    }).on('error', reject);
  });
}

async function fetchSettings() {
  console.log('Fetching settings from backend...\n');

  const baseUrl = 'http://localhost:3000/api/settings';
  const endpoints = [
    { name: 'Site Settings', path: '/site' },
    { name: 'Security Settings', path: '/security' },
    { name: 'Email Settings', path: '/email' },
    { name: 'External APIs', path: '/external-apis' }
  ];

  const results = {};

  for (const endpoint of endpoints) {
    try {
      console.log(`Fetching ${endpoint.name}...`);
      const response = await makeRequest(`${baseUrl}${endpoint.path}`);

      if (response.status === 200) {
        try {
          const data = await response.json();
          if (data === null || data === undefined) {
            results[endpoint.name] = null;
            console.log(`✗ ${endpoint.name} returned null/empty data`);
          } else {
            results[endpoint.name] = data;
            console.log(`✓ ${endpoint.name} fetched successfully`);
            console.log(JSON.stringify(data, null, 2));
          }
        } catch (parseError) {
          results[endpoint.name] = null;
          console.log(`✗ ${endpoint.name} JSON parse error: ${parseError.message}`);
        }
        console.log('');
      } else if (response.status === 401) {
        console.log(`✗ ${endpoint.name} requires authentication (401)`);
        console.log('  Note: This is expected for settings endpoints\n');
        results[endpoint.name] = { error: 'Requires authentication', status: 401 };
      } else {
        console.log(`✗ ${endpoint.name} returned status ${response.status}`);
        results[endpoint.name] = { error: `HTTP ${response.status}`, body: response.body };
      }
    } catch (error) {
      console.log(`✗ Error fetching ${endpoint.name}: ${error.message}\n`);
      results[endpoint.name] = { error: error.message };
    }
  }

  return results;
}

async function generateReport(results) {
  const reportPath = path.join(screenshotsDir, 'backend-settings-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Report saved to: ${reportPath}`);

  // Generate markdown report
  const mdPath = path.join(screenshotsDir, 'backend-settings-report.md');
  let markdown = '# Backend Settings Verification Report\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;

  for (const [name, data] of Object.entries(results)) {
    markdown += `## ${name}\n\n`;

    if (data.error) {
      markdown += `**Status:** Error - ${data.error}\n\n`;
      if (data.status === 401) {
        markdown += `*Note: Authentication is required for settings endpoints. This is expected behavior.*\n\n`;
      }
    } else {
      markdown += '```json\n';
      markdown += JSON.stringify(data, null, 2);
      markdown += '\n```\n\n';
    }
  }

  markdown += '## Summary\n\n';
  markdown += `- Total endpoints checked: ${Object.keys(results).length}\n`;
  markdown += `- Successful: ${Object.values(results).filter(r => !r.error).length}\n`;
  markdown += `- Errors: ${Object.values(results).filter(r => r.error).length}\n`;

  fs.writeFileSync(mdPath, markdown);
  console.log(`✓ Markdown report saved to: ${mdPath}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Settings Verification Script');
  console.log('='.repeat(60));
  console.log('');

  const results = await fetchSettings();
  await generateReport(results);

  console.log('');
  console.log('='.repeat(60));
  console.log('Verification complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
