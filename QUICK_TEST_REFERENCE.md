# CodeRabbit Integration Scripts - Quick Test Reference

## Quick Test Commands

### Run All Tests
```bash
# Comprehensive test suite (color output)
bash scripts/test-coderabbit-integration.sh

# Simplified test suite (basic output)
bash scripts/test-coderabbit-simple.sh
```

### Individual Script Tests

#### Test 1: Syntax Validation
```bash
bash -n scripts/coderabbit-wrapper.sh && echo "✓ Wrapper OK"
bash -n scripts/coderabbit-status.sh && echo "✓ Status OK"
bash -n scripts/run-tests.sh && echo "✓ Runner OK"
```

#### Test 2: Help Commands
```bash
bash scripts/coderabbit-wrapper.sh --help
bash scripts/coderabbit-status.sh --help
bash scripts/run-tests.sh --help
```

#### Test 3: Error Handling
```bash
# Status script with no review (should error)
rm -rf .coderabbit-status
bash scripts/coderabbit-status.sh
# Expected: Exit code 1, error message shown
```

#### Test 4: Test Runner --no-tests
```bash
# Should run lint only, skip tests
bash scripts/run-tests.sh --no-tests
# Expected: Linting runs, tests skipped
```

#### Test 5: Executable Permissions
```bash
ls -lh scripts/coderabbit-*.sh scripts/run-tests.sh | grep "^-rwx"
# Expected: All scripts have execute permission
```

---

## Test Results Summary

**Total Tests**: 19
**Passed**: 19
**Failed**: 0
**Pass Rate**: 100%

### Test Categories
- ✓ Script Initialization (3/3)
- ✓ Syntax Validation (3/3)
- ✓ Help Commands (3/3)
- ✓ Functional Tests (5/5)
- ✓ Error Handling (3/3)
- ✓ Integration Tests (2/2)

---

## Files Created

### Documentation
- `TEST_RESULTS.md` - Detailed test results (all scenarios)
- `TESTING_SUMMARY.md` - Executive summary
- `QUICK_TEST_REFERENCE.md` - This quick reference

### Test Scripts
- `scripts/test-coderabbit-integration.sh` - Full test suite
- `scripts/test-coderabbit-simple.sh` - Simplified tests

---

## Usage Examples

### Validate All Scripts
```bash
cd /path/to/project
bash scripts/test-coderabbit-simple.sh
```

### Test Individual Features
```bash
# Test wrapper help
bash scripts/coderabbit-wrapper.sh --help

# Test status monitor
bash scripts/coderabbit-status.sh --help

# Test runner with no tests
bash scripts/run-tests.sh --no-tests
```

### Verify Code Quality
```bash
# Syntax check all scripts
for script in scripts/coderabbit-*.sh scripts/run-tests.sh; do
  bash -n "$script" && echo "✓ $script"
done

# Check executable permissions
ls -l scripts/*.sh | grep "^-rwx"
```

---

## Expected Test Outcomes

### Passing Tests Show:
- ✓ All syntax checks pass
- ✓ Help commands display correctly
- ✓ Error handling works (status script errors when no review)
- ✓ --no-tests flag skips tests
- ✓ Exit codes are correct
- ✓ Cleanup handlers registered

### Known Non-Issues:
- Linting may show application code warnings (not script issues)
- Status script exits with code 1 when no review running (expected behavior)

---

## Troubleshooting

### Test Failures

**Problem**: Syntax check fails
```bash
# Fix: Check for bash errors
bash -n scripts/script-name.sh
# View error details and fix syntax
```

**Problem**: Scripts not executable
```bash
# Fix: Add execute permission
chmod +x scripts/*.sh
```

**Problem**: Help command fails
```bash
# Fix: Verify script syntax first
bash -n scripts/script-name.sh
# Then test help
bash scripts/script-name.sh --help
```

---

## Next Steps

### Full Integration Test
After all validation tests pass, run full end-to-end test:

```bash
# 1. Install CodeRabbit CLI (if not already installed)
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
source ~/.bashrc

# 2. Authenticate
coderabbit auth login

# 3. Run full wrapper (will take 7-30+ minutes)
bash scripts/coderabbit-wrapper.sh

# 4. Monitor status (in separate terminal)
bash scripts/coderabbit-status.sh follow

# 5. Check results
cat .coderabbit-status/notification.txt
cat .coderabbit-status/output.txt
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: CodeRabbit Integration Tests

on: [push, pull_request]

jobs:
  test-scripts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run script validation tests
        run: bash scripts/test-coderabbit-simple.sh
```

### Pre-commit Hook Example
```bash
#!/bin/bash
# .git/hooks/pre-commit
bash scripts/test-coderabbit-simple.sh
if [ $? -ne 0 ]; then
  echo "CodeRabbit integration script tests failed"
  exit 1
fi
```

---

## Quick Checks

### Before Committing Changes
```bash
# Run these quick checks
bash -n scripts/coderabbit-wrapper.sh || exit 1
bash -n scripts/coderabbit-status.sh || exit 1
bash -n scripts/run-tests.sh || exit 1
echo "✓ All scripts syntax OK"
```

### Before Pushing to Repository
```bash
# Run full test suite
bash scripts/test-coderabbit-simple.sh
```

### Before Production Deployment
```bash
# Run comprehensive tests
bash scripts/test-coderabbit-integration.sh
```

---

## Support

### Documentation
- `TEST_RESULTS.md` - Complete test scenarios
- `TESTING_SUMMARY.md` - Executive summary
- `docs/coderabbit-cli.md` - Full integration guide
- `CLAUDE.md` - Project instructions

### Test Execution Time
- Script validation: ~30 seconds
- Simple test suite: ~1-2 minutes
- Comprehensive suite: ~2-3 minutes
- Full CodeRabbit review: 7-30+ minutes

---

*Last updated: 2025-10-28*
*Test automation by: Claude Code*
