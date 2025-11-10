#!/bin/bash
# Run CodeRabbit review in WSL
cd /mnt/e/dev/kevinalthaus-com-oct || exit 1

echo "Starting CodeRabbit review at $(date)"
echo "This may take 7-30+ minutes..."

/root/.local/bin/coderabbit review --prompt-only --type uncommitted

echo "CodeRabbit review completed at $(date)"
