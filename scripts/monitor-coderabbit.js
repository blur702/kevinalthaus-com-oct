/**
 * CodeRabbit Progress Monitor
 * Periodically checks CodeRabbit review progress and reports status
 */

const { execSync } = require('child_process');
const path = require('path');

const CHECK_INTERVAL_MS = 120000; // 2 minutes
let startTime = Date.now();
let lastCheck = Date.now();
let checkCount = 0;

function getStatus() {
  try {
    // Build portable path from current working directory
    const repoPath = process.cwd().replace(/\\/g, '/').replace(/^([A-Z]):/, (match, drive) => `/mnt/${drive.toLowerCase()}`);
    const command = `wsl bash -c "cd '${repoPath}' && ./scripts/coderabbit-status.sh json"`;

    const result = execSync(command, {
      encoding: 'utf-8',
      timeout: 10000
    });

    return JSON.parse(result);
  } catch (error) {
    console.error('Failed to get status:', error.message);
    return null;
  }
}

function formatElapsedTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function reportProgress(status) {
  checkCount++;
  const elapsed = Date.now() - startTime;

  console.log('');
  console.log('='.repeat(70));
  console.log(`CodeRabbit Progress Check #${checkCount}`);
  console.log(`Time Elapsed: ${formatElapsedTime(elapsed)}`);
  console.log('='.repeat(70));

  if (!status) {
    console.log('Status: Unable to retrieve status');
    return false;
  }

  console.log(`Status: ${status.status}`);
  console.log(`Phase: ${status.phase}`);
  console.log(`PID: ${status.pid}`);

  if (status.testsRun !== null) {
    console.log(`Tests Run: ${status.testsRun ? 'Yes' : 'No'}`);
    if (status.testsPassed !== null) {
      console.log(`Tests Passed: ${status.testsPassed ? 'Yes' : 'No'}`);
    }
  }

  if (status.reviewComplete) {
    console.log('');
    console.log('✓ Review Complete!');

    if (status.issuesFound !== null) {
      console.log(`Issues Found: ${status.issuesFound}`);
    }

    if (status.exitCode !== null) {
      console.log(`Exit Code: ${status.exitCode}`);
    }

    return true; // Review is complete
  } else {
    console.log('');
    console.log('Review in progress...');
    console.log(`Next check in ${CHECK_INTERVAL_MS / 60000} minutes`);
  }

  console.log('='.repeat(70));
  console.log('');

  return false; // Review not complete
}

function checkHeartbeat() {
  try {
    const heartbeatPath = path.join(__dirname, '..', '.coderabbit-status', 'heartbeat.txt');
    const fs = require('fs');

    if (fs.existsSync(heartbeatPath)) {
      const heartbeat = fs.readFileSync(heartbeatPath, 'utf-8').trim();
      const heartbeatTime = new Date(heartbeat).getTime();
      const now = Date.now();
      const staleness = now - heartbeatTime;

      if (staleness > 180000) { // 3 minutes
        console.warn('⚠ Warning: Heartbeat is stale (last update: ' + formatElapsedTime(staleness) + ' ago)');
        console.warn('   Process may have stalled. Consider checking logs.');
        return false;
      }
    }
  } catch (error) {
    // Heartbeat check failed, but don't fail the whole monitor
  }

  return true;
}

async function monitor() {
  console.log('CodeRabbit Progress Monitor Started');
  console.log('Will check status every 2 minutes');
  console.log('');

  // Initial check
  const initialStatus = getStatus();
  if (reportProgress(initialStatus)) {
    console.log('Review already complete!');
    process.exit(0);
  }

  // Set up periodic checks
  const interval = setInterval(() => {
    const status = getStatus();
    const isComplete = reportProgress(status);

    // Check heartbeat
    checkHeartbeat();

    if (isComplete) {
      console.log('Monitoring complete. Exiting...');
      clearInterval(interval);
      process.exit(0);
    }
  }, CHECK_INTERVAL_MS);

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nMonitoring stopped by user');
    clearInterval(interval);
    process.exit(0);
  });
}

monitor().catch(console.error);
