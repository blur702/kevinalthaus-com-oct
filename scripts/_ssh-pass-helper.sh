#!/bin/bash
# SSH password helper script
# Reads password from SSH_SETUP_PASSWORD environment variable
# Usage: export SSH_SETUP_PASSWORD='your_password' before running SSH setup scripts

if [ -z "$SSH_SETUP_PASSWORD" ]; then
    echo "Error: SSH_SETUP_PASSWORD environment variable is not set" >&2
    exit 1
fi

echo "$SSH_SETUP_PASSWORD"
