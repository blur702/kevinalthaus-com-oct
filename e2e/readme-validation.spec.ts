import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('README.md Validation', () => {
  test('should have clear placeholder in clone instructions', () => {
    const readme = fs.readFileSync('README.md', 'utf8');

    // Check that the clone instruction uses placeholder syntax
    expect(readme).toContain('git clone <your-repo-url>');

    // Verify there are example HTTPS and SSH formats
    expect(readme).toContain('Example HTTPS: git clone https://github.com/<your-username>/<your-repo>.git');
    expect(readme).toContain('Example SSH: git clone git@github.com:<your-username>/<your-repo>.git');

    // Verify the comment explains what to replace
    expect(readme).toContain('Replace <your-repo-url> with your repository URL');

    // Ensure no hardcoded specific repo URLs in the main clone instruction
    const cloneLineMatch = readme.match(/^git clone (?!<your-repo-url>)(https:\/\/github\.com\/[^\s]+|git@github\.com:[^\s]+)/m);
    expect(cloneLineMatch).toBeNull();
  });

  test('should have consistent placeholder format in cd command', () => {
    const readme = fs.readFileSync('README.md', 'utf8');

    // The cd command should also use a placeholder
    expect(readme).toContain('cd <your-repo>');
  });
});
