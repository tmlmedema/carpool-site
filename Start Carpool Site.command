#!/bin/bash
# Double-click to run the carpool site on this Mac. It opens in your browser at http://localhost:8888
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "Node.js isn't installed yet. Download the LTS version from https://nodejs.org,"
  echo "install it, then double-click this file again."
  open "https://nodejs.org"
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run: installing (takes a minute)..."
  npm install || { read -n 1 -s -r -p "Install failed. Press any key to close..."; exit 1; }
fi
export ADMIN_EMAILS="${ADMIN_EMAILS:-jill@snacksdesign.com}"
(sleep 4 && open "http://localhost:8888") &
npm run dev
