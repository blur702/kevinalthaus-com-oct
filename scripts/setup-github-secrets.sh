#!/bin/bash

# Setup GitHub Secrets for CI/CD
# This script helps configure all required GitHub secrets for the repository
# Prerequisites: GitHub CLI (gh) must be installed and authenticated

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GitHub Secrets Setup Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo "Please install it from: https://cli.github.com/"
    echo ""
    echo "Installation commands:"
    echo "  macOS:   brew install gh"
    echo "  Windows: winget install --id GitHub.cli"
    echo "  Linux:   See https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}You are not authenticated with GitHub CLI.${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository name
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo -e "${RED}Error: Could not determine repository name.${NC}"
    echo "Please make sure you are in a Git repository with a GitHub remote."
    exit 1
fi

echo -e "${GREEN}Repository:${NC} $REPO"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_required=$3
    local default_value=$4

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Setting: ${NC}$secret_name"
    echo -e "${GREEN}Description: ${NC}$secret_description"

    if [ "$is_required" = "required" ]; then
        echo -e "${RED}Required: YES${NC}"
    else
        echo -e "${YELLOW}Required: NO (optional)${NC}"
    fi

    # Check if secret already exists
    if gh secret list -R "$REPO" | grep -q "^$secret_name"; then
        echo -e "${YELLOW}Secret already exists.${NC}"
        read -p "Do you want to update it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping..."
            echo ""
            return
        fi
    fi

    # Prompt for value
    if [ -n "$default_value" ]; then
        read -sp "Enter value (default: $default_value): " secret_value
        echo
        if [ -z "$secret_value" ]; then
            secret_value=$default_value
        fi
    else
        read -sp "Enter value: " secret_value
        echo
    fi

    # Allow skipping optional secrets
    if [ -z "$secret_value" ] && [ "$is_required" != "required" ]; then
        echo -e "${YELLOW}Skipping optional secret.${NC}"
        echo ""
        return
    fi

    # Validate required secrets
    if [ -z "$secret_value" ] && [ "$is_required" = "required" ]; then
        echo -e "${RED}Error: This secret is required and cannot be empty.${NC}"
        exit 1
    fi

    # Set the secret
    echo "$secret_value" | gh secret set "$secret_name" -R "$REPO"
    echo -e "${GREEN}✓ Secret set successfully!${NC}"
    echo ""
}

# Main setup
echo -e "${GREEN}This script will help you set up the following GitHub secrets:${NC}"
echo ""
echo "Required secrets:"
echo "  1. TEST_ADMIN_EMAIL      - Admin email for E2E tests"
echo "  2. TEST_ADMIN_PASSWORD   - Admin password for E2E tests"
echo ""
echo "Optional secrets:"
echo "  3. CODERABBIT_TOKEN      - CodeRabbit AI review token"
echo "  4. PROD_SSH_KEY          - SSH private key for production deployment"
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi
echo ""

# Required secrets
set_secret "TEST_ADMIN_EMAIL" "Admin email for E2E tests (e.g., kevin or admin@example.com)" "required" ""
set_secret "TEST_ADMIN_PASSWORD" "Admin password for E2E tests" "required" ""

# Optional secrets
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Optional Secrets${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "The following secrets are optional. Press Enter to skip."
echo ""

read -p "Do you want to set up CodeRabbit token? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    set_secret "CODERABBIT_TOKEN" "CodeRabbit AI API token from https://coderabbit.ai" "optional" ""
fi

read -p "Do you want to set up production SSH key? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}For PROD_SSH_KEY, you need to provide the SSH private key content.${NC}"
    echo "You can:"
    echo "  1. Type/paste the key manually (use Ctrl+D when done)"
    echo "  2. Cancel and use: gh secret set PROD_SSH_KEY -R $REPO < ~/.ssh/id_prod"
    echo ""
    read -p "Continue with manual entry? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        set_secret "PROD_SSH_KEY" "SSH private key for production server deployment" "optional" ""
    fi
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Configured secrets:"
gh secret list -R "$REPO"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Verify secrets in GitHub: https://github.com/$REPO/settings/secrets/actions"
echo "2. Run workflows to test the configuration"
echo "3. Check workflow runs: https://github.com/$REPO/actions"
echo ""
echo -e "${YELLOW}Note:${NC} If you skipped optional secrets, the related workflows will skip automatically."
echo ""
