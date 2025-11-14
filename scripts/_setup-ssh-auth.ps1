# PowerShell script to copy SSH key to production server
$pubKey = Get-Content "$env:USERPROFILE\.ssh\id_kevin_prod.pub"
$password = "(130Bpm)"
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ("kevin", $securePassword)

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
Write-Host "You will be prompted for password: (130Bpm)" -ForegroundColor Yellow
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
