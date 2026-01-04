#!/bin/bash
PORT=3000
if lsof -ti:${PORT} > /dev/null 2>&1; then
  echo "Server active on port ${PORT}"
else
  echo "Server not active"
fi
