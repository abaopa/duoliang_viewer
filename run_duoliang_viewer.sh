#!/bin/bash
# run_duoliang_viewer.sh - Wrapper to run the duoliang_viewer GUI server in the virtual environment

# Base project directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Ensure Homebrew and standard binaries are in PATH for launchd environment
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

# Ensure we are in the correct directory so relative paths resolve correctly
cd "${BASE_DIR}/duoliang_viewer"

# Run the duoliang_viewer.py using the virtual environment's python interpreter
exec "${BASE_DIR}/.venv/bin/python" duoliang_viewer.py
