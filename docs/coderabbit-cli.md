# CodeRabbit CLI Integration

## Overview

CodeRabbit CLI enables AI-powered code reviews directly in your local development environment. It complements the existing web-based CodeRabbit integration (tracked in `CODERABBIT_FIXES.md`) by providing real-time feedback during development, before committing changes to GitHub.

**Key Benefits:**
- **Local-first workflow:** Review code before pushing to remote
- **Claude Code integration:** AI-friendly output format that Claude can parse and fix automatically
- **Faster iteration:** Catch issues in your WSL environment without waiting for GitHub PR reviews
- **Uncommitted changes:** Review work-in-progress code that hasn't been committed yet

**How it works:**
The CLI submits your code to CodeRabbit's AI service, which analyzes it for issues (security, performance, best practices, bugs) and returns structured feedback. In prompt-only mode (`--prompt-only`), output is optimized for consumption by AI assistants like Claude Code, enabling automated fix workflows.

## Prerequisites

### WSL Environment Verification

Before installing CodeRabbit CLI, verify your WSL environment has the required dependencies:

```bash
# Check WSL version
wsl --version

# Verify curl is installed
curl --version

# Verify unzip is installed
unzip -v

# Verify Git is installed
git --version
```

If any dependencies are missing, install them:

```bash
sudo apt update && sudo apt install -y curl unzip git
```

### Git Configuration for Line Endings

To avoid CRLF/LF line-ending issues in Windows+WSL workflows, configure Git properly:

**In WSL (Linux side):**
```bash
# Keep LF line endings in commits
git config --global core.autocrlf input
```

**In Windows (if using Windows Git):**
```bash
# Convert CRLF to LF on commit, LF to CRLF on checkout
git config --global core.autocrlf true
```

**Why this matters:**
- Windows uses CRLF (`\r\n`) for line endings
- Linux/WSL uses LF (`\n`) for line endings
- The repository has a `.gitattributes` file at the root defining line-ending rules
- Incorrect Git configuration can cause unnecessary diffs and merge conflicts

**Verify your settings:**
```bash
git config --global --get core.autocrlf
```

## CLI Installation

Install the CodeRabbit CLI in your WSL environment:

```bash
# Run the official installer
curl -fsSL https://cli.coderabbit.ai/install.sh | sh

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc if using zsh

# Verify installation
coderabbit --version
```

**Troubleshooting: Command not found**

If `coderabbit` command is not found after installation, manually add it to your PATH:

```bash
# For bash
echo 'export PATH="$HOME/.coderabbit/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc

# For zsh
echo 'export PATH="$HOME/.coderabbit/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

## Authentication

CodeRabbit CLI requires authentication with the CodeRabbit service. **Important:** You need to authenticate separately for standalone WSL usage and for Claude Code integration.

### Standalone WSL Usage

For running CodeRabbit CLI directly in your WSL terminal:

```bash
# Start authentication flow
coderabbit auth login
```

The CLI will display an authentication URL. Follow these steps:
1. Copy the URL provided by the CLI
2. Open it in your Windows browser
3. Complete the login process (GitHub or email)
4. Copy the authentication token from the browser
5. Paste the token back into the WSL terminal
6. Press Enter to complete authentication

**Verify authentication:**
```bash
coderabbit auth status
```

**Note on Windows Terminal:** If using Windows Terminal, URLs are often clickable with Ctrl+Click, making the process smoother.

### Claude Code Integration

Claude Code runs in a separate terminal session, so you must authenticate within Claude's environment:

1. When working with Claude Code, instruct it to run: `coderabbit auth login`
2. Claude will execute the command and display the authentication URL
3. Copy the URL and open it in your browser
4. Complete the login and copy the token
5. Paste the token back into Claude Code's terminal session
6. Claude will complete the authentication

**Important:** This is a separate authentication from your standalone WSL usage. Claude Code maintains its own credential store.

## Testing Integration

Navigate to your repository and test the CLI:

```bash
# Navigate to the repository (adjust path as needed)
cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct

# Run basic review (reviews all changes since base branch)
coderabbit

# Test prompt-only mode (AI-friendly output)
coderabbit --prompt-only

# Review only uncommitted changes
coderabbit --prompt-only --type uncommitted

# Review against specific base branch
coderabbit --prompt-only --base main
```

**Expected behavior:**
- The CLI submits your code to CodeRabbit's service
- Reviews typically take 7-30+ minutes depending on code size
- Progress is displayed in the terminal
- When complete, structured feedback is displayed

**Running in background:**
For long reviews, you can run the CLI in the background:

```bash
# Run in background and redirect output to a file
coderabbit --prompt-only --type uncommitted > review-output.txt 2>&1 &

# Check background job status
jobs

# Tail the output file to monitor progress
tail -f review-output.txt
```

## Claude Code Workflow

### Basic Workflow

Integrate CodeRabbit into your Claude Code development workflow with prompts like:

```
"Please implement <task>, then run coderabbit --prompt-only --type uncommitted
in the background, let it take as long as it needs, and fix the issues it finds."
```

Claude will:
1. Implement the requested task
2. Execute CodeRabbit CLI with `--prompt-only` flag
3. Wait for the review to complete (7-30+ minutes)
4. Parse the AI-friendly output
5. Apply fixes automatically
6. Present the corrected code for your review

### Common CLI Flags

- `--prompt-only` - Output in token-efficient, AI-friendly format (essential for Claude integration)
- `--type uncommitted` - Review only uncommitted changes (faster, focused on current work)
- `--type staged` - Review only staged changes
- `--type committed` - Review only committed but not pushed changes
- `--base <branch>` - Review changes against specific branch (default: main/master)
- `--help` - Display all available options

### Interpreting Output

When using `--prompt-only`, CodeRabbit produces structured output that includes:

- **File path and line number** - Exact location of each issue
- **Severity level** - Critical, high, medium, low
- **Category** - Security, performance, bug, style, etc.
- **Description** - Detailed explanation of the issue
- **Suggested fix** - Recommended code changes

Claude Code can parse this structure and apply fixes automatically. For manual reviews, focus on critical and high-severity issues first.

### Tracking Fixes

This repository tracks CodeRabbit fixes in `CODERABBIT_FIXES.md`. When Claude applies fixes:
1. Document significant changes in `CODERABBIT_FIXES.md`
2. Group fixes by category (security, performance, bugs, etc.)
3. Include file references and line numbers
4. Note any trade-offs or decisions made

## Troubleshooting

### Command Not Found After Installation

**Problem:** `coderabbit: command not found`

**Solution:**
```bash
# Verify installation directory exists
ls -la ~/.coderabbit/bin

# Manually add to PATH
echo 'export PATH="$HOME/.coderabbit/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Authentication URL Not Clickable

**Problem:** Can't click the authentication URL in terminal

**Solution:**
- Copy the URL manually and paste into Windows browser
- Use Windows Terminal for clickable links (Ctrl+Click)
- The URL format is: `https://coderabbit.ai/cli/auth?token=...`

### Performance Issues

**Problem:** CodeRabbit is slow or hangs

**Solutions:**
- **Use Linux filesystem:** Work in `~/projects/` instead of `/mnt/c/` for better performance
- **Review smaller changesets:** Use `--type uncommitted` to review only current work
- **Check network:** Ensure stable internet connection (CLI uploads code to service)
- **Background execution:** Run long reviews in background with output redirection

### Line Ending Issues

**Problem:** Unexpected diffs or "changed every line" in reviews

**Solution:**
```bash
# Check your Git autocrlf setting
git config --global --get core.autocrlf

# Should be "input" in WSL
git config --global core.autocrlf input

# Re-normalize line endings in repository
git add --renormalize .
git status  # Should show no changes if already normalized
```

### Claude Code Authentication Timeout

**Problem:** Claude Code times out while waiting for token input

**Solution:**
- Guide Claude to run `coderabbit auth login` in foreground (not background)
- Have the token ready before starting authentication
- If timeout occurs, re-run `coderabbit auth login` and paste token immediately

### Review Takes Too Long

**Problem:** Reviews taking longer than 30 minutes

**Solutions:**
- Review smaller changesets: `--type uncommitted` or `--type staged`
- Exclude large generated files (check `.gitignore`)
- Split large changes into multiple commits and review incrementally
- Check CodeRabbit service status: https://status.coderabbit.ai

## Best Practices

### Pre-Commit Workflow

Integrate CodeRabbit into your development workflow:

```bash
# 1. Make changes to code
git status

# 2. Review uncommitted changes
coderabbit --prompt-only --type uncommitted > review.txt 2>&1 &

# 3. While review runs, continue working or review output when ready
tail -f review.txt

# 4. Apply fixes (manually or via Claude Code)

# 5. Stage changes
git add .

# 6. Review staged changes before committing
coderabbit --prompt-only --type staged

# 7. Commit if review passes
git commit -m "feat: implement feature X"
```

### Security Considerations

- **Authentication tokens** are stored in `~/.coderabbit/` - keep this directory secure
- **Code submission** - Your code is sent to CodeRabbit's service for analysis
- **Private repositories** - Ensure your CodeRabbit account has appropriate access
- **Sensitive data** - Avoid committing secrets; use `.env` files (already gitignored)

### Integration with Existing Tools

Coordinate CodeRabbit CLI with existing repository tools:

- **CODERABBIT_FIXES.md** - Document fixes consistently with existing format
- **ESLint** - Run `npm run lint` after applying CodeRabbit fixes
- **TypeScript** - Run `npm run build` to verify type safety
- **Pre-commit hooks** - Consider adding `coderabbit --type staged` to pre-commit checks

**Example pre-commit hook** (`.git/hooks/pre-commit`):
```bash
#!/bin/bash
# Run CodeRabbit on staged changes
echo "Running CodeRabbit review on staged changes..."
coderabbit --prompt-only --type staged

# Capture exit code
if [ $? -ne 0 ]; then
  echo "CodeRabbit found issues. Review output and fix before committing."
  exit 1
fi

echo "CodeRabbit review passed."
```

### Optimal Use of --prompt-only

The `--prompt-only` flag is essential for Claude Code integration:

- **Token efficiency** - Produces concise output without verbose explanations
- **Structured format** - Machine-parseable JSON-like structure
- **Actionable** - Focuses on specific fixes rather than general suggestions
- **Context-aware** - Includes file paths and line numbers for precise fixes

**When to use:**
- ✅ Claude Code automated fix workflows
- ✅ Piping output to scripts or other tools
- ✅ Generating fix reports programmatically

**When NOT to use:**
- ❌ Manual review in terminal (regular mode is more human-readable)
- ❌ Learning about code quality (regular mode provides more context)

### Performance Optimization

**Use WSL Linux filesystem for better performance:**
```bash
# Slow: Windows filesystem via /mnt
cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct

# Fast: WSL Linux filesystem
cd ~/projects/kevinalthaus-com-oct
git clone <repo-url> ~/projects/kevinalthaus-com-oct
```

**Review strategies:**
- **Incremental reviews** - Review small changesets frequently
- **Focused reviews** - Use `--type uncommitted` for work-in-progress
- **Background execution** - Run long reviews in background while continuing work

## References

### Official Documentation

- **CodeRabbit CLI Overview:** https://docs.coderabbit.ai/cli/overview
- **WSL Installation Guide:** https://docs.coderabbit.ai/cli/wsl-windows
- **Claude Code Integration:** https://docs.coderabbit.ai/cli/claude-code-integration
- **Authentication Guide:** https://docs.coderabbit.ai/cli/authentication

### Repository-Specific Resources

- **CodeRabbit Fix Tracking:** `CODERABBIT_FIXES.md` - Existing fixes from web-based reviews
- **Development Scripts:** `docs/scripts.md` - Other repository automation tools
- **Getting Started:** `docs/getting-started.md` - Repository setup and prerequisites
- **Architecture:** `docs/architecture.md` - Understanding the codebase for better reviews

### Support

- **GitHub Issues:** https://github.com/coderabbit-ai/cli/issues
- **Community Slack:** https://coderabbit-community.slack.com
- **Repository Issues:** For repository-specific integration issues, file an issue in this repository

---

**Next Steps:**
1. Complete prerequisites verification (WSL, curl, unzip, git)
2. Configure Git line-ending settings
3. Install CodeRabbit CLI
4. Authenticate (both standalone and Claude Code)
5. Run test review: `coderabbit --prompt-only --type uncommitted`
6. Integrate into your development workflow

For Claude Code users, simply instruct Claude to run CodeRabbit with appropriate flags, and it will handle authentication, execution, and fix application automatically.
