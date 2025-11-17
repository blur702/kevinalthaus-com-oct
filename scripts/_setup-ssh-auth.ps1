# PowerShell script to copy SSH key to production server
# NOTE: This script prompts interactively for the SSH password.
# It does not use environment variables for password authentication.
# Usage: .\scripts\_setup-ssh-auth.ps1

$pubKey = Get-Content "$env:USERPROFILE\.ssh\id_kevin_prod.pub"

Write-Host "Copying SSH key to production server..." -ForegroundColor Green

# Create a temporary script to run on the server
$remoteScript = @"
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo '$pubKey' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo 'SSH_KEY_ADDED'
"@

# Try to execute via SSH (this will prompt for password in PowerShell)
Write-Host "You will be prompted for your SSH password" -ForegroundColor Yellow
ssh kevin@kevinalthaus.com "$remoteScript"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ SSH key copied successfully!" -ForegroundColor Green

    # Test connection
    Write-Host "Testing SSH connection..." -ForegroundColor Cyan
    ssh -o BatchMode=yes kevin-prod exit

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ SSH connection test passed!" -ForegroundColor Green
    } else {
        Write-Host "⚠ SSH test with key failed, but key was copied" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ Failed to copy SSH key" -ForegroundColor Red
    exit 1
}
