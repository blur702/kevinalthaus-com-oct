#!/usr/bin/env bash
# CodeRabbit CLI Wrapper with Progress Monitoring and Completion Notification
# This script wraps CodeRabbit CLI calls to provide:
# - Real-time progress updates
# - Completion notifications
# - Automatic test execution integration
# - Structured output for AI consumption

set -euo pipefail

# Color codes for terminal output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly STATUS_DIR="${PROJECT_ROOT}/.coderabbit-status"
readonly CODERABBIT_BIN="${HOME}/.local/bin/coderabbit"

# Status file paths
readonly STATUS_FILE="${STATUS_DIR}/status.json"
readonly OUTPUT_FILE="${STATUS_DIR}/output.txt"
readonly PROGRESS_FILE="${STATUS_DIR}/progress.log"
readonly NOTIFICATION_FILE="${STATUS_DIR}/notification.txt"

# Timestamp helper
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Log helper with timestamp
log() {
    local level="$1"
    shift
    local message="$*"
    local color="${NC}"

    case "$level" in
        INFO) color="${BLUE}" ;;
        SUCCESS) color="${GREEN}" ;;
        WARNING) color="${YELLOW}" ;;
        ERROR) color="${RED}" ;;
        PROGRESS) color="${CYAN}" ;;
    esac

    echo -e "${color}[$(timestamp)] [$level]${NC} $message"

    # Only write to progress file if directory exists
    if [ -d "${STATUS_DIR}" ]; then
        echo "[$(timestamp)] [$level] $message" >> "${PROGRESS_FILE}"
    fi
}

# Initialize status directory
init_status_dir() {
    mkdir -p "${STATUS_DIR}"

    # Clear old files
    rm -f "${OUTPUT_FILE}" "${PROGRESS_FILE}" "${NOTIFICATION_FILE}"

    # Initialize status JSON
    cat > "${STATUS_FILE}" <<EOF
{
  "status": "initializing",
  "startTime": "$(date -Iseconds)",
  "pid": $$,
  "phase": "setup",
  "testsRun": false,
  "testsPassed": null,
  "reviewComplete": false,
  "issuesFound": null,
  "exitCode": null
}
EOF

    log INFO "Status directory initialized: ${STATUS_DIR}"
}

# Update status JSON
update_status() {
    local field="$1"
    local value="$2"

    # Use jq if available, otherwise use sed
    if command -v jq &> /dev/null; then
        local temp_file="${STATUS_FILE}.tmp"
        jq --arg val "$value" ".${field} = \$val" "${STATUS_FILE}" > "${temp_file}"
        mv "${temp_file}" "${STATUS_FILE}"
    else
        # Fallback to sed for simple string updates
        sed -i "s/\"${field}\": \"[^\"]*\"/\"${field}\": \"${value}\"/" "${STATUS_FILE}"
    fi
}

# Update numeric status field
update_status_number() {
    local field="$1"
    local value="$2"

    if command -v jq &> /dev/null; then
        local temp_file="${STATUS_FILE}.tmp"
        jq ".${field} = ${value}" "${STATUS_FILE}" > "${temp_file}"
        mv "${temp_file}" "${STATUS_FILE}"
    else
        sed -i "s/\"${field}\": [^,}]*/\"${field}\": ${value}/" "${STATUS_FILE}"
    fi
}

# Run tests before CodeRabbit review
run_tests() {
    log INFO "Running tests before CodeRabbit review..."
    update_status "phase" "testing"
    update_status "status" "running_tests"

    local test_exit_code=0
    local test_output

    # Run linting first
    log PROGRESS "Running linting checks..."
    if test_output=$(cd "${PROJECT_ROOT}" && npm run lint 2>&1); then
        log SUCCESS "Linting passed"
    else
        test_exit_code=$?
        log WARNING "Linting found issues (continuing anyway)"
        echo "$test_output" >> "${PROGRESS_FILE}"
    fi

    # Check if any packages have test scripts
    log PROGRESS "Checking for test suites..."
    local packages_with_tests=()

    for package_json in "${PROJECT_ROOT}"/packages/*/package.json; do
        if grep -q '"test"' "$package_json" 2>/dev/null; then
            local package_dir=$(dirname "$package_json")
            local package_name=$(basename "$package_dir")
            packages_with_tests+=("$package_name")
        fi
    done

    if [ ${#packages_with_tests[@]} -gt 0 ]; then
        log INFO "Found ${#packages_with_tests[@]} package(s) with tests"

        for package_name in "${packages_with_tests[@]}"; do
            log PROGRESS "Running tests for ${package_name}..."
            if test_output=$(cd "${PROJECT_ROOT}/packages/${package_name}" && npm test 2>&1); then
                log SUCCESS "Tests passed for ${package_name}"
            else
                test_exit_code=$?
                log WARNING "Tests failed for ${package_name} (continuing anyway)"
                echo "$test_output" >> "${PROGRESS_FILE}"
            fi
        done
    else
        log INFO "No test suites found in packages"
    fi

    update_status "testsRun" "true"

    if [ $test_exit_code -eq 0 ]; then
        update_status "testsPassed" "true"
        log SUCCESS "All tests completed successfully"
        return 0
    else
        update_status "testsPassed" "false"
        log WARNING "Some tests failed but continuing with review"
        return 0  # Don't fail the whole process
    fi
}

# Run CodeRabbit review with progress monitoring
run_coderabbit_review() {
    local review_type="${1:-uncommitted}"
    local additional_args=("${@:2}")

    log INFO "Starting CodeRabbit review (type: ${review_type})..."
    update_status "phase" "reviewing"
    update_status "status" "running_review"

    # Check if CodeRabbit CLI is installed
    if [ ! -x "${CODERABBIT_BIN}" ]; then
        log ERROR "CodeRabbit CLI not found at ${CODERABBIT_BIN}"
        log ERROR "Please install it with: curl -fsSL https://cli.coderabbit.ai/install.sh | sh"
        update_status "status" "error"
        update_status "phase" "failed"
        return 1
    fi

    # Build command
    local cmd=(
        "${CODERABBIT_BIN}"
        "review"
        "--prompt-only"
        "--type" "${review_type}"
        "${additional_args[@]}"
    )

    log INFO "Running: ${cmd[*]}"
    log PROGRESS "Review in progress (this may take 7-30+ minutes)..."

    # Start background progress indicator
    local progress_pid
    {
        local elapsed=0
        while kill -0 $$ 2>/dev/null; do
            local mins=$((elapsed / 60))
            local secs=$((elapsed % 60))
            printf "\r${CYAN}[%02d:%02d] Review in progress...${NC}" $mins $secs
            sleep 1
            ((elapsed++))
        done
    } &
    progress_pid=$!

    # Run CodeRabbit and capture output
    local exit_code=0
    local review_output

    if review_output=$(cd "${PROJECT_ROOT}" && "${cmd[@]}" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi

    # Stop progress indicator
    kill $progress_pid 2>/dev/null || true
    wait $progress_pid 2>/dev/null || true
    echo "" # New line after progress

    # Save output
    echo "$review_output" > "${OUTPUT_FILE}"
    echo "$review_output" >> "${PROGRESS_FILE}"

    update_status_number "exitCode" "$exit_code"

    if [ $exit_code -eq 0 ]; then
        log SUCCESS "CodeRabbit review completed successfully"
        update_status "status" "completed"
        update_status "reviewComplete" "true"

        # Parse issues count from output
        local issues_count=$(echo "$review_output" | grep -oP '(?<=Found )\d+(?= issue)' | head -1 || echo "0")
        update_status_number "issuesFound" "$issues_count"

        log INFO "Issues found: ${issues_count}"

        return 0
    else
        log ERROR "CodeRabbit review failed with exit code: $exit_code"
        update_status "status" "failed"
        update_status "phase" "error"

        return $exit_code
    fi
}

# Create completion notification
create_notification() {
    local exit_code=$1

    log INFO "Creating completion notification..."
    update_status "phase" "notification"

    local status_data
    if [ -f "${STATUS_FILE}" ]; then
        status_data=$(cat "${STATUS_FILE}")
    else
        log ERROR "Status file not found"
        return 1
    fi

    # Extract key information
    local start_time=$(echo "$status_data" | grep -oP '(?<="startTime": ")[^"]*' || echo "unknown")
    local end_time=$(date -Iseconds)
    local tests_passed=$(echo "$status_data" | grep -oP '(?<="testsPassed": )[^,}]*' || echo "null")
    local issues_found=$(echo "$status_data" | grep -oP '(?<="issuesFound": )[^,}]*' || echo "0")

    # Create notification content
    cat > "${NOTIFICATION_FILE}" <<EOF
=============================================================================
                    CODERABBIT REVIEW COMPLETE
=============================================================================

Status: $([ $exit_code -eq 0 ] && echo "SUCCESS" || echo "FAILED")
Exit Code: $exit_code

Timeline:
  Started:  $start_time
  Finished: $end_time

Test Results:
  Tests Run: $([ "$tests_passed" = "null" ] && echo "No" || echo "Yes")
  Tests Passed: $([ "$tests_passed" = "true" ] && echo "Yes" || [ "$tests_passed" = "false" ] && echo "No" || echo "N/A")

Review Results:
  Issues Found: $([ "$issues_found" = "null" ] && echo "N/A" || echo "$issues_found")

Output Location:
  Full output: ${OUTPUT_FILE}
  Progress log: ${PROGRESS_FILE}
  Status JSON: ${STATUS_FILE}

=============================================================================

$([ $exit_code -eq 0 ] && cat <<EOSUCCESS
Next Steps:
1. Review the output file: cat "${OUTPUT_FILE}"
2. Apply fixes as recommended
3. Re-run tests to verify fixes
4. Run this script again to verify all issues are resolved

EOSUCCESS
)

$([ $exit_code -ne 0 ] && cat <<EOFAIL
Troubleshooting:
1. Check the progress log: cat "${PROGRESS_FILE}"
2. Verify CodeRabbit authentication: coderabbit auth login
3. Check Git configuration: git status
4. Review error messages above

EOFAIL
)

=============================================================================
EOF

    # Display notification
    cat "${NOTIFICATION_FILE}"

    # Also log to progress file
    cat "${NOTIFICATION_FILE}" >> "${PROGRESS_FILE}"

    log SUCCESS "Notification created: ${NOTIFICATION_FILE}"
}

# Cleanup function
cleanup() {
    local exit_code=$?

    log INFO "Cleaning up..."

    # Update final status
    update_status "status" "$([ $exit_code -eq 0 ] && echo 'completed' || echo 'failed')"
    update_status "endTime" "$(date -Iseconds)"
    update_status_number "exitCode" "$exit_code"

    # Create notification
    create_notification $exit_code

    log INFO "Cleanup complete"
}

# Main execution
main() {
    log INFO "CodeRabbit Wrapper Script Started"
    log INFO "Project root: ${PROJECT_ROOT}"

    # Parse arguments
    local run_tests=true
    local review_type="uncommitted"
    local additional_args=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-tests)
                run_tests=false
                shift
                ;;
            --type)
                review_type="$2"
                shift 2
                ;;
            --help)
                cat <<USAGE
Usage: $(basename "$0") [OPTIONS]

Options:
  --no-tests          Skip running tests before review
  --type TYPE         Review type (uncommitted, staged, etc.)
  --base BRANCH       Base branch for comparison
  --help              Show this help message

Environment:
  STATUS_DIR:         ${STATUS_DIR}
  CODERABBIT_BIN:     ${CODERABBIT_BIN}

Examples:
  # Review uncommitted changes with tests
  $(basename "$0")

  # Review staged changes without tests
  $(basename "$0") --type staged --no-tests

  # Review changes against main branch
  $(basename "$0") --base main

USAGE
                exit 0
                ;;
            *)
                additional_args+=("$1")
                shift
                ;;
        esac
    done

    # Set up cleanup trap
    trap cleanup EXIT

    # Initialize
    init_status_dir

    # Run tests if requested
    if [ "$run_tests" = true ]; then
        run_tests || log WARNING "Tests completed with warnings"
    else
        log INFO "Skipping tests (--no-tests flag provided)"
    fi

    # Run CodeRabbit review
    run_coderabbit_review "$review_type" "${additional_args[@]}"

    log SUCCESS "All operations completed successfully"
}

# Execute main function
main "$@"
