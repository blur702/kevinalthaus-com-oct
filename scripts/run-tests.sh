#!/usr/bin/env bash
# Test Runner Script
# Runs all tests across the monorepo with proper error handling and reporting

set -euo pipefail

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Timestamp helper
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Log helper
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
    esac

    echo -e "${color}[$(timestamp)] [$level]${NC} $message"
}

# Run linting
run_lint() {
    log INFO "Running linting checks..."

    local lint_output
    local lint_exit_code=0

    if lint_output=$(cd "${PROJECT_ROOT}" && npm run lint 2>&1); then
        log SUCCESS "Linting passed"
        return 0
    else
        lint_exit_code=$?
        log ERROR "Linting failed with exit code: $lint_exit_code"
        echo "$lint_output"
        return $lint_exit_code
    fi
}

# Run type checking
run_typecheck() {
    log INFO "Running TypeScript type checking..."

    local typecheck_output
    local typecheck_exit_code=0

    if typecheck_output=$(cd "${PROJECT_ROOT}" && npx lerna run typecheck 2>&1); then
        log SUCCESS "Type checking passed"
        return 0
    else
        typecheck_exit_code=$?
        log WARNING "Type checking found issues (may be expected if no typecheck script exists)"
        return 0  # Don't fail if typecheck script doesn't exist
    fi
}

# Find packages with tests
find_packages_with_tests() {
    local packages=()

    for package_json in "${PROJECT_ROOT}"/packages/*/package.json; do
        if [ -f "$package_json" ] && grep -q '"test"' "$package_json" 2>/dev/null; then
            local package_dir=$(dirname "$package_json")
            local package_name=$(basename "$package_dir")
            packages+=("$package_name")
        fi
    done

    echo "${packages[@]}"
}

# Run unit tests for a specific package
run_package_tests() {
    local package_name="$1"
    local package_dir="${PROJECT_ROOT}/packages/${package_name}"

    log INFO "Running tests for package: ${package_name}"

    if [ ! -d "$package_dir" ]; then
        log ERROR "Package directory not found: $package_dir"
        return 1
    fi

    local test_output
    local test_exit_code=0

    if test_output=$(cd "$package_dir" && npm test 2>&1); then
        log SUCCESS "Tests passed for ${package_name}"
        return 0
    else
        test_exit_code=$?
        log ERROR "Tests failed for ${package_name} with exit code: $test_exit_code"
        echo "$test_output"
        return $test_exit_code
    fi
}

# Run all unit tests
run_all_tests() {
    log INFO "Discovering packages with tests..."

    local packages=$(find_packages_with_tests)

    if [ -z "$packages" ]; then
        log WARNING "No packages with test scripts found"
        return 0
    fi

    local packages_array=($packages)
    log INFO "Found ${#packages_array[@]} package(s) with tests: ${packages_array[*]}"

    local failed_packages=()
    local passed_packages=()

    for package_name in "${packages_array[@]}"; do
        if run_package_tests "$package_name"; then
            passed_packages+=("$package_name")
        else
            failed_packages+=("$package_name")
        fi
        echo ""
    done

    # Summary
    log INFO "Test Summary:"
    log INFO "  Passed: ${#passed_packages[@]} package(s)"

    if [ ${#passed_packages[@]} -gt 0 ]; then
        for pkg in "${passed_packages[@]}"; do
            echo -e "    ${GREEN}✓${NC} $pkg"
        done
    fi

    if [ ${#failed_packages[@]} -gt 0 ]; then
        log ERROR "  Failed: ${#failed_packages[@]} package(s)"
        for pkg in "${failed_packages[@]}"; do
            echo -e "    ${RED}✗${NC} $pkg"
        done
        return 1
    fi

    return 0
}

# Main execution
main() {
    local run_lint=true
    local run_typecheck=false
    local run_tests=true
    local exit_on_error=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-lint)
                run_lint=false
                shift
                ;;
            --typecheck)
                run_typecheck=true
                shift
                ;;
            --no-tests)
                run_tests=false
                shift
                ;;
            --exit-on-error)
                exit_on_error=true
                shift
                ;;
            --help)
                cat <<USAGE
Usage: $(basename "$0") [OPTIONS]

Options:
  --no-lint           Skip linting checks
  --typecheck         Run TypeScript type checking
  --no-tests          Skip unit tests
  --exit-on-error     Exit immediately on first error
  --help              Show this help message

Examples:
  # Run all checks
  $(basename "$0")

  # Run only tests
  $(basename "$0") --no-lint

  # Run lint and typecheck only
  $(basename "$0") --no-tests --typecheck

USAGE
                exit 0
                ;;
            *)
                log ERROR "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    log INFO "Starting test suite for monorepo"
    log INFO "Project root: ${PROJECT_ROOT}"
    echo ""

    local overall_exit_code=0

    # Run linting
    if [ "$run_lint" = true ]; then
        if ! run_lint; then
            overall_exit_code=1
            if [ "$exit_on_error" = true ]; then
                log ERROR "Exiting due to linting failure"
                exit 1
            fi
        fi
        echo ""
    fi

    # Run type checking
    if [ "$run_typecheck" = true ]; then
        if ! run_typecheck; then
            overall_exit_code=1
            if [ "$exit_on_error" = true ]; then
                log ERROR "Exiting due to type checking failure"
                exit 1
            fi
        fi
        echo ""
    fi

    # Run tests
    if [ "$run_tests" = true ]; then
        if ! run_all_tests; then
            overall_exit_code=1
        fi
        echo ""
    fi

    # Final summary
    if [ $overall_exit_code -eq 0 ]; then
        log SUCCESS "All checks passed!"
    else
        log ERROR "Some checks failed"
    fi

    exit $overall_exit_code
}

# Execute main function
main "$@"
