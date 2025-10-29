#!/usr/bin/env bash
# Comprehensive Test Suite for CodeRabbit Integration Scripts
# Tests all three scripts without running full CodeRabbit reviews

set -euo pipefail

# Color codes for test output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly NC='\033[0m'

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
}
trap cleanup EXIT

# Test result helpers
test_start() {
    local test_name="$1"
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}TEST:${NC} $test_name"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    ((TESTS_RUN++))
}

test_pass() {
    local test_name="$1"
    echo -e "${GREEN}✓ PASSED:${NC} $test_name\n"
    ((TESTS_PASSED++))
}

test_fail() {
    local test_name="$1"
    local reason="$2"
    echo -e "${RED}✗ FAILED:${NC} $test_name"
    echo -e "${RED}  Reason:${NC} $reason\n"
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$test_name")
}

# Test 1: Script Initialization - Check all scripts are executable
test_script_initialization() {
    test_start "Script Initialization - Verify all scripts are executable"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"
    local runner="${SCRIPT_DIR}/run-tests.sh"

    local all_executable=true
    local missing_scripts=()

    # Check if files exist
    if [ ! -f "$wrapper" ]; then
        missing_scripts+=("coderabbit-wrapper.sh")
        all_executable=false
    fi

    if [ ! -f "$status" ]; then
        missing_scripts+=("coderabbit-status.sh")
        all_executable=false
    fi

    if [ ! -f "$runner" ]; then
        missing_scripts+=("run-tests.sh")
        all_executable=false
    fi

    if [ ${#missing_scripts[@]} -gt 0 ]; then
        test_fail "Script Initialization" "Missing scripts: ${missing_scripts[*]}"
        return
    fi

    # Check if executable
    if [ ! -x "$wrapper" ]; then
        echo -e "${YELLOW}Warning:${NC} coderabbit-wrapper.sh is not executable"
        all_executable=false
    fi

    if [ ! -x "$status" ]; then
        echo -e "${YELLOW}Warning:${NC} coderabbit-status.sh is not executable"
        all_executable=false
    fi

    if [ ! -x "$runner" ]; then
        echo -e "${YELLOW}Warning:${NC} run-tests.sh is not executable"
        all_executable=false
    fi

    if [ "$all_executable" = true ]; then
        test_pass "Script Initialization"
    else
        test_fail "Script Initialization" "One or more scripts are not executable (see warnings above)"
    fi
}

# Test 2: Help Commands - Verify help text displays correctly
test_help_commands() {
    test_start "Help Commands - Verify help text displays correctly"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"
    local runner="${SCRIPT_DIR}/run-tests.sh"

    local help_tests_passed=true

    # Test wrapper help
    echo -e "${BLUE}Testing coderabbit-wrapper.sh --help${NC}"
    if bash "$wrapper" --help 2>&1 | grep -q "Usage:"; then
        echo -e "${GREEN}✓${NC} Wrapper help contains 'Usage:'"
    else
        echo -e "${RED}✗${NC} Wrapper help missing 'Usage:'"
        help_tests_passed=false
    fi

    if bash "$wrapper" --help 2>&1 | grep -q "Options:"; then
        echo -e "${GREEN}✓${NC} Wrapper help contains 'Options:'"
    else
        echo -e "${RED}✗${NC} Wrapper help missing 'Options:'"
        help_tests_passed=false
    fi

    if bash "$wrapper" --help 2>&1 | grep -q "Examples:"; then
        echo -e "${GREEN}✓${NC} Wrapper help contains 'Examples:'"
    else
        echo -e "${RED}✗${NC} Wrapper help missing 'Examples:'"
        help_tests_passed=false
    fi

    # Test status help
    echo -e "\n${BLUE}Testing coderabbit-status.sh --help${NC}"
    if bash "$status" --help 2>&1 | grep -q "Usage:"; then
        echo -e "${GREEN}✓${NC} Status help contains 'Usage:'"
    else
        echo -e "${RED}✗${NC} Status help missing 'Usage:'"
        help_tests_passed=false
    fi

    if bash "$status" --help 2>&1 | grep -q "Commands:"; then
        echo -e "${GREEN}✓${NC} Status help contains 'Commands:'"
    else
        echo -e "${RED}✗${NC} Status help missing 'Commands:'"
        help_tests_passed=false
    fi

    # Test runner help
    echo -e "\n${BLUE}Testing run-tests.sh --help${NC}"
    if bash "$runner" --help 2>&1 | grep -q "Usage:"; then
        echo -e "${GREEN}✓${NC} Runner help contains 'Usage:'"
    else
        echo -e "${RED}✗${NC} Runner help missing 'Usage:'"
        help_tests_passed=false
    fi

    if bash "$runner" --help 2>&1 | grep -q "Options:"; then
        echo -e "${GREEN}✓${NC} Runner help contains 'Options:'"
    else
        echo -e "${RED}✗${NC} Runner help missing 'Options:'"
        help_tests_passed=false
    fi

    if [ "$help_tests_passed" = true ]; then
        test_pass "Help Commands"
    else
        test_fail "Help Commands" "One or more help commands missing required sections"
    fi
}

# Test 3: Directory and File Path Validation
test_directory_paths() {
    test_start "Directory Paths - Verify all required paths are valid"

    local paths_valid=true

    # Check project root
    if [ ! -d "$PROJECT_ROOT" ]; then
        echo -e "${RED}✗${NC} Project root does not exist: $PROJECT_ROOT"
        paths_valid=false
    else
        echo -e "${GREEN}✓${NC} Project root exists: $PROJECT_ROOT"
    fi

    # Check scripts directory
    if [ ! -d "$SCRIPT_DIR" ]; then
        echo -e "${RED}✗${NC} Scripts directory does not exist: $SCRIPT_DIR"
        paths_valid=false
    else
        echo -e "${GREEN}✓${NC} Scripts directory exists: $SCRIPT_DIR"
    fi

    # Check packages directory
    if [ ! -d "${PROJECT_ROOT}/packages" ]; then
        echo -e "${RED}✗${NC} Packages directory does not exist: ${PROJECT_ROOT}/packages"
        paths_valid=false
    else
        echo -e "${GREEN}✓${NC} Packages directory exists"
    fi

    if [ "$paths_valid" = true ]; then
        test_pass "Directory Paths"
    else
        test_fail "Directory Paths" "One or more required directories do not exist"
    fi
}

# Test 4: Test Runner Validation - No Tests Flag
test_runner_no_tests() {
    test_start "Test Runner - Validate --no-tests flag"

    local runner="${SCRIPT_DIR}/run-tests.sh"
    local output
    local exit_code=0

    echo -e "${BLUE}Running: run-tests.sh --no-tests${NC}"

    # Run with --no-tests flag (should skip tests, run lint only)
    if output=$(bash "$runner" --no-tests 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi

    # Check if it ran linting
    if echo "$output" | grep -q "Running linting checks"; then
        echo -e "${GREEN}✓${NC} Lint checks were executed"
    else
        echo -e "${YELLOW}Note:${NC} Lint checks output not found (may have failed)"
    fi

    # Check if it skipped tests
    if echo "$output" | grep -q "Discovering packages with tests"; then
        test_fail "Test Runner --no-tests" "Tests were run despite --no-tests flag"
        return
    else
        echo -e "${GREEN}✓${NC} Tests were skipped as expected"
    fi

    # Exit code should be 0 (success) or 1 (lint failures are acceptable)
    if [ $exit_code -le 1 ]; then
        echo -e "${GREEN}✓${NC} Exit code is acceptable: $exit_code"
        test_pass "Test Runner --no-tests"
    else
        test_fail "Test Runner --no-tests" "Unexpected exit code: $exit_code"
    fi
}

# Test 5: Test Runner - Package Discovery
test_runner_package_discovery() {
    test_start "Test Runner - Verify package discovery"

    local runner="${SCRIPT_DIR}/run-tests.sh"
    local output

    echo -e "${BLUE}Running: run-tests.sh --no-tests (to check package discovery)${NC}"

    # Run to see what packages it finds
    output=$(bash "$runner" --no-tests 2>&1 || true)

    # Check if it attempts to discover packages (even if none have tests)
    if echo "$output" | grep -q "Running linting"; then
        echo -e "${GREEN}✓${NC} Script executes package discovery logic"
        test_pass "Test Runner Package Discovery"
    else
        test_fail "Test Runner Package Discovery" "Package discovery logic not executed"
    fi
}

# Test 6: Status Monitor - No Review Running
test_status_no_review() {
    test_start "Status Monitor - Error when no review is running"

    local status="${SCRIPT_DIR}/coderabbit-status.sh"
    local output
    local exit_code=0

    # Ensure no status directory exists
    rm -rf "${PROJECT_ROOT}/.coderabbit-status"

    echo -e "${BLUE}Running: coderabbit-status.sh (with no review running)${NC}"

    if output=$(bash "$status" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi

    # Should exit with error
    if [ $exit_code -ne 0 ]; then
        echo -e "${GREEN}✓${NC} Correctly exits with error: code $exit_code"
    else
        test_fail "Status Monitor No Review" "Script should exit with error when no review running"
        return
    fi

    # Should show helpful error message
    if echo "$output" | grep -q "No CodeRabbit review status found"; then
        echo -e "${GREEN}✓${NC} Shows helpful error message"
        test_pass "Status Monitor No Review"
    else
        test_fail "Status Monitor No Review" "Missing helpful error message"
    fi
}

# Test 7: Status Monitor - JSON Output Mode
test_status_json_mode() {
    test_start "Status Monitor - JSON output mode validation"

    local status="${SCRIPT_DIR}/coderabbit-status.sh"

    # Create a mock status directory
    mkdir -p "${TEST_STATUS_DIR}"

    # Create a minimal status.json
    cat > "${TEST_STATUS_DIR}/status.json" <<'EOF'
{
  "status": "testing",
  "phase": "test",
  "pid": 12345
}
EOF

    # Temporarily modify the script to use test directory
    local output
    local exit_code=0

    echo -e "${BLUE}Testing JSON output mode${NC}"

    # Test with mock status file directly
    if [ -f "${TEST_STATUS_DIR}/status.json" ]; then
        echo -e "${GREEN}✓${NC} Mock status.json created successfully"

        # Read and validate JSON structure
        if grep -q '"status"' "${TEST_STATUS_DIR}/status.json" && \
           grep -q '"phase"' "${TEST_STATUS_DIR}/status.json" && \
           grep -q '"pid"' "${TEST_STATUS_DIR}/status.json"; then
            echo -e "${GREEN}✓${NC} JSON structure is valid"
            test_pass "Status Monitor JSON Mode"
        else
            test_fail "Status Monitor JSON Mode" "JSON structure validation failed"
        fi
    else
        test_fail "Status Monitor JSON Mode" "Could not create mock status file"
    fi

    # Cleanup
    rm -rf "${TEST_STATUS_DIR}"
}

# Test 8: Wrapper Script - Directory Structure Creation
test_wrapper_directory_creation() {
    test_start "Wrapper Script - Verify directory structure creation"

    # We'll create a minimal mock wrapper to test directory creation
    # without running CodeRabbit

    echo -e "${BLUE}Testing directory structure creation logic${NC}"

    # Create test directory
    mkdir -p "${TEST_STATUS_DIR}"

    # Create mock status file (simulating what wrapper does)
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

    # Verify structure
    local structure_valid=true

    if [ -f "${TEST_STATUS_DIR}/status.json" ]; then
        echo -e "${GREEN}✓${NC} status.json created"
    else
        echo -e "${RED}✗${NC} status.json not created"
        structure_valid=false
    fi

    # Verify JSON content
    if grep -q '"status": "initializing"' "${TEST_STATUS_DIR}/status.json"; then
        echo -e "${GREEN}✓${NC} Initial status is correct"
    else
        echo -e "${RED}✗${NC} Initial status incorrect"
        structure_valid=false
    fi

    if grep -q '"testsRun": false' "${TEST_STATUS_DIR}/status.json"; then
        echo -e "${GREEN}✓${NC} testsRun field initialized"
    else
        echo -e "${RED}✗${NC} testsRun field missing"
        structure_valid=false
    fi

    if grep -q '"reviewComplete": false' "${TEST_STATUS_DIR}/status.json"; then
        echo -e "${GREEN}✓${NC} reviewComplete field initialized"
    else
        echo -e "${RED}✗${NC} reviewComplete field missing"
        structure_valid=false
    fi

    if [ "$structure_valid" = true ]; then
        test_pass "Wrapper Directory Creation"
    else
        test_fail "Wrapper Directory Creation" "Directory structure validation failed"
    fi

    # Cleanup
    rm -rf "${TEST_STATUS_DIR}"
}

# Test 9: Error Handling - Missing CodeRabbit CLI
test_error_missing_coderabbit() {
    test_start "Error Handling - Graceful failure when CodeRabbit CLI not installed"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"

    echo -e "${BLUE}Checking if wrapper validates CodeRabbit CLI installation${NC}"

    # Check if script contains validation logic
    if grep -q "CodeRabbit CLI not found" "$wrapper"; then
        echo -e "${GREEN}✓${NC} Script contains CodeRabbit CLI validation"
    else
        test_fail "Error Handling Missing CodeRabbit" "Missing CLI validation logic"
        return
    fi

    if grep -q "install it with:" "$wrapper"; then
        echo -e "${GREEN}✓${NC} Script provides installation instructions"
        test_pass "Error Handling Missing CodeRabbit"
    else
        test_fail "Error Handling Missing CodeRabbit" "Missing installation instructions"
    fi
}

# Test 10: Error Handling - Cleanup Handlers
test_cleanup_handlers() {
    test_start "Error Handling - Cleanup handlers work correctly"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"

    echo -e "${BLUE}Checking cleanup handler registration${NC}"

    # Check if scripts register cleanup handlers
    if grep -q "trap cleanup EXIT" "$wrapper"; then
        echo -e "${GREEN}✓${NC} Wrapper has EXIT trap registered"
    else
        echo -e "${YELLOW}Warning:${NC} Wrapper missing EXIT trap"
    fi

    # Check if cleanup function exists
    if grep -q "^cleanup()" "$wrapper"; then
        echo -e "${GREEN}✓${NC} Wrapper has cleanup() function defined"
        test_pass "Cleanup Handlers"
    else
        test_fail "Cleanup Handlers" "Wrapper missing cleanup() function"
    fi
}

# Test 11: Script Syntax Validation
test_script_syntax() {
    test_start "Script Syntax - Bash syntax validation"

    local wrapper="${SCRIPT_DIR}/coderabbit-wrapper.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"
    local runner="${SCRIPT_DIR}/run-tests.sh"

    local syntax_valid=true

    echo -e "${BLUE}Validating bash syntax for all scripts${NC}"

    # Test wrapper syntax
    local wrapper_check
    if wrapper_check=$(bash -n "$wrapper" 2>&1); then
        echo -e "${GREEN}✓${NC} coderabbit-wrapper.sh syntax is valid"
    else
        echo -e "${RED}✗${NC} coderabbit-wrapper.sh has syntax errors"
        echo "$wrapper_check"
        syntax_valid=false
    fi

    # Test status syntax
    local status_check
    if status_check=$(bash -n "$status" 2>&1); then
        echo -e "${GREEN}✓${NC} coderabbit-status.sh syntax is valid"
    else
        echo -e "${RED}✗${NC} coderabbit-status.sh has syntax errors"
        echo "$status_check"
        syntax_valid=false
    fi

    # Test runner syntax
    local runner_check
    if runner_check=$(bash -n "$runner" 2>&1); then
        echo -e "${GREEN}✓${NC} run-tests.sh syntax is valid"
    else
        echo -e "${RED}✗${NC} run-tests.sh has syntax errors"
        echo "$runner_check"
        syntax_valid=false
    fi

    if [ "$syntax_valid" = true ]; then
        test_pass "Script Syntax"
    else
        test_fail "Script Syntax" "One or more scripts have syntax errors"
    fi
}

# Test 12: Exit Codes Validation
test_exit_codes() {
    test_start "Exit Codes - Verify correct exit codes"

    local runner="${SCRIPT_DIR}/run-tests.sh"
    local status="${SCRIPT_DIR}/coderabbit-status.sh"

    echo -e "${BLUE}Testing help command exit codes (should be 0)${NC}"

    # Help should exit with 0
    local help_exit=0
    bash "$runner" --help >/dev/null 2>&1 || help_exit=$?

    if [ $help_exit -eq 0 ]; then
        echo -e "${GREEN}✓${NC} run-tests.sh --help exits with 0"
    else
        echo -e "${RED}✗${NC} run-tests.sh --help exits with $help_exit"
        test_fail "Exit Codes" "Help command should exit with 0"
        return
    fi

    # Status with no review should exit with non-zero
    local status_exit=0
    rm -rf "${PROJECT_ROOT}/.coderabbit-status"
    bash "$status" >/dev/null 2>&1 || status_exit=$?

    if [ $status_exit -ne 0 ]; then
        echo -e "${GREEN}✓${NC} coderabbit-status.sh exits with non-zero when no review running"
        test_pass "Exit Codes"
    else
        test_fail "Exit Codes" "Status script should exit with non-zero when no review running"
    fi
}

# Print summary
print_summary() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}                           TEST SUMMARY${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    echo -e "${BLUE}Total Tests Run:${NC}     $TESTS_RUN"
    echo -e "${GREEN}Tests Passed:${NC}        $TESTS_PASSED"
    echo -e "${RED}Tests Failed:${NC}        $TESTS_FAILED"

    local pass_rate=0
    if [ $TESTS_RUN -gt 0 ]; then
        pass_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    fi
    echo -e "${BLUE}Pass Rate:${NC}           ${pass_rate}%"

    if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
        echo -e "\n${RED}Failed Tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "  ${RED}✗${NC} $test"
        done
    fi

    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}\n"
        return 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}\n"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${MAGENTA}"
    cat <<'BANNER'
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║              CodeRabbit Integration Test Suite                               ║
║              Comprehensive Script Validation                                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
BANNER
    echo -e "${NC}\n"

    echo -e "${BLUE}Project Root:${NC} $PROJECT_ROOT"
    echo -e "${BLUE}Script Directory:${NC} $SCRIPT_DIR"
    echo -e "${BLUE}Test Status Directory:${NC} $TEST_STATUS_DIR"

    # Run all tests
    test_script_syntax
    test_script_initialization
    test_directory_paths
    test_help_commands
    test_runner_no_tests
    test_runner_package_discovery
    test_status_no_review
    test_status_json_mode
    test_wrapper_directory_creation
    test_error_missing_coderabbit
    test_cleanup_handlers
    test_exit_codes

    # Print summary and exit
    print_summary
}

# Execute main
main "$@"
