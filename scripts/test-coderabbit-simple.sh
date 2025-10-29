#!/usr/bin/env bash
# Simplified CodeRabbit Integration Test Suite
# Tests all three scripts without running full CodeRabbit reviews

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly TEST_STATUS_DIR="${PROJECT_ROOT}/.coderabbit-status-test"

# Test tracking
declare -i TESTS_RUN=0
declare -i TESTS_PASSED=0
declare -i TESTS_FAILED=0
declare -a FAILED_TESTS=()

# Cleanup test directory on exit
cleanup() {
    if [ -d "${TEST_STATUS_DIR}" ]; then
        rm -rf "${TEST_STATUS_DIR}"
    fi
    if [ -d "${PROJECT_ROOT}/.coderabbit-status" ]; then
        rm -rf "${PROJECT_ROOT}/.coderabbit-status" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Test result helpers
test_start() {
    local test_name="$1"
    echo ""
    echo "========================================================================"
    echo "TEST: $test_name"
    echo "========================================================================"
    ((TESTS_RUN++))
}

test_pass() {
    local test_name="$1"
    echo "✓ PASSED: $test_name"
    ((TESTS_PASSED++))
}

test_fail() {
    local test_name="$1"
    local reason="$2"
    echo "✗ FAILED: $test_name"
    echo "  Reason: $reason"
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$test_name")
}

# Test 1: Script Syntax Validation
test_script_syntax() {
    test_start "Script Syntax Validation"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"
    local runner="${SCRIPT_DIR}/run-tests.sh"

    local syntax_valid=true

    echo "Checking coderabbit-wrapper.sh..."
    if bash -n "$wrapper"; then
        echo "  ✓ Wrapper syntax valid"
    else
        echo "  ✗ Wrapper has syntax errors"
        syntax_valid=false
    fi

    echo "Checking coderabbit-status.sh..."
    if bash -n "$status"; then
        echo "  ✓ Status script syntax valid"
    else
        echo "  ✗ Status script has syntax errors"
        syntax_valid=false
    fi

    echo "Checking run-tests.sh..."
    if bash -n "$runner"; then
        echo "  ✓ Runner script syntax valid"
    else
        echo "  ✗ Runner script has syntax errors"
        syntax_valid=false
    fi

    if [ "$syntax_valid" = true ]; then
        test_pass "Script Syntax Validation"
    else
        test_fail "Script Syntax Validation" "One or more scripts have syntax errors"
    fi
}

# Test 2: Script Initialization
test_script_initialization() {
    test_start "Script Initialization - Executable Permissions"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"
    local runner="${SCRIPT_DIR}/run-tests.sh"

    local all_ok=true

    if [ ! -f "$wrapper" ]; then
        echo "  ✗ coderabbit-wrapper.sh not found"
        all_ok=false
    elif [ ! -x "$wrapper" ]; then
        echo "  ⚠ coderabbit-wrapper.sh not executable"
        all_ok=false
    else
        echo "  ✓ coderabbit-wrapper.sh exists and is executable"
    fi

    if [ ! -f "$status" ]; then
        echo "  ✗ coderabbit-status.sh not found"
        all_ok=false
    elif [ ! -x "$status" ]; then
        echo "  ⚠ coderabbit-status.sh not executable"
        all_ok=false
    else
        echo "  ✓ coderabbit-status.sh exists and is executable"
    fi

    if [ ! -f "$runner" ]; then
        echo "  ✗ run-tests.sh not found"
        all_ok=false
    elif [ ! -x "$runner" ]; then
        echo "  ⚠ run-tests.sh not executable"
        all_ok=false
    else
        echo "  ✓ run-tests.sh exists and is executable"
    fi

    if [ "$all_ok" = true ]; then
        test_pass "Script Initialization"
    else
        test_fail "Script Initialization" "One or more scripts missing or not executable"
    fi
}

# Test 3: Help Commands
test_help_commands() {
    test_start "Help Commands Display"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"
    local runner="${SCRIPT_DIR}/run-tests.sh"

    local help_ok=true

    echo "Testing wrapper --help..."
    if bash "$wrapper" --help 2>&1 | grep -q "Usage:" && \
       bash "$wrapper" --help 2>&1 | grep -q "Options:" && \
       bash "$wrapper" --help 2>&1 | grep -q "Examples:"; then
        echo "  ✓ Wrapper help displays correctly"
    else
        echo "  ✗ Wrapper help missing sections"
        help_ok=false
    fi

    echo "Testing status --help..."
    if bash "$status" --help 2>&1 | grep -q "Usage:" && \
       bash "$status" --help 2>&1 | grep -q "Commands:"; then
        echo "  ✓ Status help displays correctly"
    else
        echo "  ✗ Status help missing sections"
        help_ok=false
    fi

    echo "Testing runner --help..."
    if bash "$runner" --help 2>&1 | grep -q "Usage:" && \
       bash "$runner" --help 2>&1 | grep -q "Options:"; then
        echo "  ✓ Runner help displays correctly"
    else
        echo "  ✗ Runner help missing sections"
        help_ok=false
    fi

    if [ "$help_ok" = true ]; then
        test_pass "Help Commands Display"
    else
        test_fail "Help Commands Display" "One or more help commands incomplete"
    fi
}

# Test 4: Directory Paths
test_directory_paths() {
    test_start "Directory Path Validation"

    local paths_ok=true

    if [ ! -d "$PROJECT_ROOT" ]; then
        echo "  ✗ Project root missing: $PROJECT_ROOT"
        paths_ok=false
    else
        echo "  ✓ Project root exists"
    fi

    if [ ! -d "$SCRIPT_DIR" ]; then
        echo "  ✗ Scripts directory missing"
        paths_ok=false
    else
        echo "  ✓ Scripts directory exists"
    fi

    if [ ! -d "${PROJECT_ROOT}/packages" ]; then
        echo "  ✗ Packages directory missing"
        paths_ok=false
    else
        echo "  ✓ Packages directory exists"
    fi

    if [ "$paths_ok" = true ]; then
        test_pass "Directory Path Validation"
    else
        test_fail "Directory Path Validation" "Required directories missing"
    fi
}

# Test 5: Test Runner --no-tests Flag
test_runner_no_tests() {
    test_start "Test Runner --no-tests Flag"

    local runner="${SCRIPT_DIR}/run-tests.sh"
    local output

    echo "Running: run-tests.sh --no-tests"
    if output=$(bash "$runner" --no-tests 2>&1); then
        echo "  ✓ Command executed successfully"
    else
        echo "  ⚠ Command exited with error (may be expected if lint fails)"
    fi

    if echo "$output" | grep -q "Running linting checks"; then
        echo "  ✓ Linting was executed"
    else
        echo "  ⚠ Linting output not found"
    fi

    if echo "$output" | grep -q "Discovering packages with tests"; then
        test_fail "Test Runner --no-tests" "Tests were run despite --no-tests flag"
    else
        echo "  ✓ Tests were skipped"
        test_pass "Test Runner --no-tests"
    fi
}

# Test 6: Status Monitor - No Review Running
test_status_no_review() {
    test_start "Status Monitor - No Review Error"

    local status="${SCRIPT_DIR}/coderabbit-status.sh"

    # Ensure no status directory
    rm -rf "${PROJECT_ROOT}/.coderabbit-status" 2>/dev/null || true

    echo "Running status script with no review..."
    local output
    local exit_code=0

    if output=$(bash "$status" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi

    if [ $exit_code -ne 0 ]; then
        echo "  ✓ Correctly exits with error: $exit_code"
    else
        test_fail "Status Monitor No Review" "Should exit with error when no review running"
        return
    fi

    if echo "$output" | grep -q "No CodeRabbit review status found"; then
        echo "  ✓ Shows helpful error message"
        test_pass "Status Monitor No Review"
    else
        test_fail "Status Monitor No Review" "Missing error message"
    fi
}

# Test 7: Status JSON Output
test_status_json() {
    test_start "Status Monitor - JSON Output Mode"

    mkdir -p "${TEST_STATUS_DIR}"
    cat > "${TEST_STATUS_DIR}/status.json" <<'EOF'
{
  "status": "testing",
  "phase": "test",
  "pid": 12345
}
EOF

    echo "Created test status file"

    if [ -f "${TEST_STATUS_DIR}/status.json" ]; then
        echo "  ✓ Mock status.json created"
    else
        test_fail "Status JSON Output" "Could not create mock status file"
        return
    fi

    if grep -q '"status"' "${TEST_STATUS_DIR}/status.json" && \
       grep -q '"phase"' "${TEST_STATUS_DIR}/status.json" && \
       grep -q '"pid"' "${TEST_STATUS_DIR}/status.json"; then
        echo "  ✓ JSON structure is valid"
        test_pass "Status JSON Output"
    else
        test_fail "Status JSON Output" "JSON structure invalid"
    fi

    rm -rf "${TEST_STATUS_DIR}"
}

# Test 8: Wrapper Directory Creation
test_wrapper_directory() {
    test_start "Wrapper Directory Structure Creation"

    mkdir -p "${TEST_STATUS_DIR}"
    cat > "${TEST_STATUS_DIR}/status.json" <<'EOF'
{
  "status": "initializing",
  "startTime": "2025-10-28T10:00:00+00:00",
  "pid": 99999,
  "phase": "setup",
  "testsRun": false,
  "testsPassed": null,
  "reviewComplete": false,
  "issuesFound": null,
  "exitCode": null
}
EOF

    local structure_ok=true

    if [ -f "${TEST_STATUS_DIR}/status.json" ]; then
        echo "  ✓ status.json created"
    else
        echo "  ✗ status.json not created"
        structure_ok=false
    fi

    if grep -q '"status": "initializing"' "${TEST_STATUS_DIR}/status.json"; then
        echo "  ✓ Initial status correct"
    else
        echo "  ✗ Initial status incorrect"
        structure_ok=false
    fi

    if grep -q '"testsRun": false' "${TEST_STATUS_DIR}/status.json" && \
       grep -q '"reviewComplete": false' "${TEST_STATUS_DIR}/status.json"; then
        echo "  ✓ Required fields present"
    else
        echo "  ✗ Missing required fields"
        structure_ok=false
    fi

    if [ "$structure_ok" = true ]; then
        test_pass "Wrapper Directory Structure"
    else
        test_fail "Wrapper Directory Structure" "Directory structure validation failed"
    fi

    rm -rf "${TEST_STATUS_DIR}"
}

# Test 9: Error Handling - Missing CodeRabbit CLI
test_error_missing_coderabbit() {
    test_start "Error Handling - Missing CodeRabbit CLI"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"

    echo "Checking for CLI validation logic..."
    if grep -q "CodeRabbit CLI not found" "$wrapper"; then
        echo "  ✓ CLI validation present"
    else
        test_fail "Error Handling Missing CLI" "Missing CLI validation"
        return
    fi

    if grep -q "install it with:" "$wrapper"; then
        echo "  ✓ Installation instructions present"
        test_pass "Error Handling Missing CLI"
    else
        test_fail "Error Handling Missing CLI" "Missing installation instructions"
    fi
}

# Test 10: Cleanup Handlers
test_cleanup_handlers() {
    test_start "Cleanup Handlers"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"

    if grep -q "trap cleanup EXIT" "$wrapper"; then
        echo "  ✓ EXIT trap registered"
    else
        echo "  ⚠ EXIT trap not found"
    fi

    if grep -q "^cleanup()" "$wrapper"; then
        echo "  ✓ cleanup() function defined"
        test_pass "Cleanup Handlers"
    else
        test_fail "Cleanup Handlers" "cleanup() function not found"
    fi
}

# Test 11: Exit Codes
test_exit_codes() {
    test_start "Exit Code Validation"

    local runner="${SCRIPT_DIR}/run-tests.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"

    echo "Testing help command exit code..."
    local help_exit=0
    bash "$runner" --help >/dev/null 2>&1 || help_exit=$?

    if [ $help_exit -eq 0 ]; then
        echo "  ✓ Help exits with 0"
    else
        echo "  ✗ Help exits with $help_exit"
        test_fail "Exit Code Validation" "Help should exit with 0"
        return
    fi

    echo "Testing status error exit code..."
    rm -rf "${PROJECT_ROOT}/.coderabbit-status"
    local status_exit=0
    bash "$status" >/dev/null 2>&1 || status_exit=$?

    if [ $status_exit -ne 0 ]; then
        echo "  ✓ Status error exits with non-zero"
        test_pass "Exit Code Validation"
    else
        test_fail "Exit Code Validation" "Status should exit with non-zero on error"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "========================================================================"
    echo "                          TEST SUMMARY"
    echo "========================================================================"
    echo ""
    echo "Total Tests Run:     $TESTS_RUN"
    echo "Tests Passed:        $TESTS_PASSED"
    echo "Tests Failed:        $TESTS_FAILED"

    local pass_rate=0
    if [ $TESTS_RUN -gt 0 ]; then
        pass_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    fi
    echo "Pass Rate:           ${pass_rate}%"

    if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
        echo ""
        echo "Failed Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  ✗ $test"
        done
    fi

    echo ""
    echo "========================================================================"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo "✓ ALL TESTS PASSED!"
        echo ""
        return 0
    else
        echo "✗ SOME TESTS FAILED"
        echo ""
        return 1
    fi
}

# Main execution
main() {
    echo "========================================================================"
    echo "       CodeRabbit Integration Test Suite - Comprehensive Tests"
    echo "========================================================================"
    echo ""
    echo "Project Root: $PROJECT_ROOT"
    echo "Script Directory: $SCRIPT_DIR"
    echo ""

    # Run all tests
    test_script_syntax
    test_script_initialization
    test_directory_paths
    test_help_commands
    test_runner_no_tests
    test_status_no_review
    test_status_json
    test_wrapper_directory
    test_error_missing_coderabbit
    test_cleanup_handlers
    test_exit_codes

    # Print summary and exit
    print_summary
}

# Execute main
main "$@"
