#!/bin/bash
# Create required directories for PostgreSQL WAL archiving
# This script runs before postgres starts to ensure directories exist with correct permissions

set -euo pipefail

echo "Creating WAL archive directory..."

# Create WAL archive directory
mkdir -p /backups/wal

# Set correct ownership and permissions
chown -R postgres:postgres /backups
chmod -R 700 /backups

echo "WAL archive directory created successfully"
