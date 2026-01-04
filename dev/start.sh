#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "Starting Next.js on port 3000"
unbuffer npm run dev-no-logs 2>&1 | tee dev/dev.log
