# Port Management

This directory contains scripts for managing application ports and ensuring consistent port assignment across development sessions.

## Problem

During development, Node.js processes can crash or be terminated improperly, leaving ports occupied. This causes issues when restarting the application:

- Vite/dev servers try random ports (3003 → 3008)
- Tests fail because expected ports are unavailable
- Port conflicts cause startup failures

## Solution

The `cleanup-ports.js` script automatically finds and kills all processes using the application's ports, ensuring clean startup every time.

## Application Ports

| Service         | Port | Description                    |
|-----------------|------|--------------------------------|
| API Gateway     | 3000 | Main API entry point           |
| Main App        | 3001 | Backend application            |
| Frontend        | 3002 | Public-facing frontend         |
| Admin           | 3003 | Admin dashboard                |
| Plugin Engine   | 3004 | Plugin execution service       |
| Python Service  | 8000 | Python backend service         |

## Usage

### Cleanup Ports Before Starting

```bash
# Clean up ports, then start dev servers
npm run dev:clean

# Clean up ports, then start production servers
npm run start:clean
```

### Manual Port Cleanup

```bash
# Kill all processes using app ports
npm run ports:cleanup

# Or run the script directly
node scripts/cleanup-ports.js
```

### Check Port Status

The cleanup script will show:
- Which ports are in use
- Process IDs and names using each port
- Success/failure status for each kill operation

Example output:

```
============================================================
Port Cleanup Utility
============================================================

ℹ Platform: win32
ℹ Cleaning up ports for application services...

Checking API Gateway (port 3000)...
⚠ Found 1 process(es) using port 3000
  Killing PID 9776 (node.exe)...
✓   Successfully killed PID 9776

Checking Main App (port 3001)...
✓ Port 3001 is free

...

============================================================
Summary
============================================================
ℹ Ports checked: 6
ℹ Processes killed: 1
✓ Ports cleaned up successfully!
```

## How It Works

### Cross-Platform Detection

The script automatically detects the operating system:
- **Windows**: Uses `netstat` and `taskkill`
- **Unix/Linux/macOS**: Uses `lsof` and `kill`

### Port Discovery

**Windows**:
```bash
netstat -ano | findstr :3000
```

**Unix**:
```bash
lsof -ti :3000
```

### Process Termination

**Windows**:
```bash
taskkill /F /PID <pid>
```

**Unix**:
```bash
kill -9 <pid>
```

## Scripts

### cleanup-ports.js

Main Node.js script that:
1. Iterates through all application ports
2. Finds processes using each port
3. Kills those processes
4. Provides detailed output and summary

### cleanup-ports.sh

Shell wrapper for Unix systems:
```bash
#!/bin/bash
node "$(dirname "$0")/cleanup-ports.js"
```

## Safety Features

- **System Process Protection**: Skips system processes (PID 0, 4)
- **Graceful Failure**: Continues if a process can't be killed
- **Detailed Reporting**: Shows exactly what was killed and why
- **Zero Configuration**: Works out of the box on Windows, macOS, and Linux

## Integration with Development Workflow

### Recommended Workflow

1. **Start Development Session**:
   ```bash
   npm run dev:clean
   ```

2. **Restart After Crash**:
   ```bash
   npm run ports:cleanup
   npm run dev
   ```

3. **Before Running Tests**:
   ```bash
   npm run ports:cleanup
   npm run test:e2e
   ```

### VSCode Integration

Add to `.vscode/tasks.json`:

```json
{
  "label": "Clean Ports and Start Dev",
  "type": "npm",
  "script": "dev:clean",
  "problemMatcher": [],
  "group": {
    "kind": "build",
    "isDefault": true
  }
}
```

## Troubleshooting

### Ports Still in Use

If ports remain occupied after cleanup:

1. **Check for System Services**: Some ports may be used by system services
2. **Restart Docker**: If using Docker, restart Docker Desktop
3. **Manual Check**:
   - Windows: `netstat -ano | findstr :<port>`
   - Unix: `lsof -ti :<port>`

### Permission Denied

On Unix systems, you may need elevated permissions:
```bash
sudo npm run ports:cleanup
```

On Windows, run terminal as Administrator if standard user can't kill processes.

### Process Respawns Immediately

If a process keeps respawning:
1. Stop the parent process manager (PM2, systemd, etc.)
2. Run port cleanup
3. Start your development server

## Adding New Ports

To add a new service port, edit `scripts/cleanup-ports.js`:

```javascript
const PORTS = {
  'API Gateway': 3000,
  'Main App': 3001,
  'Frontend': 3002,
  'Admin': 3003,
  'Plugin Engine': 3004,
  'Python Service': 8000,
  'New Service': 3005,  // Add here
};
```

## CI/CD Integration

In CI environments, ports are typically clean, but you can still run cleanup as a safety measure:

```yaml
# GitHub Actions example
- name: Clean Ports
  run: npm run ports:cleanup

- name: Start Application
  run: npm run dev
```

## Performance

- **Windows**: ~100-200ms per port check
- **Unix**: ~50-100ms per port check
- **Total**: Typically completes in under 2 seconds

## License

Part of the kevinalthaus.com monorepo. See LICENSE file for details.
