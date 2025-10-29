#!/usr/bin/env bash
# CodeRabbit Status Monitor
# This script checks the status of a running CodeRabbit review

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly STATUS_DIR="${PROJECT_ROOT}/.coderabbit-status"
readonly STATUS_FILE="${STATUS_DIR}/status.json"
readonly PROGRESS_FILE="${STATUS_DIR}/progress.log"
readonly OUTPUT_FILE="${STATUS_DIR}/output.txt"
readonly NOTIFICATION_FILE="${STATUS_DIR}/notification.txt"

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Check if status directory exists
check_status_dir() {
    if [ ! -d "${STATUS_DIR}" ]; then
        echo -e "${YELLOW}No CodeRabbit review status found${NC}"
        echo "Status directory does not exist: ${STATUS_DIR}"
        echo ""
        echo "Have you run the wrapper script yet?"
        echo "  ./scripts/coderabbit-wrapper.sh"
        exit 1
    fi
}

# Display status in JSON format (AI-friendly)
display_json_status() {
    check_status_dir

    if [ ! -f "${STATUS_FILE}" ]; then
        echo '{"error": "Status file not found", "statusFile": "'"${STATUS_FILE}"'"}'
        exit 1
    fi

    cat "${STATUS_FILE}"
}

# Display human-readable status
display_human_status() {
    check_status_dir

    if [ ! -f "${STATUS_FILE}" ]; then
        echo -e "${RED}Status file not found: ${STATUS_FILE}${NC}"
        exit 1
    fi

    echo -e "${CYAN}==============================================================================${NC}"
    echo -e "${CYAN}                    CODERABBIT REVIEW STATUS${NC}"
    echo -e "${CYAN}==============================================================================${NC}"
    echo ""

    # Parse status JSON
    local status=$(grep -oP '(?<="status": ")[^"]*' "${STATUS_FILE}" || echo "unknown")
    local phase=$(grep -oP '(?<="phase": ")[^"]*' "${STATUS_FILE}" || echo "unknown")
    local start_time=$(grep -oP '(?<="startTime": ")[^"]*' "${STATUS_FILE}" || echo "unknown")
    local end_time=$(grep -oP '(?<="endTime": ")[^"]*' "${STATUS_FILE}" || echo "not finished")
    local tests_run=$(grep -oP '(?<="testsRun": )[^,}]*' "${STATUS_FILE}" || echo "false")
    local tests_passed=$(grep -oP '(?<="testsPassed": )[^,}]*' "${STATUS_FILE}" || echo "null")
    local review_complete=$(grep -oP '(?<="reviewComplete": )[^,}]*' "${STATUS_FILE}" || echo "false")
    local issues_found=$(grep -oP '(?<="issuesFound": )[^,}]*' "${STATUS_FILE}" || echo "null")
    local exit_code=$(grep -oP '(?<="exitCode": )[^,}]*' "${STATUS_FILE}" || echo "null")
    local pid=$(grep -oP '(?<="pid": )\d+' "${STATUS_FILE}" || echo "unknown")

    # Display status with colors
    echo -e "${BLUE}Status:${NC} $status"
    echo -e "${BLUE}Phase:${NC} $phase"
    echo ""

    echo -e "${BLUE}Timeline:${NC}"
    echo -e "  Started:  $start_time"
    echo -e "  Finished: $end_time"

    # Calculate elapsed time if still running
    if [ "$end_time" = "not finished" ] && [ "$start_time" != "unknown" ]; then
        local start_epoch=$(date -d "$start_time" +%s 2>/dev/null || echo "0")
        local current_epoch=$(date +%s)
        local elapsed=$((current_epoch - start_epoch))
        local elapsed_mins=$((elapsed / 60))
        local elapsed_secs=$((elapsed % 60))
        echo -e "  Elapsed:  ${elapsed_mins}m ${elapsed_secs}s"
    fi
    echo ""

    echo -e "${BLUE}Process:${NC}"
    echo -e "  PID: $pid"

    # Check if process is still running
    if [ "$pid" != "unknown" ]; then
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "  Running: ${GREEN}Yes${NC}"
        else
            echo -e "  Running: ${RED}No${NC}"
        fi
    fi
    echo ""

    echo -e "${BLUE}Tests:${NC}"
    echo -e "  Run:    $([ "$tests_run" = "true" ] && echo "${GREEN}Yes${NC}" || echo "${RED}No${NC}")"
    echo -e "  Passed: $([ "$tests_passed" = "true" ] && echo "${GREEN}Yes${NC}" || [ "$tests_passed" = "false" ] && echo "${RED}No${NC}" || echo "N/A")"
    echo ""

    echo -e "${BLUE}Review:${NC}"
    echo -e "  Complete: $([ "$review_complete" = "true" ] && echo "${GREEN}Yes${NC}" || echo "${YELLOW}In Progress${NC}")"
    echo -e "  Issues:   $([ "$issues_found" != "null" ] && echo "$issues_found" || echo "N/A")"
    echo ""

    if [ "$exit_code" != "null" ]; then
        echo -e "${BLUE}Exit Code:${NC} $exit_code"
        echo ""
    fi

    echo -e "${CYAN}==============================================================================${NC}"
    echo ""

    # Show notification if complete
    if [ "$review_complete" = "true" ] && [ -f "${NOTIFICATION_FILE}" ]; then
        echo -e "${GREEN}Review completed! Notification:${NC}"
        echo ""
        cat "${NOTIFICATION_FILE}"
    fi

    # Show tail of progress log
    if [ -f "${PROGRESS_FILE}" ]; then
        echo -e "${BLUE}Recent Progress (last 10 lines):${NC}"
        tail -10 "${PROGRESS_FILE}"
        echo ""
    fi
}

# Display tail of progress log
tail_progress() {
    check_status_dir

    if [ ! -f "${PROGRESS_FILE}" ]; then
        echo -e "${RED}Progress file not found: ${PROGRESS_FILE}${NC}"
        exit 1
    fi

    local lines="${1:-20}"
    tail -n "$lines" "${PROGRESS_FILE}"
}

# Follow progress log in real-time
follow_progress() {
    check_status_dir

    if [ ! -f "${PROGRESS_FILE}" ]; then
        echo -e "${RED}Progress file not found: ${PROGRESS_FILE}${NC}"
        exit 1
    fi

    echo -e "${CYAN}Following progress log (Ctrl+C to stop)...${NC}"
    tail -f "${PROGRESS_FILE}"
}

# Display review output
show_output() {
    check_status_dir

    if [ ! -f "${OUTPUT_FILE}" ]; then
        echo -e "${YELLOW}Output file not found: ${OUTPUT_FILE}${NC}"
        echo "Review may not have completed yet."
        exit 1
    fi

    cat "${OUTPUT_FILE}"
}

# Wait for completion
wait_for_completion() {
    check_status_dir

    echo -e "${CYAN}Waiting for CodeRabbit review to complete...${NC}"
    echo -e "${YELLOW}This may take 7-30+ minutes${NC}"
    echo ""

    local check_interval=10
    local last_phase=""

    while true; do
        if [ ! -f "${STATUS_FILE}" ]; then
            echo -e "${RED}Status file disappeared${NC}"
            exit 1
        fi

        local status=$(grep -oP '(?<="status": ")[^"]*' "${STATUS_FILE}" || echo "unknown")
        local phase=$(grep -oP '(?<="phase": ")[^"]*' "${STATUS_FILE}" || echo "unknown")
        local review_complete=$(grep -oP '(?<="reviewComplete": )[^,}]*' "${STATUS_FILE}" || echo "false")

        # Show phase changes
        if [ "$phase" != "$last_phase" ]; then
            echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} Phase: $phase"
            last_phase="$phase"
        fi

        # Check if completed
        if [ "$status" = "completed" ] || [ "$status" = "failed" ] || [ "$review_complete" = "true" ]; then
            echo ""
            echo -e "${GREEN}Review completed!${NC}"
            echo ""

            # Show notification if available
            if [ -f "${NOTIFICATION_FILE}" ]; then
                cat "${NOTIFICATION_FILE}"
            fi

            exit 0
        fi

        sleep "$check_interval"
    done
}

# Main function
main() {
    local action="${1:-status}"

    case "$action" in
        status|--status|-s)
            display_human_status
            ;;
        json|--json|-j)
            display_json_status
            ;;
        tail|--tail|-t)
            tail_progress "${2:-20}"
            ;;
        follow|--follow|-f)
            follow_progress
            ;;
        output|--output|-o)
            show_output
            ;;
        wait|--wait|-w)
            wait_for_completion
            ;;
        help|--help|-h)
            cat <<USAGE
Usage: $(basename "$0") [COMMAND]

Commands:
  status, -s         Show current status (default)
  json, -j           Show status in JSON format (AI-friendly)
  tail, -t [N]       Show last N lines of progress log (default: 20)
  follow, -f         Follow progress log in real-time
  output, -o         Show CodeRabbit review output
  wait, -w           Wait for review to complete
  help, -h           Show this help message

Files:
  Status:   ${STATUS_FILE}
  Progress: ${PROGRESS_FILE}
  Output:   ${OUTPUT_FILE}

Examples:
  # Check current status
  $(basename "$0")

  # Follow progress in real-time
  $(basename "$0") follow

  # Wait for completion and show notification
  $(basename "$0") wait

  # Get JSON status for AI parsing
  $(basename "$0") json

USAGE
            ;;
        *)
            echo -e "${RED}Unknown command: $action${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
