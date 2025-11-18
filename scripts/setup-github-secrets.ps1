# Setup GitHub Secrets for CI/CD
# This script helps configure all required GitHub secrets for the repository
# Prerequisites: GitHub CLI (gh) must be installed and authenticated

$ErrorActionPreference = "Stop"

# Color functions
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green @args }
function Write-Warning { Write-ColorOutput Yellow @args }
function Write-Error { Write-ColorOutput Red @args }

Write-Success "========================================"
Write-Success "GitHub Secrets Setup Script"
Write-Success "========================================"
Write-Host ""

# Check if gh CLI is installed
try {
    $null = gh --version
} catch {
    Write-Error "Error: GitHub CLI (gh) is not installed."
    Write-Host "Please install it from: https://cli.github.com/"
    Write-Host ""
    Write-Host "Installation command:"
    Write-Host "  winget install --id GitHub.cli"
    exit 1
}

# Check if authenticated
try {
    $null = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Not authenticated"
    }
} catch {
    Write-Warning "You are not authenticated with GitHub CLI."
    Write-Host "Please run: gh auth login"
    exit 1
}

# Get repository name
try {
    $REPO = gh repo view --json nameWithOwner -q .nameWithOwner
    if ([string]::IsNullOrWhiteSpace($REPO)) {
        throw "Empty repository name"
    }
} catch {
    Write-Error "Error: Could not determine repository name."
    Write-Host "Please make sure you are in a Git repository with a GitHub remote."
    exit 1
}

Write-Success "Repository: $REPO"
Write-Host ""

# Function to set a secret
function Set-GitHubSecret {
    param(
        [string]$SecretName,
        [string]$Description,
        [string]$IsRequired,
        [string]$DefaultValue = ""
    )

    Write-Warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Success "Setting: $SecretName"
    Write-Success "Description: $Description"

    if ($IsRequired -eq "required") {
        Write-Error "Required: YES"
    } else {
        Write-Warning "Required: NO (optional)"
    }

    # Check if secret already exists
    $existingSecrets = gh secret list -R $REPO
    if ($existingSecrets -match "^$SecretName\s") {
        Write-Warning "Secret already exists."
        $update = Read-Host "Do you want to update it? (y/N)"
        if ($update -notmatch '^[Yy]$') {
            Write-Host "Skipping..."
            Write-Host ""
            return
        }
    }

    # Prompt for value
    if ($DefaultValue) {
        $secureValue = Read-Host "Enter value (default: $DefaultValue)" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        $secretValue = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

        if ([string]::IsNullOrWhiteSpace($secretValue)) {
            $secretValue = $DefaultValue
        }
    } else {
        $secureValue = Read-Host "Enter value" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        $secretValue = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }

    # Allow skipping optional secrets
    if ([string]::IsNullOrWhiteSpace($secretValue) -and $IsRequired -ne "required") {
        Write-Warning "Skipping optional secret."
        Write-Host ""
        return
    }

    # Validate required secrets
    if ([string]::IsNullOrWhiteSpace($secretValue) -and $IsRequired -eq "required") {
        Write-Error "Error: This secret is required and cannot be empty."
        exit 1
    }

    # Set the secret
    $secretValue | gh secret set $SecretName -R $REPO
    Write-Success "✓ Secret set successfully!"
    Write-Host ""
}

# Main setup
Write-Success "This script will help you set up the following GitHub secrets:"
Write-Host ""
Write-Host "Required secrets:"
Write-Host "  1. TEST_ADMIN_EMAIL      - Admin email for E2E tests"
Write-Host "  2. TEST_ADMIN_PASSWORD   - Admin password for E2E tests"
Write-Host ""
Write-Host "Optional secrets:"
Write-Host "  3. CODERABBIT_TOKEN      - CodeRabbit AI review token"
Write-Host "  4. PROD_SSH_KEY          - SSH private key for production deployment"
Write-Host ""
$continue = Read-Host "Do you want to continue? (y/N)"
if ($continue -notmatch '^[Yy]$') {
    Write-Host "Setup cancelled."
    exit 0
}
Write-Host ""

# Required secrets
Set-GitHubSecret -SecretName "TEST_ADMIN_EMAIL" -Description "Admin email for E2E tests (e.g., kevin or admin@example.com)" -IsRequired "required"
Set-GitHubSecret -SecretName "TEST_ADMIN_PASSWORD" -Description "Admin password for E2E tests" -IsRequired "required"

# Optional secrets
Write-Warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Success "Optional Secrets"
Write-Warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "The following secrets are optional. Press Enter to skip."
Write-Host ""

$setupCodeRabbit = Read-Host "Do you want to set up CodeRabbit token? (y/N)"
if ($setupCodeRabbit -match '^[Yy]$') {
    Set-GitHubSecret -SecretName "CODERABBIT_TOKEN" -Description "CodeRabbit AI API token from https://coderabbit.ai" -IsRequired "optional"
}

$setupSSH = Read-Host "Do you want to set up production SSH key? (y/N)"
if ($setupSSH -match '^[Yy]$') {
    Write-Host ""
    Write-Warning "For PROD_SSH_KEY, you need to provide the SSH private key content."
    Write-Host "You can:"
    Write-Host "  1. Type/paste the key manually"
    Write-Host "  2. Cancel and use: Get-Content ~/.ssh/id_prod | gh secret set PROD_SSH_KEY -R $REPO"
    Write-Host ""
    $continueSSH = Read-Host "Continue with manual entry? (y/N)"
    if ($continueSSH -match '^[Yy]$') {
        Set-GitHubSecret -SecretName "PROD_SSH_KEY" -Description "SSH private key for production server deployment" -IsRequired "optional"
    }
}

# Summary
Write-Host ""
Write-Success "========================================"
Write-Success "Setup Complete!"
Write-Success "========================================"
Write-Host ""
Write-Host "Configured secrets:"
gh secret list -R $REPO
Write-Host ""
Write-Success "Next steps:"
Write-Host "1. Verify secrets in GitHub: https://github.com/$REPO/settings/secrets/actions"
Write-Host "2. Run workflows to test the configuration"
Write-Host "3. Check workflow runs: https://github.com/$REPO/actions"
Write-Host ""
Write-Warning "Note: If you skipped optional secrets, the related workflows will skip automatically."
Write-Host ""
