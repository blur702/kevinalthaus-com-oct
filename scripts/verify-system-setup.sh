#!/bin/bash
# System Setup Verification Script
# Verifies all system components are properly installed and configured
# Usage: ./scripts/verify-system-setup.sh [--json]
#
# Exit codes:
#   0 = All components present and configured
#   1 = One or more critical components missing or misconfigured
#   2 = Invalid usage or unsupported option

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="${APP_DIR:-/opt/kevinalthaus}"
FORMAT="${1:-}"
EXIT_CODE=0

# Check if running in JSON mode
JSON_MODE=false
if [ "$FORMAT" == "--json" ]; then
    JSON_MODE=true
    # Check if jq is available for JSON output
    if ! command -v jq &> /dev/null; then
        echo '{"error": "jq is required for JSON output but is not installed"}' >&2
        exit 2
    fi
fi

# JSON results array
declare -a JSON_RESULTS=()

# Helper function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Helper function to check component and record result
check_component() {
    local name="$1"
    local check_command="$2"
    local get_version="$3"
    local critical="${4:-true}"

    local status="missing"
    local version=""
    local message=""

    if eval "$check_command" &> /dev/null; then
        status="present"
        if [ -n "$get_version" ]; then
            version=$(eval "$get_version" 2>/dev/null || echo "unknown")
        fi
    else
        if [ "$critical" == "true" ]; then
            EXIT_CODE=1
            message="Critical component missing"
        else
            message="Optional component missing"
        fi
    fi

    if [ "$JSON_MODE" == "true" ]; then
        local json_entry=$(jq -n \
            --arg name "$name" \
            --arg status "$status" \
            --arg version "$version" \
            --arg critical "$critical" \
            --arg message "$message" \
            '{name: $name, status: $status, version: $version, critical: ($critical == "true"), message: $message}')
        JSON_RESULTS+=("$json_entry")
    else
        if [ "$status" == "present" ]; then
            echo -e "${GREEN}✓${NC} $name: ${BLUE}$version${NC}"
        else
            if [ "$critical" == "true" ]; then
                echo -e "${RED}✗${NC} $name: ${RED}MISSING${NC} (critical)"
            else
                echo -e "${YELLOW}⚠${NC} $name: ${YELLOW}MISSING${NC} (optional)"
            fi
        fi
    fi
}

# Helper function to check service status
check_service() {
    local name="$1"
    local service_name="$2"
    local critical="${3:-true}"

    local status="inactive"
    local message=""

    if systemctl is-active --quiet "$service_name" 2>/dev/null; then
        status="active"
    elif systemctl is-enabled --quiet "$service_name" 2>/dev/null; then
        status="enabled"
        message="Service is enabled but not running"
        if [ "$critical" == "true" ]; then
            EXIT_CODE=1
        fi
    else
        status="missing"
        message="Service not found or not enabled"
        if [ "$critical" == "true" ]; then
            EXIT_CODE=1
        fi
    fi

    if [ "$JSON_MODE" == "true" ]; then
        local json_entry=$(jq -n \
            --arg name "$name" \
            --arg status "$status" \
            --arg critical "$critical" \
            --arg message "$message" \
            '{name: $name, status: $status, critical: ($critical == "true"), message: $message}')
        JSON_RESULTS+=("$json_entry")
    else
        if [ "$status" == "active" ]; then
            echo -e "${GREEN}✓${NC} $name: ${GREEN}active${NC}"
        elif [ "$status" == "enabled" ]; then
            echo -e "${YELLOW}⚠${NC} $name: ${YELLOW}enabled but not running${NC}"
        else
            if [ "$critical" == "true" ]; then
                echo -e "${RED}✗${NC} $name: ${RED}not found${NC}"
            else
                echo -e "${YELLOW}⚠${NC} $name: ${YELLOW}not found${NC}"
            fi
        fi
    fi
}

# Helper function to check firewall rules
check_firewall_rule() {
    local port="$1"
    local description="$2"

    local status="missing"

    if ufw status 2>/dev/null | grep -q "$port"; then
        status="present"
    else
        status="missing"
        EXIT_CODE=1
    fi

    if [ "$JSON_MODE" == "true" ]; then
        local json_entry=$(jq -n \
            --arg name "UFW Rule: $description" \
            --arg port "$port" \
            --arg status "$status" \
            '{name: $name, port: $port, status: $status}')
        JSON_RESULTS+=("$json_entry")
    else
        if [ "$status" == "present" ]; then
            echo -e "${GREEN}✓${NC} Port $port ($description): ${GREEN}allowed${NC}"
        else
            echo -e "${RED}✗${NC} Port $port ($description): ${RED}not configured${NC}"
        fi
    fi
}

# Helper function to check directory
check_directory() {
    local path="$1"
    local description="$2"
    local critical="${3:-true}"

    local status="missing"
    local permissions=""
    local owner=""

    if [ -d "$path" ]; then
        status="present"
        permissions=$(stat -c "%a" "$path" 2>/dev/null || stat -f "%Lp" "$path" 2>/dev/null || echo "unknown")
        owner=$(stat -c "%U:%G" "$path" 2>/dev/null || stat -f "%Su:%Sg" "$path" 2>/dev/null || echo "unknown")
    else
        if [ "$critical" == "true" ]; then
            EXIT_CODE=1
        fi
    fi

    if [ "$JSON_MODE" == "true" ]; then
        local json_entry=$(jq -n \
            --arg name "$description" \
            --arg path "$path" \
            --arg status "$status" \
            --arg permissions "$permissions" \
            --arg owner "$owner" \
            --arg critical "$critical" \
            '{name: $name, path: $path, status: $status, permissions: $permissions, owner: $owner, critical: ($critical == "true")}')
        JSON_RESULTS+=("$json_entry")
    else
        if [ "$status" == "present" ]; then
            echo -e "${GREEN}✓${NC} $description: ${BLUE}$path${NC} (${permissions}, ${owner})"
        else
            if [ "$critical" == "true" ]; then
                echo -e "${RED}✗${NC} $description: ${RED}MISSING${NC} ($path)"
            else
                echo -e "${YELLOW}⚠${NC} $description: ${YELLOW}MISSING${NC} ($path)"
            fi
        fi
    fi
}

# Start verification
if [ "$JSON_MODE" == "false" ]; then
    echo "========================================="
    echo "System Setup Verification"
    echo "Date: $(date)"
    echo "========================================="
    echo ""
fi

# Check system components
if [ "$JSON_MODE" == "false" ]; then
    echo "System Components:"
fi

check_component "Docker Engine" \
    "command_exists docker" \
    "docker --version | cut -d' ' -f3 | tr -d ','" \
    "true"

check_component "Docker Compose v2" \
    "docker compose version &> /dev/null" \
    "docker compose version | cut -d' ' -f4" \
    "true"

check_component "curl" \
    "command_exists curl" \
    "curl --version | head -1 | cut -d' ' -f2" \
    "true"

check_component "git" \
    "command_exists git" \
    "git --version | cut -d' ' -f3" \
    "true"

check_component "openssl" \
    "command_exists openssl" \
    "openssl version | cut -d' ' -f2" \
    "true"

if [ "$JSON_MODE" == "false" ]; then
    echo ""
    echo "Security Services:"
fi

# Check UFW
check_service "UFW Firewall" "ufw" "true"

# Check fail2ban
check_service "fail2ban" "fail2ban" "true"

# Check firewall rules
if [ "$JSON_MODE" == "false" ]; then
    echo ""
    echo "Firewall Rules:"
fi

check_firewall_rule "22" "SSH"
check_firewall_rule "80" "HTTP"
check_firewall_rule "443" "HTTPS"

# Check directories
if [ "$JSON_MODE" == "false" ]; then
    echo ""
    echo "Directories:"
fi

check_directory "$APP_DIR" "Application Directory" "true"
check_directory "$APP_DIR/logs" "Logs Directory" "false"
check_directory "/var/backups/kevinalthaus" "Backup Directory" "false"

# Check fail2ban jail status
if [ "$JSON_MODE" == "false" ]; then
    echo ""
    echo "fail2ban Status:"
fi

if command_exists fail2ban-client; then
    if fail2ban-client status sshd &> /dev/null; then
        BANNED_IPS=$(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}')

        if [ "$JSON_MODE" == "true" ]; then
            local json_entry=$(jq -n \
                --arg status "active" \
                --arg jail "sshd" \
                --arg banned "$BANNED_IPS" \
                '{name: "fail2ban SSH Jail", status: $status, jail: $jail, banned_ips: $banned}')
            JSON_RESULTS+=("$json_entry")
        else
            echo -e "${GREEN}✓${NC} SSH Jail: ${GREEN}active${NC} (${BANNED_IPS} IPs banned)"
        fi
    else
        if [ "$JSON_MODE" == "true" ]; then
            local json_entry=$(jq -n \
                --arg status "inactive" \
                --arg jail "sshd" \
                '{name: "fail2ban SSH Jail", status: $status, jail: $jail}')
            JSON_RESULTS+=("$json_entry")
        else
            echo -e "${YELLOW}⚠${NC} SSH Jail: ${YELLOW}not active${NC}"
        fi
        EXIT_CODE=1
    fi
fi

# Output results
if [ "$JSON_MODE" == "true" ]; then
    # Combine all JSON results
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"exit_code\": $EXIT_CODE,"
    echo "  \"status\": $([ $EXIT_CODE -eq 0 ] && echo '\"pass\"' || echo '\"fail\"'),"
    echo "  \"checks\": ["

    # Print each result separated by commas
    for i in "${!JSON_RESULTS[@]}"; do
        echo "    ${JSON_RESULTS[$i]}"
        if [ $i -lt $((${#JSON_RESULTS[@]} - 1)) ]; then
            echo ","
        fi
    done

    echo "  ]"
    echo "}"
else
    echo ""
    echo "========================================="
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed${NC}"
    else
        echo -e "${RED}✗ Some checks failed${NC}"
    fi
    echo "========================================="
fi

exit $EXIT_CODE
