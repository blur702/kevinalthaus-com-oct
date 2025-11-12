const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);

async function removeConsoleLogs(dir) {
  let removedCount = 0;
  let filesProcessed = 0;

  const processFile = async (filePath) => {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const newLines = [];

    for (const line of lines) {
      // Skip lines that are only console.log statements
      if (line.trim().startsWith('console.log(') ||
          line.trim().startsWith('console.error(') ||
          line.trim().startsWith('console.warn(') ||
          line.trim().startsWith('console.debug(')) {
        removedCount++;
        continue;
      }
      newLines.push(line);
    }

    const newContent = newLines.join('\n');
    if (content !== newContent) {
      await writeFile(filePath, newContent, 'utf8');
      filesProcessed++;
    }
  };

  const files = await readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      continue;
    }

    if (file.endsWith('.spec.ts') || file.endsWith('.test.ts')) {
      await processFile(filePath);
    }
  }

  return { removedCount, filesProcessed };
}

async function main() {
  console.log('Removing console.log statements from test files...');

  const e2eDir = path.join(__dirname, '../e2e');
  const result = await removeConsoleLogs(e2eDir);

  console.log(`\nCompleted!`);
  console.log(`Files processed: ${result.filesProcessed}`);
  console.log(`Console statements removed: ${result.removedCount}`);
}

main().catch(console.error);
